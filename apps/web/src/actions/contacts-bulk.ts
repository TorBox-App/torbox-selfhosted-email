"use server";

import {
  auditLog,
  db,
  bulkDeleteContacts as dbBulkDeleteContacts,
  findContactByEmailHash,
  findContactsByEmailHashes,
  insertContact,
} from "@wraps/db";
import { trackContactsImported } from "@/lib/activation-tracking";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { createActionLogger } from "@/lib/logger";
import { checkContactLimit } from "@/lib/plan-limits";
import { revalidateContacts } from "./contacts";
import { hashEmail } from "./shared/hash";
import { checkPermission } from "./shared/permissions";
import { verifyOrgAccess } from "./shared/verify-org-access";

/**
 * Bulk create contacts from email addresses
 * Used to create contacts from email recipients
 */
export async function bulkCreateContactsFromEmails(
  organizationId: string,
  emails: string[]
): Promise<
  | { success: true; created: number; skipped: number; errors: string[] }
  | { success: false; error: string }
> {
  let orgSlug: string | undefined;
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["write"]);
    if (permError) return permError;
    orgSlug = access.orgSlug;

    if (emails.length === 0) {
      return { success: false, error: "No email addresses provided" };
    }

    // Deduplicate and normalize emails
    const uniqueEmails = [
      ...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean)),
    ];

    // Check contact limit
    const limitCheck = await checkContactLimit(organizationId);
    if (!limitCheck.allowed) {
      return {
        success: false,
        error:
          limitCheck.message ??
          "You've reached your contact limit. Please upgrade your plan.",
      };
    }

    // Check if we have room for all contacts
    const remainingSlots =
      limitCheck.limit === -1
        ? Number.POSITIVE_INFINITY
        : limitCheck.limit - limitCheck.current;

    if (uniqueEmails.length > remainingSlots) {
      return {
        success: false,
        error: `You can only add ${remainingSlots} more contact${remainingSlots === 1 ? "" : "s"} on your current plan.`,
      };
    }

    const auditCtx = await getAuditContext();

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Validate emails and check for duplicates outside the transaction
    type EmailTuple = { email: string; emailHash: string };
    const toInsert: EmailTuple[] = [];

    for (const email of uniqueEmails) {
      if (!email.includes("@")) {
        errors.push(`Invalid email: ${email}`);
        continue;
      }

      const emailHashValue = hashEmail(email);
      const existing = await findContactByEmailHash(
        emailHashValue,
        organizationId
      );
      if (existing) {
        skipped++;
        continue;
      }

      toInsert.push({ email, emailHash: emailHashValue });
    }

    // Insert all valid new contacts + audit in one transaction
    await db.transaction(async (tx) => {
      for (const { email, emailHash } of toInsert) {
        try {
          const result = await insertContact(
            {
              organizationId,
              email,
              emailHash,
              emailStatus: "active",
              emailVerifiedAt: new Date(),
              status: "active",
              confirmedAt: new Date(),
              createdBy: access.userId,
            },
            tx
          );
          if (result) {
            created++;
          } else {
            skipped++;
          }
        } catch (_err) {
          errors.push(`Failed to create contact for ${email}`);
        }
      }

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "contact.created_bulk",
          resource: "contact",
          metadata: { count: emails.length },
        })
      );
    });

    // Revalidate
    revalidateContacts(orgSlug);

    // Track activation event (fire-and-forget)
    if (created > 0) {
      trackContactsImported(access.userEmail, organizationId, {
        count: created,
        firstContact: { email: toInsert[0]?.email },
      });
    }

    return { success: true, created, skipped, errors };
  } catch (error) {
    const log = createActionLogger("bulkCreateContactsFromEmails", { orgSlug });
    log.error(
      { err: error, emailCount: emails.length },
      "Failed to bulk create contacts"
    );
    return { success: false, error: "Failed to create contacts" };
  }
}

/**
 * Check if email addresses already exist as contacts
 * Returns a map of email -> contactId for existing contacts
 */
export async function checkExistingContacts(
  organizationId: string,
  emails: string[]
): Promise<
  | { success: true; existing: Record<string, string> }
  | { success: false; error: string }
> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["read"]);
    if (permError) return permError;

    if (emails.length === 0) {
      return { success: true, existing: {} };
    }

    // Normalize emails and compute hashes
    const normalizedEmails = emails.map((e) => e.toLowerCase().trim());
    const emailHashes = normalizedEmails.map((e) => hashEmail(e));

    // Find existing contacts by email hash
    const existingContacts = await findContactsByEmailHashes(
      organizationId,
      emailHashes
    );

    // Build map of email -> contactId
    const existing: Record<string, string> = {};
    for (const c of existingContacts) {
      if (c.email) {
        existing[c.email.toLowerCase()] = c.id;
      }
    }

    return { success: true, existing };
  } catch (error) {
    const log = createActionLogger("checkExistingContacts", {
      orgSlug: organizationId,
    });
    log.error(
      { err: error, emailCount: emails.length },
      "Failed to check existing contacts"
    );
    return { success: false, error: "Failed to check contacts" };
  }
}

/**
 * Bulk delete contacts
 */
export async function bulkDeleteContacts(
  organizationId: string,
  contactIds: string[]
): Promise<
  { success: true; count: number } | { success: false; error: string }
> {
  let orgSlug: string | undefined;
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    orgSlug = access.orgSlug;

    const permError = checkPermission(access.role, "contacts", ["delete"]);
    if (permError) return permError;

    if (contactIds.length === 0) {
      return { success: false, error: "No contacts selected" };
    }

    const auditCtx = await getAuditContext();

    // Delete contacts + write audit log in one transaction
    await db.transaction(async (tx) => {
      await dbBulkDeleteContacts(contactIds, organizationId, tx);

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "contact.deleted_bulk",
          resource: "contact",
          metadata: { count: contactIds.length },
        })
      );
    });

    // Revalidate
    revalidateContacts(orgSlug);

    return { success: true, count: contactIds.length };
  } catch (error) {
    const log = createActionLogger("bulkDeleteContacts", { orgSlug });
    log.error(
      { err: error, count: contactIds.length },
      "Failed to bulk delete contacts"
    );
    return { success: false, error: "Failed to delete contacts" };
  }
}
