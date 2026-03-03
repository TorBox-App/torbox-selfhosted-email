"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CompactProgress } from "./compact-progress";
import { SankeyChart } from "./sankey-chart";

type BatchStatsProps = {
  batch: {
    id: string;
    status: string;
    channel: string;
    totalRecipients: number;
    processedRecipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    failed: number;
    hardBounced: number;
    softBounced: number;
    startedAt: Date | null;
    completedAt: Date | null;
  };
  clicksByUrl?: Array<{ url: string; count: number }>;
  organizationId: string;
};

export function BatchStats({ batch, clicksByUrl }: BatchStatsProps) {
  const hasData = batch.sent > 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <CompactProgress
          completedAt={batch.completedAt}
          processedRecipients={batch.processedRecipients}
          startedAt={batch.startedAt}
          status={batch.status}
          totalRecipients={batch.totalRecipients}
        />
        {hasData && (
          <SankeyChart
            bounced={batch.bounced}
            channel={batch.channel as "email" | "sms"}
            clicked={batch.clicked}
            clicksByUrl={clicksByUrl}
            complained={batch.complained}
            delivered={batch.delivered}
            failed={batch.failed}
            hardBounced={batch.hardBounced}
            opened={batch.opened}
            sent={batch.sent}
            softBounced={batch.softBounced}
          />
        )}
      </CardContent>
    </Card>
  );
}
