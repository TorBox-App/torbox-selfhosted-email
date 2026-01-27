import { auth } from "@wraps/auth";
import { awsAccount, batchSend, db, template } from "@wraps/db";
import { and, count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { queryEmailEvents } from "@/lib/aws/dynamodb";
import { getOrganizationWithMembership } from "@/lib/organization";
import { GettingStartedDashboard } from "./components/getting-started-dashboard";

type OrganizationDashboardProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export type SetupStatus = {
  hasAwsAccount: boolean;
  hasVerifiedDomain: boolean;
  hasSentEmail: boolean;
  hasTemplate: boolean;
  hasBroadcast: boolean;
  verifiedDomains: string[];
  awsRegion: string | null;
  emailCount: number;
};

type AwsAccountRecord = {
  id: string;
  isVerified: boolean;
  region: string;
  features: unknown;
};

type AccountFeatures = {
  email?: {
    identities?: Array<{
      identity: string;
      type: "DOMAIN" | "EMAIL_ADDRESS";
    }>;
  };
} | null;

/** Extract verified domains from a single AWS account */
function extractDomainsFromAccount(account: AwsAccountRecord): string[] {
  const features = account.features as AccountFeatures;
  const identities = features?.email?.identities || [];
  return identities.filter((i) => i.type === "DOMAIN").map((i) => i.identity);
}

/** Get domains and region from verified accounts */
function getDomainsAndRegion(accounts: AwsAccountRecord[]): {
  verifiedDomains: string[];
  awsRegion: string | null;
} {
  const verifiedDomains: string[] = [];
  let awsRegion: string | null = null;

  for (const account of accounts) {
    if (account.isVerified) {
      awsRegion = account.region;
      verifiedDomains.push(...extractDomainsFromAccount(account));
    }
  }

  return { verifiedDomains, awsRegion };
}

/** Check if any emails have been sent across verified accounts */
async function checkEmailsSent(
  accounts: AwsAccountRecord[]
): Promise<{ hasSentEmail: boolean; emailCount: number }> {
  for (const account of accounts) {
    if (!account.isVerified) {
      continue;
    }

    try {
      const events = await queryEmailEvents({
        awsAccountId: account.id,
        startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endTime: new Date(),
        limit: 10,
      });
      if (events.length > 0) {
        return { hasSentEmail: true, emailCount: events.length };
      }
    } catch {
      // Account may not have DynamoDB table yet, continue
    }
  }

  return { hasSentEmail: false, emailCount: 0 };
}

/** Check if organization has any templates */
async function checkHasTemplates(organizationId: string): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(template)
    .where(eq(template.organizationId, organizationId));
  return (result?.count ?? 0) > 0;
}

/** Check if organization has any email broadcasts */
async function checkHasBroadcasts(organizationId: string): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(batchSend)
    .where(
      and(
        eq(batchSend.organizationId, organizationId),
        eq(batchSend.channel, "email")
      )
    );
  return (result?.count ?? 0) > 0;
}

async function getSetupStatus(organizationId: string): Promise<SetupStatus> {
  // Get AWS accounts for this organization
  const accounts = await db.query.awsAccount.findMany({
    where: eq(awsAccount.organizationId, organizationId),
  });

  const hasAwsAccount =
    accounts.length > 0 && accounts.some((a) => a.isVerified);

  // Get domain and region info
  const { verifiedDomains, awsRegion } = getDomainsAndRegion(accounts);
  const hasVerifiedDomain = verifiedDomains.length > 0;

  // Check email, template, and broadcast status in parallel
  const [emailStatus, hasTemplate, hasBroadcast] = await Promise.all([
    checkEmailsSent(accounts),
    checkHasTemplates(organizationId),
    checkHasBroadcasts(organizationId),
  ]);

  return {
    hasAwsAccount,
    hasVerifiedDomain,
    hasSentEmail: emailStatus.hasSentEmail,
    hasTemplate,
    hasBroadcast,
    verifiedDomains,
    awsRegion,
    emailCount: emailStatus.emailCount,
  };
}

export default async function OrganizationDashboard({
  params,
}: OrganizationDashboardProps) {
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

  const setupStatus = await getSetupStatus(orgWithMembership.id);

  // Calculate completion percentage
  const requiredSteps = [
    setupStatus.hasAwsAccount,
    setupStatus.hasVerifiedDomain,
    setupStatus.hasSentEmail,
  ];
  const completedRequired = requiredSteps.filter(Boolean).length;
  const completionPercent = Math.round(
    (completedRequired / requiredSteps.length) * 100
  );

  // If all required steps are complete, redirect to emails page
  if (completionPercent === 100) {
    redirect(`/${orgSlug}/emails`);
  }

  return (
    <GettingStartedDashboard
      completionPercent={completionPercent}
      organizationName={orgWithMembership.name}
      orgSlug={orgSlug}
      setupStatus={setupStatus}
    />
  );
}
