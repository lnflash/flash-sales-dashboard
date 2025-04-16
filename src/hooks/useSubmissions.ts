'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Submission, 
  SubmissionFilters, 
  PaginationState, 
  SortOption 
} from '@/types/submission';
import { getSubmissions, getMockSubmissions } from '@/lib/api';

export function useSubmissions(
  initialFilters: SubmissionFilters = {},
  initialPagination: PaginationState = { pageIndex: 0, pageSize: 10 },
  initialSorting: SortOption[] = [{ id: 'timestamp', desc: true }]
) {
  const [filters, setFilters] = useState<SubmissionFilters>(initialFilters);
  const [pagination, setPagination] = useState<PaginationState>(initialPagination);
  const [sorting, setSorting] = useState<SortOption[]>(initialSorting);
  
  // For development, we'll use mock data
  const useMockData = process.env.NEXT_PUBLIC_APP_ENV !== 'production';
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['submissions', filters, pagination, sorting],
    queryFn: async () => {
      if (useMockData) {
        const allSubmissions = await getMockSubmissions();
        
        // Apply filters
        let filteredData = [...allSubmissions];
        
        // Search filter
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          filteredData = filteredData.filter(submission => 
            submission.ownerName.toLowerCase().includes(searchTerm) ||
            (submission.decisionMakers || '').toLowerCase().includes(searchTerm) ||
            (submission.specificNeeds || '').toLowerCase().includes(searchTerm) ||
            (submission.username || '').toLowerCase().includes(searchTerm)
          );
        }
        
        // Interest level filter
        if (filters.interestLevel && filters.interestLevel.length > 0) {
          filteredData = filteredData.filter(submission => 
            filters.interestLevel?.includes(submission.interestLevel)
          );
        }
        
        // Signed up filter
        if (filters.signedUp !== undefined) {
          filteredData = filteredData.filter(submission => 
            submission.signedUp === filters.signedUp
          );
        }
        
        // Package seen filter
        if (filters.packageSeen !== undefined) {
          filteredData = filteredData.filter(submission => 
            submission.packageSeen === filters.packageSeen
          );
        }
        
        // Date range filter
        if (filters.dateRange?.start || filters.dateRange?.end) {
          const startDate = filters.dateRange?.start 
            ? new Date(filters.dateRange.start) 
            : null;
          const endDate = filters.dateRange?.end 
            ? new Date(filters.dateRange.end) 
            : null;
            
          filteredData = filteredData.filter(submission => {
            const submissionDate = new Date(submission.timestamp);
            if (startDate && submissionDate < startDate) return false;
            if (endDate) {
              // End date should include the whole day, so set it to the end of the day
              const endOfDay = new Date(endDate);
              endOfDay.setHours(23, 59, 59, 999);
              if (submissionDate > endOfDay) return false;
            }
            return true;
          });
        }
        
        // Apply sorting
        if (sorting.length > 0) {
          const { id, desc } = sorting[0];
          filteredData.sort((a, b) => {
            if (a[id as keyof Submission] < b[id as keyof Submission]) {
              return desc ? 1 : -1;
            }
            if (a[id as keyof Submission] > b[id as keyof Submission]) {
              return desc ? -1 : 1;
            }
            return 0;
          });
        }
        
        // Apply pagination
        const start = pagination.pageIndex * pagination.pageSize;
        const end = start + pagination.pageSize;
        const paginatedData = filteredData.slice(start, end);
        
        // Return similar structure to what an API would return
        return {
          data: paginatedData,
          totalCount: filteredData.length,
          pageCount: Math.ceil(filteredData.length / pagination.pageSize),
        };
      } else {
        // Use real API in production
        return getSubmissions(filters, pagination, sorting);
      }
    },
    staleTime: 1000 * 60, // 1 minute
  });
  
  const handleFilterChange = (newFilters: SubmissionFilters) => {
    // Reset to the first page when filters change
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    setFilters(newFilters);
  };
  
  const resetFilters = () => {
    setFilters({});
    setPagination(initialPagination);
  };
  
  // Apply initial filters only once
  useEffect(() => {
    setFilters(initialFilters);
  }, []);
  
  return {
    submissions: data?.data || [],
    totalCount: data?.totalCount || 0,
    pageCount: data?.pageCount || 0,
    isLoading,
    error,
    filters,
    pagination,
    sorting,
    setFilters: handleFilterChange,
    setPagination,
    setSorting,
    resetFilters,
    refetch,
  };
}