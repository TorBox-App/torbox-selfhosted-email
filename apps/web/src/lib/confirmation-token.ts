/**
 * Confirmation Token Utility
 *
 * Generates and verifies JWT tokens for topic subscription confirmation.
 * Used for double opt-in topic subscriptions.
 */

import * as jose from "jose";

// Token payload structure
export interface ConfirmationTokenPayload {
  cid: string; // contact ID
  oid: string; // organization ID
  tid: string; // topic ID (required for confirmation)
  type: "confirm"; // token type marker
}

// Get the secret from environment (reuse unsubscribe secret)
function getSecret(): Uint8Array {
  const secret =
    process.env.UNSUBSCRIBE_SECRET ||
    "dev-unsubscribe-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

/**
 * Generate a confirmation token for a topic subscription
 */
export async function generateConfirmationToken(
  contactId: string,
  organizationId: string,
  topicId: string
): Promise<string> {
  const payload: ConfirmationTokenPayload = {
    cid: contactId,
    oid: organizationId,
    tid: topicId,
    type: "confirm",
  };

  const token = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("48h") // 48 hour expiration
    .sign(getSecret());

  return token;
}

/**
 * Verify and decode a confirmation token
 */
export async function verifyConfirmationToken(
  token: string
): Promise<ConfirmationTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());

    if (
      typeof payload.cid !== "string" ||
      typeof payload.oid !== "string" ||
      typeof payload.tid !== "string" ||
      payload.type !== "confirm"
    ) {
      return null;
    }

    return {
      cid: payload.cid,
      oid: payload.oid,
      tid: payload.tid,
      type: "confirm",
    };
  } catch {
    return null;
  }
}

/**
 * Generate confirmation URL for a topic subscription
 */
export async function generateConfirmationUrl(
  contactId: string,
  organizationId: string,
  topicId: string
): Promise<string> {
  const token = await generateConfirmationToken(
    contactId,
    organizationId,
    topicId
  );
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wraps.dev";
  return `${baseUrl}/confirm/${token}`;
}
