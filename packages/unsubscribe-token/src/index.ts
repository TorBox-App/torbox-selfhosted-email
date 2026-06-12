/**
 * Unsubscribe Token Utility
 *
 * Generates and verifies JWT tokens for email unsubscribe links.
 * Used for RFC 8058 one-click unsubscribe compliance.
 *
 * Shared implementation for @wraps/api and @wraps/web.
 */

import * as jose from "jose";

// Token payload structure
export type UnsubscribeTokenPayload = {
  cid: string; // contact ID
  oid: string; // organization ID
  tid?: string; // optional: specific topic ID
  type: "unsub"; // token type marker
};

// Optional logger interface — callers supply their own logger
export type TokenLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string, err?: unknown) => void;
};

// Get the secret from environment
function getSecret(): Uint8Array {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    const isProduction =
      process.env.NODE_ENV === "production" ||
      !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
      !!process.env.VERCEL_ENV;
    if (isProduction) {
      throw new Error(
        "UNSUBSCRIBE_SECRET environment variable is required in production"
      );
    }
    return new TextEncoder().encode(
      "dev-unsubscribe-secret-change-in-production"
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Generate an unsubscribe token for a contact
 *
 * @param contactId - The contact's ID
 * @param organizationId - The organization's ID
 * @param topicId - Optional topic ID for topic-specific unsubscribe
 * @returns JWT token string
 */
export async function generateUnsubscribeToken(
  contactId: string,
  organizationId: string,
  topicId?: string
): Promise<string> {
  const payload: UnsubscribeTokenPayload = {
    cid: contactId,
    oid: organizationId,
    type: "unsub",
  };

  if (topicId) {
    payload.tid = topicId;
  }

  const token = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d") // Tokens valid for 90 days
    .sign(getSecret());

  return token;
}

/**
 * Verify and decode an unsubscribe token
 *
 * @param token - The JWT token to verify
 * @param log - Optional logger; when omitted verification errors are swallowed silently
 * @returns The decoded payload or null if invalid
 */
export async function verifyUnsubscribeToken(
  token: string,
  log?: TokenLogger
): Promise<UnsubscribeTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());

    // Validate payload structure
    if (
      typeof payload.cid !== "string" ||
      typeof payload.oid !== "string" ||
      payload.type !== "unsub"
    ) {
      log?.warn("Unsubscribe: invalid token payload structure");
      return null;
    }

    return {
      cid: payload.cid,
      oid: payload.oid,
      tid: typeof payload.tid === "string" ? payload.tid : undefined,
      type: "unsub",
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      log?.info("Unsubscribe: token expired");
    } else if (error instanceof jose.errors.JWTInvalid) {
      log?.warn("Unsubscribe: invalid token");
    } else {
      log?.error("Unsubscribe: token verification failed", error);
    }
    return null;
  }
}

/**
 * Generate the full unsubscribe URL for an email
 *
 * @param contactId - The contact's ID
 * @param organizationId - The organization's ID
 * @param topicId - Optional topic ID for topic-specific unsubscribe
 * @returns Full unsubscribe URL
 */
export async function generateUnsubscribeUrl(
  contactId: string,
  organizationId: string,
  topicId?: string
): Promise<string> {
  const token = await generateUnsubscribeToken(
    contactId,
    organizationId,
    topicId
  );
  const baseUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.wraps.dev";
  return `${baseUrl}/unsubscribe/${token}`;
}

/**
 * Generate the full preferences URL for an email
 *
 * @param contactId - The contact's ID
 * @param organizationId - The organization's ID
 * @returns Full preferences URL
 */
export async function generatePreferencesUrl(
  contactId: string,
  organizationId: string
): Promise<string> {
  const token = await generateUnsubscribeToken(contactId, organizationId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.wraps.dev";
  return `${baseUrl}/preferences/${token}`;
}
