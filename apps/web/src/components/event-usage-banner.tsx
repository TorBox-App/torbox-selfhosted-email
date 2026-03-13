"use client";

import { UsageBanner } from "@/components/usage-banner";
import { useEventUsage } from "@/hooks/use-event-usage";

type EventUsageBannerProps = {
  orgSlug: string;
};

export function EventUsageBanner({ orgSlug }: EventUsageBannerProps) {
  const { data: usage } = useEventUsage(orgSlug);

  return (
    <UsageBanner upgradeHref={`/${orgSlug}/settings/billing`} usage={usage} />
  );
}
