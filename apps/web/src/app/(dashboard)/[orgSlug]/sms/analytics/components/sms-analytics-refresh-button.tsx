"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshButton } from "@/components/ui/refresh-button";

export function SMSAnalyticsRefreshButton() {
  const queryClient = useQueryClient();

  function handleRefresh() {
    return queryClient.invalidateQueries({ queryKey: ["analytics", "sms"] });
  }

  return <RefreshButton onRefresh={handleRefresh} />;
}
