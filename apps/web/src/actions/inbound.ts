"use server";

import { revalidatePath } from "next/cache";
import { verifyOrgAccess } from "@/actions/shared/verify-org-access";

export async function revalidateInboundEmails(organizationId: string) {
  const access = await verifyOrgAccess(organizationId);
  if (!access) return { success: false as const, error: "No access" };
  revalidatePath(`/${access.orgSlug}/emails/inbound`, "page");
  return { success: true as const };
}
