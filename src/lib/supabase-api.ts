import { supabase } from "@/lib/supabase/client";
import { Submission, SubmissionFilters, PaginationState, SortOption, SubmissionStats, SubmissionListResponse } from "@/types/submission";
import { normalizeSearchTerm } from "@/lib/search-utils";

// Helper function to convert Supabase deal data to Submission format
export function mapDealToSubmission(deal: any): Submission {
  if (!deal) return null as any;

  // Get territory with fallback logic
  let territory = deal.organization?.state_province || "";
  
  // If no territory from organization, try to determine from owner (if owner exists)
  if (!territory && deal.owner?.email) {
    const territoryMap: Record<string, string> = {
      'rogimon@getflash.io': 'St. Ann',
      'tatiana_1@getflash.io': 'Kingston',
      'charms@getflash.io': 'Portland',
      'chala@getflash.io': 'St. Mary',
      'kandi@getflash.io': 'St. Catherine',
      'leah@getflash.io': 'Clarendon',
      'tamoy@getflash.io': 'Manchester',
      'jodi@getflash.io': 'St. Elizabeth',
      'flash@getflash.io': 'Kingston'
    };
    territory = territoryMap[deal.owner.email] || "";
  }

  // Map deal status to lead status
  let leadStatus: string | undefined;
  if (deal.lead_status) {
    leadStatus = deal.lead_status;
  } else if (deal.status === "won") {
    leadStatus = "signed_up";
  }

  return {
    id: deal.id, // Keep as string UUID
    ownerName: deal.organization?.name || deal.name || "",
    phoneNumber: deal.primary_contact?.phone_primary || "",
    packageSeen: deal.package_seen || false,
    decisionMakers: deal.decision_makers || "",
    interestLevel: deal.interest_level || 0,
    signedUp: deal.status === "won" || false,
    leadStatus: leadStatus as any,
    specificNeeds: deal.specific_needs || "",
    username: deal.owner?.username || deal.owner?.email?.split("@")[0] || "Unassigned",
    territory: territory,
    timestamp: deal.created_at || new Date().toISOString(),
  };
}

// Function to build Supabase query with filters, pagination, and sorting
function buildSupabaseQuery(baseQuery: any, filters?: SubmissionFilters, pagination?: PaginationState, sortBy?: SortOption[]) {
  let query = baseQuery;

  // Apply filters
  if (filters) {
    if (filters.search) {
      // Normalize search term for better matching
      const searchTerm = normalizeSearchTerm(filters.search);
      
      // For Supabase, we can only search direct fields on the deals table
      // Nested field searches require a different approach
      const searchConditions = [
        // Deal fields (direct fields only)
        `name.ilike.%${searchTerm}%`,
        `decision_makers.ilike.%${searchTerm}%`,
        `specific_needs.ilike.%${searchTerm}%`,
        `description.ilike.%${searchTerm}%`
      ];
      
      // Check if search term is a number for numeric field searches
      const isNumeric = !isNaN(Number(searchTerm));
      if (isNumeric) {
        searchConditions.push(
          `interest_level.eq.${searchTerm}`,
          `amount.eq.${searchTerm}`
        );
      }
      
      // Also search for boolean values
      if (searchTerm === 'yes' || searchTerm === 'true' || searchTerm === 'signed up') {
        searchConditions.push(`package_seen.eq.true`, `status.eq.won`);
      } else if (searchTerm === 'no' || searchTerm === 'false' || searchTerm === 'prospect') {
        searchConditions.push(`package_seen.eq.false`, `status.neq.won`);
      }
      
      query = query.or(searchConditions.join(','));
    }
    if (filters.dateRange?.start) {
      query = query.gte("created_at", filters.dateRange.start);
    }
    if (filters.dateRange?.end) {
      query = query.lte("created_at", filters.dateRange.end);
    }
    if (filters.interestLevel?.length) {
      query = query.in("interest_level", filters.interestLevel);
    }
    if (filters.signedUp !== undefined) {
      query = filters.signedUp ? query.eq("status", "won") : query.neq("status", "won");
    }
    if (filters.packageSeen !== undefined) {
      query = query.eq("package_seen", filters.packageSeen);
    }
    if (filters.username) {
      if (filters.username === 'Unassigned') {
        // Filter for deals without owners
        query = query.is("owner_id", null);
      }
    }
    // Apply user ID filter if we have one (from username lookup)
    if ((filters as any).userIdForFilter) {
      query = query.eq("owner_id", (filters as any).userIdForFilter);
    }
  }

  // Apply sorting
  if (sortBy && sortBy.length > 0) {
    const sortField = sortBy[0].id;
    const sortOrder = sortBy[0].desc ? false : true; // Supabase uses ascending: true/false

    // Map frontend field names to database column names
    const fieldMap: Record<string, string> = {
      ownerName: "organization.name",
      phoneNumber: "primary_contact.phone_primary",
      packageSeen: "package_seen",
      decisionMakers: "decision_makers",
      interestLevel: "interest_level",
      signedUp: "status",
      specificNeeds: "specific_needs",
      username: "owner.email",
      territory: "organization.state_province",
      timestamp: "created_at",
    };

    const dbField = fieldMap[sortField] || sortField;
    query = query.order(dbField, { ascending: sortOrder });
  } else {
    // Default sort by created_at descending
    query = query.order("created_at", { ascending: false });
  }

  // Apply pagination
  if (pagination) {
    const from = pagination.pageIndex * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    query = query.range(from, to);
  }

  return query;
}

// API functions
export async function getSubmissions(filters?: SubmissionFilters, pagination?: PaginationState, sortBy?: SortOption[]): Promise<SubmissionListResponse> {
  try {
    console.log("Fetching submissions from Supabase deals table with filters:", filters);
    
    // Log search term specifically
    if (filters?.search) {
      console.log("Searching for:", filters.search);
    }

    // If we need to filter by username (and it's not 'Unassigned'), we need to get the user ID first
    let userIdForFilter: string | null = null;
    if (filters?.username && filters.username !== 'Unassigned') {
      const trimmedUsername = filters.username.trim();
      console.log(`Looking up user ID for username: '${trimmedUsername}'`);
      
      // Try case-insensitive username match
      let { data: userData, error } = await supabase
        .from("users")
        .select("id, username, email")
        .or(`username.ilike.${trimmedUsername},email.ilike.${trimmedUsername}@getflash.io`)
        .single();
      
      console.log('User lookup result:', { userData, error });
      
      if (userData) {
        userIdForFilter = userData.id;
        console.log(`Found user ID for username '${trimmedUsername}':`, userIdForFilter);
      } else {
        console.log(`No user found for username '${trimmedUsername}'`);
        // Return empty results if user not found
        return {
          data: [],
          totalCount: 0,
          pageCount: 0,
        };
      }
    }

    // Build the base query with proper joins
    let countQuery = supabase.from("deals").select(
      `
        *,
        organization:organizations!organization_id(name, state_province),
        primary_contact:contacts!primary_contact_id(phone_primary),
        owner:users!owner_id(email, username)
      `,
      { count: "exact", head: true }
    );

    let dataQuery = supabase.from("deals").select(`
        *,
        organization:organizations!organization_id(name, state_province),
        primary_contact:contacts!primary_contact_id(phone_primary),
        owner:users!owner_id(email, username)
      `);

    // Apply filters to both queries, but pass the user ID if we have one
    const modifiedFilters = userIdForFilter 
      ? { ...filters, userIdForFilter } 
      : filters;
    countQuery = buildSupabaseQuery(countQuery, modifiedFilters);
    dataQuery = buildSupabaseQuery(dataQuery, modifiedFilters, pagination, sortBy);

    // Execute count query
    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error("Supabase count error:", countError);
      throw countError;
    }

    // Execute data query
    const { data, error: dataError } = await dataQuery;
    if (dataError) {
      console.error("Supabase data error:", dataError);
      throw dataError;
    }

    console.log(`Supabase returned ${data?.length || 0} deals`);
    
    // Log deals without owners
    const dealsWithoutOwners = data?.filter((d: any) => !d.owner_id) || [];
    if (dealsWithoutOwners.length > 0) {
      console.log(`Found ${dealsWithoutOwners.length} deals without owners:`, 
        dealsWithoutOwners.map((d: any) => ({ name: d.name, id: d.id }))
      );
    }
    
    if (filters?.search) {
      console.log("Search results for '" + filters.search + "':", data?.map((d: any) => ({
        dealName: d.name,
        orgName: d.organization?.name,
        hasOrg: !!d.organization,
        hasOwner: !!d.owner_id
      })));
    }
    const submissions = (data || []).map(mapDealToSubmission);
    console.log("Mapped submissions count:", submissions.length);

    return {
      data: submissions,
      totalCount: count || 0,
      pageCount: pagination ? Math.ceil((count || 0) / pagination.pageSize) : 1,
    };
  } catch (error) {
    console.error("Error fetching submissions from Supabase:", error);
    // Fall back to external API if Supabase fails
    throw error;
  }
}

export async function getSubmissionById(id: number | string): Promise<Submission> {
  try {
    const { data, error } = await supabase
      .from("deals")
      .select(
        `
        *,
        organization:organizations!organization_id(name, state_province),
        primary_contact:contacts!primary_contact_id(phone_primary),
        owner:users!owner_id(email, username)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Submission not found");

    return mapDealToSubmission(data);
  } catch (error) {
    console.error(`Error fetching submission ${id} from Supabase:`, error);
    throw error;
  }
}

export async function createSubmission(data: Omit<Submission, "id" | "timestamp">): Promise<Submission> {
  try {
    console.log("Creating submission in Supabase:", data);
    
    // First, check if organization exists or create it
    let organizationId = null;
    if (data.ownerName) {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("name", data.ownerName)
        .single();
      
      if (existingOrg) {
        organizationId = existingOrg.id;
      } else {
        // Create new organization
        const { data: newOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: data.ownerName,
            state_province: data.territory || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (orgError) throw orgError;
        organizationId = newOrg.id;
      }
    }
    
    // Create contact if phone number is provided
    let contactId = null;
    if (data.phoneNumber && organizationId) {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          organization_id: organizationId,
          phone_primary: data.phoneNumber,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (!contactError && newContact) {
        contactId = newContact.id;
      }
    }
    
    // Get user ID from username (case-insensitive)
    let ownerId = null;
    if (data.username) {
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .or(`username.ilike.${data.username},email.ilike.${data.username}@getflash.io`)
        .single();
      
      if (user) {
        ownerId = user.id;
      }
    }
    
    // Create the deal
    const { data: newDeal, error: dealError } = await supabase
      .from("deals")
      .insert({
        name: data.ownerName,
        organization_id: organizationId,
        primary_contact_id: contactId,
        owner_id: ownerId,
        package_seen: data.packageSeen || false,
        decision_makers: data.decisionMakers || "",
        interest_level: data.interestLevel || 0,
        status: data.signedUp ? "won" : "open",
        lead_status: data.leadStatus || (data.signedUp ? "signed_up" : undefined),
        specific_needs: data.specificNeeds || "",
        stage: "initial_contact",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        organization:organizations!organization_id(name, state_province),
        primary_contact:contacts!primary_contact_id(phone_primary),
        owner:users!owner_id(email, username)
      `)
      .single();
    
    if (dealError) throw dealError;
    
    return mapDealToSubmission(newDeal);
  } catch (error) {
    console.error("Error creating submission in Supabase:", error);
    throw error;
  }
}

export async function updateSubmission(id: number | string, data: Partial<Submission>): Promise<Submission> {
  try {
    console.log("Updating submission in Supabase:", id, data);
    
    // First, get the current deal to find related IDs
    const { data: currentDeal } = await supabase
      .from("deals")
      .select("organization_id, primary_contact_id, owner_id")
      .eq("id", id)
      .single();
    
    if (!currentDeal) throw new Error("Deal not found");

    // Update organization name if changed
    if (data.ownerName !== undefined && currentDeal.organization_id) {
      const { error: orgError } = await supabase
        .from("organizations")
        .update({ 
          name: data.ownerName,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentDeal.organization_id);
      
      if (orgError) {
        console.error("Error updating organization:", orgError);
      }
    }

    // Update territory in organization if changed
    if (data.territory !== undefined && currentDeal.organization_id) {
      const { error: territoryError } = await supabase
        .from("organizations")
        .update({ 
          state_province: data.territory,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentDeal.organization_id);
      
      if (territoryError) {
        console.error("Error updating territory:", territoryError);
      }
    }

    // Update phone number in contact if changed
    if (data.phoneNumber !== undefined && currentDeal.primary_contact_id) {
      const { error: contactError } = await supabase
        .from("contacts")
        .update({ 
          phone_primary: data.phoneNumber,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentDeal.primary_contact_id);
      
      if (contactError) {
        console.error("Error updating contact:", contactError);
      }
    }

    // Handle username/owner change
    let newOwnerId = currentDeal.owner_id;
    if (data.username !== undefined) {
      // Look up the new owner by username (case-insensitive)
      const { data: newOwner } = await supabase
        .from("users")
        .select("id")
        .or(`username.ilike.${data.username},email.ilike.${data.username}@getflash.io`)
        .single();
      
      if (newOwner) {
        newOwnerId = newOwner.id;
      }
    }

    // Update deal fields
    const updateData: any = {};
    if (data.ownerName !== undefined) updateData.name = data.ownerName;
    if (newOwnerId !== currentDeal.owner_id) updateData.owner_id = newOwnerId;
    if (data.packageSeen !== undefined) updateData.package_seen = data.packageSeen;
    if (data.decisionMakers !== undefined) updateData.decision_makers = data.decisionMakers;
    if (data.interestLevel !== undefined) updateData.interest_level = data.interestLevel;
    if (data.signedUp !== undefined) updateData.status = data.signedUp ? "won" : "open";
    if (data.leadStatus !== undefined) updateData.lead_status = data.leadStatus;
    if (data.specificNeeds !== undefined) updateData.specific_needs = data.specificNeeds;

    const { data: updatedDeal, error } = await supabase
      .from("deals")
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select(
        `
        *,
        organization:organizations!organization_id(name, state_province),
        primary_contact:contacts!primary_contact_id(phone_primary),
        owner:users!owner_id(email, username)
      `
      )
      .single();

    if (error) throw error;
    if (!updatedDeal) throw new Error("Failed to update submission");

    return mapDealToSubmission(updatedDeal);
  } catch (error) {
    console.error(`Error updating submission ${id} in Supabase:`, error);
    throw error;
  }
}

export async function deleteSubmission(id: number | string): Promise<void> {
  try {
    const { error } = await supabase.from("deals").delete().eq("id", id);

    if (error) throw error;
  } catch (error) {
    console.error(`Error deleting submission ${id} from Supabase:`, error);
    throw error;
  }
}

export async function getSubmissionStats(): Promise<SubmissionStats> {
  try {
    // Get total count
    const { count: totalCount, error: totalError } = await supabase.from("deals").select("*", { count: "exact", head: true });

    if (totalError) throw totalError;

    // Get signed up count (won deals)
    const { count: signedUpCount, error: signedError } = await supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won");

    if (signedError) throw signedError;

    // Get package seen count
    const { count: packageSeenCount, error: packageError } = await supabase.from("deals").select("*", { count: "exact", head: true }).eq("package_seen", true);

    if (packageError) throw packageError;

    // Get average interest level
    const { data: interestData, error: interestError } = await supabase.from("deals").select("interest_level");

    if (interestError) throw interestError;

    const totalInterest = (interestData || []).reduce((sum: number, item: any) => sum + (item.interest_level || 0), 0);
    const avgInterestLevel = interestData?.length ? totalInterest / interestData.length : 0;

    return {
      total: totalCount || 0,
      signedUp: signedUpCount || 0,
      avgInterestLevel: avgInterestLevel,
      interestedByMonth: [], // TODO: Implement monthly stats if needed
      packageSeenPercentage: totalCount ? ((packageSeenCount || 0) / totalCount) * 100 : 0,
    };
  } catch (error) {
    console.error("Error fetching submission stats from Supabase:", error);
    throw error;
  }
}
