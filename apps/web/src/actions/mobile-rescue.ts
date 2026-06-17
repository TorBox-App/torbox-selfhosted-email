"use server";

import { sendMobileRescueEmail } from "@wraps/email/emails/mobile-rescue";
import { getPostHogClient } from "@/lib/posthog-server";
import { orgAction } from "./shared/org-action";

export const sendDesktopLink = orgAction(
  {
    name: "sendDesktopLink",
    resource: "contacts",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to send email",
  },
  async (ctx, organizationId: string) => {
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.wraps.dev"}/${ctx.access.orgSlug}/onboarding`;

    try {
      await sendMobileRescueEmail({
        to: ctx.access.userEmail,
        dashboardUrl,
        orgName: ctx.access.orgSlug,
      });
    } catch {
      return { success: false as const, error: "Failed to send email" };
    }

    try {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: ctx.access.userId,
        event: "mobile_signup_rescue_sent",
        properties: {
          organization_id: organizationId,
          org_slug: ctx.access.orgSlug,
        },
      });
    } catch (err) {
      ctx.log.error({ err }, "Failed to capture mobile rescue analytics");
    }

    return { success: true as const };
  }
);
