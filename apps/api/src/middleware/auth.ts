/**
 * Authentication Middleware
 *
 * Supports two authentication methods:
 * 1. API Key - For SDK/external API access (Authorization header with wraps_* key)
 * 2. Session Token - For web app internal calls (better-auth session token)
 */

import { createHash } from "node:crypto";
import { and, apiKey, db, eq, member, session, subscription } from "@wraps/db";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";

export type AuthContext = {
  apiKeyId: string | null;
  organizationId: string;
  userId: string | null;
  planId: string | null; // null if no valid subscription
};

// Hash function for API key verification
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Extract plan from a subscription join result
function extractPlan(sub: {
  plan: string | null;
  subStatus: string | null;
}): string | null {
  if (
    sub.subStatus &&
    (sub.subStatus === "active" || sub.subStatus === "trialing")
  ) {
    return sub.plan;
  }
  return null;
}

// Validate API key and return auth context (1 SELECT + 1 UPDATE)
async function validateApiKey(key: string): Promise<AuthContext | null> {
  if (!key.startsWith("wraps_")) {
    return null;
  }

  const keyHash = hashApiKey(key);

  // JOIN api_key + subscription in one query
  const [result] = await db
    .select({
      id: apiKey.id,
      organizationId: apiKey.organizationId,
      createdBy: apiKey.createdBy,
      expiresAt: apiKey.expiresAt,
      plan: subscription.plan,
      subStatus: subscription.status,
    })
    .from(apiKey)
    .leftJoin(subscription, eq(subscription.referenceId, apiKey.organizationId))
    .where(eq(apiKey.keyHash, keyHash))
    .limit(1);

  if (!result) {
    return null;
  }

  if (result.expiresAt && result.expiresAt < new Date()) {
    return null;
  }

  // Update last used timestamp
  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, result.id));

  return {
    apiKeyId: result.id,
    organizationId: result.organizationId,
    userId: result.createdBy,
    planId: extractPlan(result),
  };
}

// Validate session by direct database lookup (1 SELECT with JOINs)
async function validateSessionWithReason(
  sessionToken: string,
  organizationId?: string
): Promise<{ auth: AuthContext | null; reason: string }> {
  try {
    // JOIN session + member + subscription in one query
    // When organizationId is provided via header, use it; otherwise use the session's activeOrganizationId
    const [result] = await db
      .select({
        sessionId: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        activeOrganizationId: session.activeOrganizationId,
        memberRole: member.role,
        plan: subscription.plan,
        subStatus: subscription.status,
      })
      .from(session)
      .leftJoin(
        member,
        and(
          eq(member.userId, session.userId),
          organizationId
            ? eq(member.organizationId, sql`${organizationId}`)
            : eq(member.organizationId, session.activeOrganizationId)
        )
      )
      .leftJoin(
        subscription,
        eq(
          subscription.referenceId,
          organizationId ? sql`${organizationId}` : session.activeOrganizationId
        )
      )
      .where(eq(session.token, sessionToken))
      .limit(1);

    if (!result) {
      return { auth: null, reason: "session not found" };
    }

    if (result.expiresAt < new Date()) {
      return { auth: null, reason: "session expired" };
    }

    const orgId = organizationId || result.activeOrganizationId;

    if (!orgId) {
      return { auth: null, reason: "no org id" };
    }

    if (!result.memberRole) {
      return { auth: null, reason: "user not member of org" };
    }

    return {
      auth: {
        apiKeyId: null,
        organizationId: orgId,
        userId: result.userId,
        planId: extractPlan(result),
      },
      reason: "ok",
    };
  } catch (error) {
    console.error("[AUTH] Error validating session:", error);
    return {
      auth: null,
      reason: `error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Authenticate request and return auth context or error message
async function authenticate(
  request: Request
): Promise<{ auth: AuthContext } | { error: string }> {
  const authHeader = request.headers.get("authorization");
  const orgId = request.headers.get("x-organization-id") ?? undefined;

  console.log(
    "[AUTH] Authenticating, authHeader:",
    authHeader ? "yes" : "no",
    "orgId:",
    orgId
  );

  if (!authHeader) {
    return { error: "Unauthorized: no auth header" };
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // Try API key auth (wraps_* prefix)
  if (token.startsWith("wraps_")) {
    const authContext = await validateApiKey(token);
    if (authContext) {
      return { auth: authContext };
    }
    return { error: "Unauthorized: invalid API key" };
  }

  // Try session token auth (from Better Auth)
  console.log("[AUTH] Trying session auth for token:", token.slice(0, 10));
  const result = await validateSessionWithReason(token, orgId);
  console.log("[AUTH] Session result:", result.reason);

  if (result.auth) {
    console.log("[AUTH] Session validated, returning auth context");
    return { auth: result.auth };
  }

  return { error: `Unauthorized: ${result.reason}` };
}

// Export authenticate function for direct use in routes
export { authenticate };

/**
 * Factory function to create authenticated route handlers.
 *
 * This is the recommended way to create routes that require authentication.
 * It sets up derive + onBeforeHandle to authenticate requests before handlers run.
 *
 * Usage:
 * ```typescript
 * export const myRoutes = createAuthenticatedRoutes("/v1/my-resource")
 *   .get("/", async ({ auth }) => {
 *     // auth is guaranteed to be set here
 *     return { organizationId: auth.organizationId };
 *   })
 *   .post("/", async ({ auth, body }) => {
 *     // ...
 *   });
 * ```
 */
export function createAuthenticatedRoutes(prefix: string) {
  return new Elysia({ prefix })
    .derive(async (ctx) => {
      // Allow tests to inject mock auth by setting auth before .use()
      const existingAuth = (ctx as unknown as { auth?: AuthContext }).auth;
      if (existingAuth) {
        return { auth: existingAuth, authError: null as string | null };
      }

      const result = await authenticate(ctx.request);
      if ("error" in result) {
        return { auth: null as AuthContext | null, authError: result.error };
      }
      return { auth: result.auth, authError: null as string | null };
    })
    .onBeforeHandle(({ auth, authError, set }) => {
      if (authError || !auth) {
        set.status = 401;
        return { error: authError || "Unauthorized" };
      }
    });
}

// Legacy auth middleware - prefer createAuthenticatedRoutes for new routes
export const authMiddleware = new Elysia({ name: "auth" })
  .derive(async ({ request }) => {
    try {
      const result = await authenticate(request);
      if ("error" in result) {
        return { auth: null as AuthContext | null, authError: result.error };
      }
      return {
        auth: result.auth as AuthContext | null,
        authError: null as string | null,
      };
    } catch (error) {
      console.error("[AUTH MIDDLEWARE] Exception in derive:", error);
      return {
        auth: null as AuthContext | null,
        authError: "Internal auth error",
      };
    }
  })
  .onBeforeHandle(({ auth, authError, set }) => {
    if (authError || !auth) {
      set.status = 401;
      return { error: authError || "Unauthorized" };
    }
  });
