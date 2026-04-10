"use server";

import { sendMobileRescueEmail } from "@wraps/email/emails/mobile-rescue";
import { getPostHogClient } from "@/lib/posthog-server";
import { verifyOrgAccess } from "./shared/verify-org-access";

export async function sendDesktopLink(organizationId: string) {
  const access = await verifyOrgAccess(organizationId);
  if (!access) {
    return { success: false as const, error: "No access" };
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.wraps.dev"}/${access.orgSlug}/onboarding`;

  await sendMobileRescueEmail({
    to: access.userEmail,
    dashboardUrl,
    orgName: access.orgSlug,
  });

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: access.userId,
    event: "mobile_signup_rescue_sent",
    properties: {
      organization_id: organizationId,
      org_slug: access.orgSlug,
    },
  });

  return { success: true as const };
}
