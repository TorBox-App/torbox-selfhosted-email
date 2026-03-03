import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { headers } from "next/headers";

export type OrgAccess = {
  userId: string;
  userEmail: string;
  role: string;
  orgSlug: string;
};

/**
 * Verify user has access to organization.
 * Returns session user info + org membership, or null if unauthorized.
 */
export async function verifyOrgAccess(
  organizationId: string
): Promise<OrgAccess | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const membership = await db.query.member.findFirst({
    where: (m, { and, eq }) =>
      and(eq(m.organizationId, organizationId), eq(m.userId, session.user.id)),
    with: {
      organization: {
        columns: { slug: true },
      },
    },
  });

  if (!membership?.organization.slug) {
    return null;
  }

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    role: membership.role,
    orgSlug: membership.organization.slug,
  };
}
