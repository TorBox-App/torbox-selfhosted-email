"use client";

import { Mail } from "lucide-react";
import { UsageCard } from "@/components/usage-card";
import { useMessageUsage } from "@/hooks/use-message-usage";

type MessageUsageCardProps = {
  orgSlug: string;
  className?: string;
};

export function MessageUsageCard({
  orgSlug,
  className,
}: MessageUsageCardProps) {
  const { data: usage, isLoading } = useMessageUsage(orgSlug);

  return (
    <UsageCard
      className={className}
      description="Emails + SMS this month"
      icon={Mail}
      isLoading={isLoading}
      title="Message Usage"
      upgradeHref={`/${orgSlug}/settings/billing`}
      usage={usage}
    />
  );
}
