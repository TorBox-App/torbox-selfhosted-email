"use server";

import { sendMobileRescueEmail } from "@wraps/email/emails/mobile-rescue";
import { resolveAppUrl } from "@wraps/email/lib/app-url";
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
    let appUrl: string;
    try {
      appUrl = resolveAppUrl();
    } catch (error) {
      // orgAction's catch would flatten this to "Failed to send email"; the
      // message names the environment variable a self-hosted operator must set.
      ctx.log.error({ err: error }, "Dashboard URL is not configured");
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
    const dashboardUrl = `${appUrl}/${ctx.access.orgSlug}/onboarding`;

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
