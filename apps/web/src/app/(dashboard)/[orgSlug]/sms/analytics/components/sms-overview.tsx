"use client";

import { CheckCircle, MessageSquare, TrendingUp, XCircle } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { useSMSAnalyticsOverview } from "../hooks/use-sms-analytics";

export function SMSOverview({ orgSlug }: { orgSlug: string }) {
  const { data, isLoading, error } = useSMSAnalyticsOverview(orgSlug, 30);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-destructive text-sm">
          Failed to load SMS analytics overview. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<MessageSquare className="h-6 w-6" />}
        isLoading={isLoading}
        title="Total Sent"
        trend="up"
        value={data ? data.totalSent.toLocaleString() : "0"}
      />
      <StatCard
        icon={<CheckCircle className="h-6 w-6" />}
        isLoading={isLoading}
        title="Delivered"
        trend="up"
        value={data ? data.totalDelivered.toLocaleString() : "0"}
      />
      <StatCard
        icon={<TrendingUp className="h-6 w-6" />}
        isLoading={isLoading}
        title="Delivery Rate"
        trend="up"
        value={data ? `${data.deliveryRate.toFixed(1)}%` : "0%"}
      />
      <StatCard
        icon={<XCircle className="h-6 w-6" />}
        isLoading={isLoading}
        title="Failure Rate"
        trend="down"
        value={data ? `${data.failureRate.toFixed(1)}%` : "0%"}
      />
    </div>
  );
}
