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
    // Only refetch on invalidation (after AI requests)
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });
}

/**
 * Invalidate AI usage cache (call after making an AI request)
 */
export function getAiUsageQueryKey(orgSlug: string) {
  return ["ai-usage", orgSlug];
}
