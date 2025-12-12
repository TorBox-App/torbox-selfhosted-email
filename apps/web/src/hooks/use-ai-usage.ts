import { useQuery } from "@tanstack/react-query";

type AiUsageResponse = {
  current: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  planId: string;
  warning: string | null;
};

/**
 * Hook to fetch and track AI usage for an organization
 */
export function useAiUsage(orgSlug: string) {
  return useQuery<AiUsageResponse>({
    queryKey: ["ai-usage", orgSlug],
    queryFn: async () => {
      const response = await fetch(`/api/${orgSlug}/ai/usage`);
      if (!response.ok) {
        throw new Error("Failed to fetch AI usage");
      }
      return response.json();
    },
    // Refetch every 30 seconds to keep usage up to date
    refetchInterval: 30_000,
    // Don't refetch on window focus (to avoid too many requests)
    refetchOnWindowFocus: false,
    // Keep stale data while refetching
    staleTime: 10_000,
  });
}

/**
 * Invalidate AI usage cache (call after making an AI request)
 */
export function getAiUsageQueryKey(orgSlug: string) {
  return ["ai-usage", orgSlug];
}
