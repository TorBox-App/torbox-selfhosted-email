import { auth } from "@wraps/auth";
import { redirect } from "next/navigation";
import { getOrganizationWithMembership } from "@/lib/organization";
import { SMSDeliverabilityChart } from "./components/sms-deliverability-chart";
import { SMSOverview } from "./components/sms-overview";
import { SMSPhoneNumbers } from "./components/sms-phone-numbers";
import { SMSRecentActivity } from "./components/sms-recent-activity";
import { SMSRegistrations } from "./components/sms-registrations";
import { SMSSpendLimits } from "./components/sms-spend-limits";
import { SMSVolumeChart } from "./components/sms-volume-chart";

type SMSAnalyticsPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function SMSAnalyticsPage({
  params,
}: SMSAnalyticsPageProps) {
  const { orgSlug } = await params;
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    redirect("/");
  }

  return (
    <>
      {/* Page Title and Description */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-2xl tracking-tight">SMS Analytics</h1>
          <p className="text-muted-foreground">
            Monitor your SMS messaging performance and delivery metrics
          </p>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="@container/main space-y-6 px-4 lg:px-6">
        {/* Overview Stats */}
        <SMSOverview orgSlug={orgSlug} />

        {/* Main Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SMSVolumeChart orgSlug={orgSlug} />
          <SMSDeliverabilityChart orgSlug={orgSlug} />
        </div>

        {/* Phone Numbers and Registrations */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SMSPhoneNumbers orgSlug={orgSlug} />
          <SMSRegistrations orgSlug={orgSlug} />
        </div>

        {/* Spend Limits */}
        <SMSSpendLimits orgSlug={orgSlug} />

        {/* Recent Activity */}
        <SMSRecentActivity orgSlug={orgSlug} />
      </div>
    </>
  );
}
