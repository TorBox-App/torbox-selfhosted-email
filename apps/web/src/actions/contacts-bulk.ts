"use server";

import {
  bulkDeleteContacts as dbBulkDeleteContacts,
  findContactByEmailHash,
  findContactsByEmailHashes,
  insertContact,
} from "@wraps/db";
import { trackContactsImported } from "@/lib/activation-tracking";
import { checkContactLimit } from "@/lib/plan-limits";
import { revalidateContacts } from "./contacts";
import { hashEmail } from "./shared/hash";
import { orgAction } from "./shared/org-action";

/**
 * Bulk create contacts from email addresses
 * Used to create contacts from email recipients
 */
export const bulkCreateContactsFromEmails = orgAction(
  {
    name: "bulkCreateContactsFromEmails",
    resource: "contacts",
    permission: ["write"],
    orgId: (organizationId: string, _emails: string[]) => organizationId,
    onError: "Failed to create contacts",
  },
  async (
    ctx,
    organizationId: string,
    emails: string[]
  ): Promise<
    | { success: true; created: number; skipped: number; errors: string[] }
    | { success: false; error: string }
  > => {
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
    await ctx.audited(
      async (tx) => {
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
                createdBy: ctx.access.userId,
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
        return { count: emails.length };
      },
      (r) => ({
        action: "contact.created_bulk" as const,
        resource: "contact",
        metadata: { count: r.count },
      })
    );

    // Revalidate
    revalidateContacts(ctx.access.orgSlug);

    // Track activation event (fire-and-forget)
    if (created > 0) {
      trackContactsImported(ctx.access.userEmail, organizationId, {
        count: created,
        firstContact: { email: toInsert[0]?.email },
      });
    }

    return { success: true, created, skipped, errors };
  }
);

/**
 * Check if email addresses already exist as contacts
 * Returns a map of email -> contactId for existing contacts
 */
export const checkExistingContacts = orgAction(
  {
    name: "checkExistingContacts",
    resource: "contacts",
    permission: ["read"],
    orgId: (organizationId: string, _emails: string[]) => organizationId,
    onError: "Failed to check contacts",
  },
  async (
    ctx,
    organizationId: string,
    emails: string[]
  ): Promise<
    | { success: true; existing: Record<string, string> }
    | { success: false; error: string }
  > => {
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
  }
);

/**
 * Bulk delete contacts
 */
export const bulkDeleteContacts = orgAction(
  {
    name: "bulkDeleteContacts",
    resource: "contacts",
    permission: ["delete"],
    orgId: (organizationId: string, _contactIds: string[]) => organizationId,
    onError: "Failed to delete contacts",
  },
  async (
    ctx,
    organizationId: string,
    contactIds: string[]
  ): Promise<
    { success: true; count: number } | { success: false; error: string }
  > => {
    if (contactIds.length === 0) {
      return { success: false, error: "No contacts selected" };
    }

    // Delete contacts + write audit log in one transaction
    await ctx.audited(
      async (tx) => {
        await dbBulkDeleteContacts(contactIds, organizationId, tx);
        return { count: contactIds.length };
      },
      (r) => ({
        action: "contact.deleted_bulk" as const,
        resource: "contact",
        metadata: { count: r.count },
      })
    );

    // Revalidate
    revalidateContacts(ctx.access.orgSlug);

    return { success: true, count: contactIds.length };
  }
);
