import { useQuery } from "@tanstack/react-query";

type EventUsageResponse = {
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
 * Hook to fetch and track event usage for an organization
 *
 * Tracked event limits (2026 pricing model):
 * - Starter: 50,000 tracked events/month
 * - Growth: 250,000 tracked events/month
 * - Scale: 1,000,000 tracked events/month
 * - Enterprise: Unlimited
 */
export function useEventUsage(orgSlug: string) {
  return useQuery<EventUsageResponse>({
    queryKey: ["event-usage", orgSlug],
    queryFn: async () => {
      const response = await fetch(`/api/${orgSlug}/events/usage`);
      if (!response.ok) {
        throw new Error("Failed to fetch event usage");
      }
      return response.json();
    },
    // Refetch every minute to keep usage up to date
    refetchInterval: 60_000,
    // Don't refetch on window focus (to avoid too many requests)
    refetchOnWindowFocus: false,
    // Keep stale data while refetching
    staleTime: 30_000,
  });
}

/**
 * Get query key for event usage (for cache invalidation)
 */
export function getEventUsageQueryKey(orgSlug: string) {
  return ["event-usage", orgSlug];
}
