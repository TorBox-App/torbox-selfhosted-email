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
    revalidatePath(`/${ctx.access.orgSlug}/emails/inbound`, "page");
    return { success: true as const };
  }
);
