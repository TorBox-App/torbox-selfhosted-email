"use server";

import { revalidatePath } from "next/cache";
import { orgAction } from "./shared/org-action";

export const revalidateInboundEmails = orgAction(
  {
    name: "revalidateInboundEmails",
    resource: "contacts",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to revalidate inbound emails",
  },
  async (ctx, organizationId: string) => {
    try {
      revalidatePath(`/${ctx.access.orgSlug}/emails/inbound`, "page");
    } catch (err) {
      ctx.log.error({ err }, "Failed to revalidate inbound emails");
    }
    return { success: true as const };
  }
);
