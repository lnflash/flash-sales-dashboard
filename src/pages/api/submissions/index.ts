import type { NextApiRequest, NextApiResponse } from 'next';

// The target API endpoint
const TARGET_API_URL = process.env.INTAKE_API_URL || 'https://flash-intake-form-3xgvo.ondigitalocean.app/api';

// Type for API response
interface ApiResponse {
  data: any[];
  totalCount: number;
  pageCount: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS request for preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Log the request
    console.log(`[API PROXY] Proxying request to: ${TARGET_API_URL}/submissions${req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`);
    
    // Full URL for debugging
    const fullUrl = `${TARGET_API_URL}/submissions${req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    console.log(`[API PROXY] Full URL: ${fullUrl}`);
    
    // Test real intake form API and try to get its response
    try {
      console.log("[API PROXY] Attempting direct connection to intake form API");
      // Try a direct fetch to the main intake form API to see if it works
      const testResponse = await fetch("https://flash-intake-form-3xgvo.ondigitalocean.app/api/submissions");
      const testText = await testResponse.text();
      console.log("[API PROXY] Direct API test response:", testResponse.status, testText);
    } catch (testError) {
      console.error("[API PROXY] Test request failed:", testError);
    }
    
    // Forward the request to the intake form API with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout
    
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    };

    // Include body for POST requests
    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
      console.log(`[API PROXY] POST body:`, req.body);
    }
    
    const response = await fetch(fullUrl, fetchOptions);
    
    clearTimeout(timeoutId);
    
    console.log(`[API PROXY] Response status: ${response.status}`);
    
    // Get the response data as text first for logging
    const responseText = await response.text();
    console.log(`[API PROXY] Raw response: ${responseText}`);
    
    let data;
    // Try to parse the response as JSON
    try {
      data = JSON.parse(responseText);
      console.log(`[API PROXY] Parsed data:`, data);
    } catch (parseError) {
      console.error(`[API PROXY] Failed to parse response as JSON:`, parseError);
      console.log("[API PROXY] Falling back to real data from DB");
      
      // If the API didn't return valid JSON, return an error
      return res.status(500).json({
        error: 'Invalid response from API server'
      });
    }
    
    // If we got here, we have valid JSON
    
    // Return the response
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[API PROXY] Error in submissions proxy:', error);
    if (error.name === 'AbortError') {
      res.status(504).json({ error: 'Request timeout' });
    } else {
      // Return an error message if the API request failed
      console.log("[API PROXY] API request failed with error");
      return res.status(500).json({
        error: 'API request failed: ' + error.message
      });
    }
  }
}