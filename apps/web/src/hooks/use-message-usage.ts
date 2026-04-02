import { useQuery } from "@tanstack/react-query";

type MessageUsageResponse = {
  current: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  planId: string;
  threshold: "normal" | "warning" | "critical" | "exceeded";
  warning: string | null;
  action: "upgrade" | "view_usage" | null;
};

/**
 * Hook to fetch and track message usage for an organization
 *
 * Message limits (2026 pricing model):
 * - Free: 1,000 messages/month
 * - Starter: 10,000 messages/month
 * - Growth: 50,000 messages/month
 * - Scale: 250,000 messages/month
 */
export function useMessageUsage(orgSlug: string) {
  return useQuery<MessageUsageResponse>({
    queryKey: ["message-usage", orgSlug],
    queryFn: async () => {
      const response = await fetch(`/api/${orgSlug}/messages/usage`);
      if (!response.ok) {
        throw new Error("Failed to fetch message usage");
      }
      return response.json();
    },
    // Only refetch on invalidation (after sending broadcasts)
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });
}

/**
 * Get query key for message usage (for cache invalidation)
 */
export function getMessageUsageQueryKey(orgSlug: string) {
  return ["message-usage", orgSlug];
}
