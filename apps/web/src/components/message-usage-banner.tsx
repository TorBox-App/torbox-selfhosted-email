"use client";

import { UsageBanner } from "@/components/usage-banner";
import { useMessageUsage } from "@/hooks/use-message-usage";

type MessageUsageBannerProps = {
  orgSlug: string;
};

export function MessageUsageBanner({ orgSlug }: MessageUsageBannerProps) {
  const { data: usage } = useMessageUsage(orgSlug);

  return (
    <UsageBanner upgradeHref={`/${orgSlug}/settings/billing`} usage={usage} />
  );
}
