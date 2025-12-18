"use server";

import { auth } from "@wraps/auth";
import { apiKey, db } from "@wraps/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import crypto from "node:crypto";
import {
  API_KEY_PREFIXES,
  FULL_ACCESS_PERMISSIONS,
  READ_ONLY_PERMISSIONS,
  type ApiKeyPermission,
  type ApiKeyType,
  type ApiKeyWithMeta,
  type ListApiKeysResult,
  type CreateApiKeyResult,
  type DeleteApiKeyResult,
  type UpdateApiKeyResult,
} from "@/lib/api-keys";

// Re-export types for convenience (types can be re-exported from server files)
export type {
  ApiKeyPermission,
  ApiKeyWithMeta,
  ListApiKeysResult,
  CreateApiKeyResult,
  DeleteApiKeyResult,
  UpdateApiKeyResult,
} from "@/lib/api-keys";

/**
 * Generate a secure random API key
 */
function generateApiKey(type: ApiKeyType = "live"): {
  key: string;
  prefix: string;
  hash: string;
} {
  const prefix = API_KEY_PREFIXES[type];
  const randomPart = crypto.randomBytes(24).toString("base64url");
  const key = `${prefix}${randomPart}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");

  return { key, prefix, hash };
}

/**
 * Hash an API key for storage/lookup
 */
function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Extract prefix from API key for display
 */
function extractPrefix(key: string): string {
  // Get the prefix + first 8 chars of random part
  const match = key.match(/^(wraps_(?:live|test|rk)_)(.{8})/);
  if (match) {
    return `${match[1]}${match[2]}...`;
  }
  return key.slice(0, 20) + "...";
}

/**
 * List all API keys for an organization
 */
export async function listApiKeys(
  organizationId: string
): Promise<ListApiKeysResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is a member of this organization
    const membership = await db.query.member.findFirst({
      where: (m, { and, eq }) =>
        and(
          eq(m.organizationId, organizationId),
          eq(m.userId, session.user.id)
        ),
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this organization" };
    }

    // Fetch all API keys for this organization
    const keys = await db.query.apiKey.findMany({
      where: (k, { eq }) => eq(k.organizationId, organizationId),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: (keys, { desc }) => [desc(keys.createdAt)],
    });

    return {
      success: true,
      apiKeys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        permissions: (key.permissions as ApiKeyPermission[]) || [],
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        createdBy: key.createdByUser,
      })),
    };
  } catch (error) {
    console.error("Error listing API keys:", error);
    return { success: false, error: "Failed to fetch API keys" };
  }
}

/**
 * Create a new API key
 */
export async function createApiKey(
  organizationId: string,
  options: {
    name: string;
    type?: ApiKeyType;
    permissions?: ApiKeyPermission[] | "full" | "readonly";
    expiresInDays?: number;
  }
): Promise<CreateApiKeyResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is owner or admin
    const membership = await db.query.member.findFirst({
      where: (m, { and, eq }) =>
        and(
          eq(m.organizationId, organizationId),
          eq(m.userId, session.user.id)
        ),
    });

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Only owners and admins can create API keys" };
    }

    // Validate name
    if (!options.name || options.name.trim().length < 1) {
      return { success: false, error: "API key name is required" };
    }

    // Generate the key
    const keyType = options.type || "live";
    const { key, prefix, hash } = generateApiKey(keyType);

    // Determine permissions
    let permissions: ApiKeyPermission[];
    if (options.permissions === "full" || !options.permissions) {
      permissions = FULL_ACCESS_PERMISSIONS;
    } else if (options.permissions === "readonly") {
      permissions = READ_ONLY_PERMISSIONS;
    } else {
      permissions = options.permissions;
    }

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (options.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + options.expiresInDays);
    }

    // Store the display prefix (first part of key for identification)
    const displayPrefix = extractPrefix(key);

    // Create in database
    const [newKey] = await db
      .insert(apiKey)
      .values({
        organizationId,
        name: options.name.trim(),
        keyHash: hash,
        prefix: displayPrefix,
        permissions,
        expiresAt,
        createdBy: session.user.id,
      })
      .returning();

    if (!newKey) {
      return { success: false, error: "Failed to create API key" };
    }

    // Revalidate settings page
    revalidatePath(`/[orgSlug]/settings`, "page");

    return {
      success: true,
      apiKey: {
        id: newKey.id,
        name: newKey.name,
        prefix: newKey.prefix,
        permissions: permissions,
        lastUsedAt: null,
        expiresAt: newKey.expiresAt,
        createdAt: newKey.createdAt,
        createdBy: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        },
      },
      // Return the full secret key - this is the ONLY time it's available
      secretKey: key,
    };
  } catch (error) {
    console.error("Error creating API key:", error);
    return { success: false, error: "Failed to create API key" };
  }
}

/**
 * Update an API key (name and permissions only)
 */
export async function updateApiKey(
  apiKeyId: string,
  organizationId: string,
  updates: {
    name?: string;
    permissions?: ApiKeyPermission[];
  }
): Promise<UpdateApiKeyResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is owner or admin
    const membership = await db.query.member.findFirst({
      where: (m, { and, eq }) =>
        and(
          eq(m.organizationId, organizationId),
          eq(m.userId, session.user.id)
        ),
    });

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Only owners and admins can update API keys" };
    }

    // Verify API key belongs to this organization
    const existingKey = await db.query.apiKey.findFirst({
      where: (k, { and, eq }) =>
        and(eq(k.id, apiKeyId), eq(k.organizationId, organizationId)),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!existingKey) {
      return { success: false, error: "API key not found" };
    }

    // Build update object
    const updateData: Partial<typeof apiKey.$inferInsert> = {};
    if (updates.name !== undefined) {
      updateData.name = updates.name.trim();
    }
    if (updates.permissions !== undefined) {
      updateData.permissions = updates.permissions;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No updates provided" };
    }

    // Update in database
    const [updatedKey] = await db
      .update(apiKey)
      .set(updateData)
      .where(and(eq(apiKey.id, apiKeyId), eq(apiKey.organizationId, organizationId)))
      .returning();

    if (!updatedKey) {
      return { success: false, error: "Failed to update API key" };
    }

    // Revalidate settings page
    revalidatePath(`/[orgSlug]/settings`, "page");

    return {
      success: true,
      apiKey: {
        id: updatedKey.id,
        name: updatedKey.name,
        prefix: updatedKey.prefix,
        permissions: (updatedKey.permissions as ApiKeyPermission[]) || [],
        lastUsedAt: updatedKey.lastUsedAt,
        expiresAt: updatedKey.expiresAt,
        createdAt: updatedKey.createdAt,
        createdBy: existingKey.createdByUser,
      },
    };
  } catch (error) {
    console.error("Error updating API key:", error);
    return { success: false, error: "Failed to update API key" };
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(
  apiKeyId: string,
  organizationId: string
): Promise<DeleteApiKeyResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is owner or admin
    const membership = await db.query.member.findFirst({
      where: (m, { and, eq }) =>
        and(
          eq(m.organizationId, organizationId),
          eq(m.userId, session.user.id)
        ),
    });

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Only owners and admins can delete API keys" };
    }

    // Verify API key belongs to this organization
    const existingKey = await db.query.apiKey.findFirst({
      where: (k, { and, eq }) =>
        and(eq(k.id, apiKeyId), eq(k.organizationId, organizationId)),
    });

    if (!existingKey) {
      return { success: false, error: "API key not found" };
    }

    // Delete from database
    await db
      .delete(apiKey)
      .where(and(eq(apiKey.id, apiKeyId), eq(apiKey.organizationId, organizationId)));

    // Revalidate settings page
    revalidatePath(`/[orgSlug]/settings`, "page");

    return { success: true };
  } catch (error) {
    console.error("Error deleting API key:", error);
    return { success: false, error: "Failed to delete API key" };
  }
}

/**
 * Verify an API key and return the associated organization
 * This is used by the API middleware to authenticate requests
 */
export async function verifyApiKey(key: string): Promise<{
  valid: boolean;
  organizationId?: string;
  permissions?: ApiKeyPermission[];
  error?: string;
}> {
  try {
    // Check key format
    if (!key.startsWith("wraps_")) {
      return { valid: false, error: "Invalid API key format" };
    }

    // Hash the key for lookup
    const keyHash = hashApiKey(key);

    // Find the key in database
    const foundKey = await db.query.apiKey.findFirst({
      where: (k, { eq }) => eq(k.keyHash, keyHash),
    });

    if (!foundKey) {
      return { valid: false, error: "Invalid API key" };
    }

    // Check expiration
    if (foundKey.expiresAt && foundKey.expiresAt < new Date()) {
      return { valid: false, error: "API key has expired" };
    }

    // Update last used timestamp (fire and forget)
    db.update(apiKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKey.id, foundKey.id))
      .catch((err) => console.error("Failed to update lastUsedAt:", err));

    return {
      valid: true,
      organizationId: foundKey.organizationId,
      permissions: (foundKey.permissions as ApiKeyPermission[]) || [],
    };
  } catch (error) {
    console.error("Error verifying API key:", error);
    return { valid: false, error: "Failed to verify API key" };
  }
}
