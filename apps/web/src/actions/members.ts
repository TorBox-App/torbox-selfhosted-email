"use server";

import { awsAccount, contact, db, messageSend, template } from "@wraps/db";
import { invitation, member, user } from "@wraps/db/schema/auth";
import { sendInvitationEmail } from "@wraps/email/emails/invitation";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { trackTeammateInvited } from "@/lib/activation-tracking";
import { createActionLogger, serializeError } from "@/lib/logger";
import { VALID_ROLES } from "@/lib/preset-roles";
import { checkPermission } from "./shared/permissions";
import { verifyOrgAccess } from "./shared/verify-org-access";

export type MemberWithUser = {
  id: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  inviter: {
    id: string;
    name: string;
    email: string;
  };
};

export type ListMembersResult =
  | {
      success: true;
      members: MemberWithUser[];
      invitations: PendingInvitation[];
    }
  | {
      success: false;
      error: string;
    };

/**
 * List all members and pending invitations for an organization
 */
export async function listMembers(
  organizationId: string
): Promise<ListMembersResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return { success: false, error: "No access" };
    }

    // Fetch all members with user info using join instead of with
    const membersData = await db
      .select({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, organizationId))
      .orderBy(member.createdAt);

    // Fetch pending invitations using join
    const invitationsData = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        inviterId: user.id,
        inviterName: user.name,
        inviterEmail: user.email,
      })
      .from(invitation)
      .innerJoin(user, eq(invitation.inviterId, user.id))
      .where(
        and(
          eq(invitation.organizationId, organizationId),
          eq(invitation.status, "pending")
        )
      )
      .orderBy(invitation.expiresAt);

    return {
      success: true,
      members: membersData.map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt,
        user: {
          id: m.userId,
          name: m.userName,
          email: m.userEmail,
          image: m.userImage,
        },
      })),
      invitations: invitationsData.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        inviter: {
          id: inv.inviterId,
          name: inv.inviterName,
          email: inv.inviterEmail,
        },
      })),
    };
  } catch (error) {
    const log = createActionLogger("listMembers", { orgSlug: organizationId });
    log.error({ err: serializeError(error) }, "Failed to list members");
    return {
      success: false,
      error: "Failed to fetch members",
    };
  }
}

export type UpdateMemberRoleResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Update a member's role (only owners and admins can do this)
 */
export async function updateMemberRole(
  memberId: string,
  newRole: string,
  organizationId: string
): Promise<UpdateMemberRoleResult> {
  if (!VALID_ROLES.has(newRole)) {
    return { success: false, error: "Invalid role" };
  }

  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return { success: false, error: "No access" };
    }

    const changeRoleError = checkPermission(access.role, "members", [
      "changeRole",
    ]);
    if (changeRoleError) return changeRoleError;

    // Get the target member (scoped to org to prevent cross-org IDOR)
    const targetMember = await db.query.member.findFirst({
      where: and(
        eq(member.id, memberId),
        eq(member.organizationId, organizationId)
      ),
    });

    if (!targetMember) {
      return {
        success: false,
        error: "Member not found",
      };
    }

    // Prevent non-owners from changing owner roles or making someone an owner
    if (
      access.role !== "owner" &&
      (targetMember.role === "owner" || newRole === "owner")
    ) {
      return {
        success: false,
        error: "Only owners can change owner roles",
      };
    }

    // Prevent users from changing their own role
    if (targetMember.userId === access.userId) {
      return {
        success: false,
        error: "You cannot change your own role",
      };
    }

    // Update the role (scoped to org to prevent cross-org IDOR)
    await db
      .update(member)
      .set({ role: newRole })
      .where(
        and(eq(member.id, memberId), eq(member.organizationId, organizationId))
      );

    revalidatePath(`/${access.orgSlug}/settings/members`);

    return {
      success: true,
    };
  } catch (error) {
    const log = createActionLogger("updateMemberRole", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), memberId, newRole },
      "Failed to update member role"
    );
    return {
      success: false,
      error: "Failed to update member role",
    };
  }
}

export type InviteMemberResult =
  | {
      success: true;
      invitationId: string;
    }
  | {
      success: false;
      error: string;
    };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Invite a new member to the organization
 */
export async function inviteMember(
  email: string,
  role: string,
  organizationId: string
): Promise<InviteMemberResult> {
  if (!VALID_ROLES.has(role)) {
    return { success: false, error: "Invalid role" };
  }
  if (role === "owner") {
    return {
      success: false,
      error: "Owner role cannot be assigned via invitation",
    };
  }

  try {
    if (!(email && EMAIL_REGEX.test(email.trim()))) {
      return { success: false, error: "Invalid email address" };
    }

    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return { success: false, error: "No access" };
    }

    const inviteError = checkPermission(access.role, "members", ["invite"]);
    if (inviteError) return inviteError;

    // Check if user is already a member
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email),
    });

    if (existingUser) {
      const existingMember = await db.query.member.findFirst({
        where: and(
          eq(member.organizationId, organizationId),
          eq(member.userId, existingUser.id)
        ),
      });

      if (existingMember) {
        return {
          success: false,
          error: "This user is already a member of the organization",
        };
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await db.query.invitation.findFirst({
      where: and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.email, email),
        eq(invitation.status, "pending")
      ),
    });

    if (existingInvitation) {
      return {
        success: false,
        error: "An invitation has already been sent to this email",
      };
    }

    // Create the invitation
    const [newInvitation] = await db
      .insert(invitation)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        email,
        role,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        inviterId: access.userId,
      })
      .returning();

    if (!newInvitation) {
      return {
        success: false,
        error: "Failed to create invitation",
      };
    }

    // Get organization details for email
    const org = await db.query.organization.findFirst({
      where: (orgs, { eq: eqOp }) => eqOp(orgs.id, organizationId),
    });

    if (!org) {
      return {
        success: false,
        error: "Organization not found",
      };
    }

    // Gather workspace context for the enriched invite email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      const [templateResult, contactResult, sentResult, accounts] =
        await Promise.all([
          db
            .select({ count: count() })
            .from(template)
            .where(eq(template.organizationId, organizationId)),
          db
            .select({ count: count() })
            .from(contact)
            .where(eq(contact.organizationId, organizationId)),
          db
            .select({ count: count() })
            .from(messageSend)
            .where(
              and(
                eq(messageSend.organizationId, organizationId),
                eq(messageSend.status, "sent")
              )
            ),
          db.query.awsAccount.findMany({
            where: eq(awsAccount.organizationId, organizationId),
            columns: { isVerified: true, features: true },
          }),
        ]);

      const verifiedDomains: string[] = [];
      for (const a of accounts) {
        const features = a.features as {
          email?: { identities?: Array<{ type: string; identity: string }> };
        } | null;
        for (const id of features?.email?.identities ?? []) {
          if (id.type === "DOMAIN") {
            verifiedDomains.push(id.identity);
          }
        }
      }

      await sendInvitationEmail({
        to: email,
        inviteLink: `${appUrl}/invitations/${newInvitation.id}/accept`,
        declineLink: `${appUrl}/invitations/${newInvitation.id}/decline`,
        organizationName: org.name,
        inviterName: access.userName ?? access.userEmail,
        role,
        workspaceContext: {
          templateCount: templateResult[0]?.count ?? 0,
          contactCount: contactResult[0]?.count ?? 0,
          hasAwsAccount: accounts.length > 0,
          verifiedDomains,
          hasSentEmail: (sentResult[0]?.count ?? 0) > 0,
        },
      });
    } catch (emailError) {
      const log = createActionLogger("inviteMember", {
        orgSlug: organizationId,
      });
      log.error(
        { err: serializeError(emailError), email },
        "Failed to send invitation email"
      );
      // Continue even if email fails - the invitation is still created
    }

    await trackTeammateInvited(access.userId, organizationId, {
      invitedEmail: email,
      role,
    });

    revalidatePath(`/${access.orgSlug}/settings/members`);

    return {
      success: true,
      invitationId: newInvitation.id,
    };
  } catch (error) {
    const log = createActionLogger("inviteMember", { orgSlug: organizationId });
    log.error(
      { err: serializeError(error), email, role },
      "Failed to invite member"
    );
    return {
      success: false,
      error: "Failed to send invitation",
    };
  }
}

export type RemoveMemberResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Remove a member from the organization
 */
export async function removeMember(
  memberId: string,
  organizationId: string
): Promise<RemoveMemberResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return { success: false, error: "No access" };
    }

    const removeError = checkPermission(access.role, "members", ["remove"]);
    if (removeError) return removeError;

    // Get the target member (scoped to org to prevent cross-org IDOR)
    const targetMember = await db.query.member.findFirst({
      where: and(
        eq(member.id, memberId),
        eq(member.organizationId, organizationId)
      ),
    });

    if (!targetMember) {
      return {
        success: false,
        error: "Member not found",
      };
    }

    // Prevent non-owners from removing owners
    if (access.role !== "owner" && targetMember.role === "owner") {
      return {
        success: false,
        error: "Only owners can remove other owners",
      };
    }

    // Prevent users from removing themselves
    if (targetMember.userId === access.userId) {
      return {
        success: false,
        error: "You cannot remove yourself from the organization",
      };
    }

    // Remove the member (scoped to org to prevent cross-org IDOR)
    await db
      .delete(member)
      .where(
        and(eq(member.id, memberId), eq(member.organizationId, organizationId))
      );

    revalidatePath(`/${access.orgSlug}/settings/members`);

    return {
      success: true,
    };
  } catch (error) {
    const log = createActionLogger("removeMember", { orgSlug: organizationId });
    log.error(
      { err: serializeError(error), memberId },
      "Failed to remove member"
    );
    return {
      success: false,
      error: "Failed to remove member",
    };
  }
}

export type CancelInvitationResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(
  invitationId: string,
  organizationId: string
): Promise<CancelInvitationResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return { success: false, error: "No access" };
    }

    const cancelInviteError = checkPermission(access.role, "members", [
      "invite",
    ]);
    if (cancelInviteError) return cancelInviteError;

    // Verify invitation belongs to this org before deleting (prevent cross-org IDOR)
    const targetInvitation = await db.query.invitation.findFirst({
      where: and(
        eq(invitation.id, invitationId),
        eq(invitation.organizationId, organizationId)
      ),
    });

    if (!targetInvitation) {
      return {
        success: false,
        error: "Invitation not found",
      };
    }

    // Delete the invitation (scoped to org)
    await db
      .delete(invitation)
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.organizationId, organizationId)
        )
      );

    revalidatePath(`/${access.orgSlug}/settings/members`);

    return {
      success: true,
    };
  } catch (error) {
    const log = createActionLogger("cancelInvitation", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), invitationId },
      "Failed to cancel invitation"
    );
    return {
      success: false,
      error: "Failed to cancel invitation",
    };
  }
}
