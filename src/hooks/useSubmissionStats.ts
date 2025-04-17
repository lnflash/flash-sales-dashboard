'use client';

import { useQuery } from '@tanstack/react-query';
import { SubmissionStats } from '@/types/submission';
import { getSubmissionStats } from '@/lib/api';

export function useSubmissionStats() {
  // Always use real API data
  console.log('Stats hook - Current environment:', process.env.NEXT_PUBLIC_APP_ENV);
  
  const { data, isLoading, error, refetch } = useQuery<SubmissionStats>({
    queryKey: ['submissionStats'],
    queryFn: async () => {
      return getSubmissionStats();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  return {
    stats: data,
    isLoading,
    error,
    refetch,
  };
}