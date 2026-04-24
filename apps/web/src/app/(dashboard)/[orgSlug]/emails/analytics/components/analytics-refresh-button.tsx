"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshButton } from "@/components/ui/refresh-button";

type AnalyticsRefreshButtonProps = {
  orgSlug: string;
};

export function AnalyticsRefreshButton({
  orgSlug,
}: AnalyticsRefreshButtonProps) {
  const queryClient = useQueryClient();

  function handleRefresh() {
    return queryClient.invalidateQueries({ queryKey: ["analytics"] });
  }

  return <RefreshButton onRefresh={handleRefresh} />;
}
