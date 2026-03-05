/**
 * Confirmation Token Service
 *
 * Generates and verifies JWT tokens for double opt-in email confirmation.
 * Uses the same secret as unsubscribe tokens for simplicity.
 */

import * as jose from "jose";

export type ConfirmationTokenPayload = {
  cid: string; // contact ID
  oid: string; // organization ID
  tid: string; // topic ID (required for confirmation)
  type: "confirm"; // token type marker
};

const TOKEN_EXPIRATION = "48h"; // Confirmation links valid for 48 hours

/**
 * Get the secret key for signing tokens.
 * Falls back to a default for development (should always be set in production).
 */
function getSecret(): Uint8Array {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
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
 * Generate a confirmation token for a contact/topic subscription.
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

  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(getSecret());

  return token;
}

/**
 * Verify a confirmation token and return its payload.
 * Returns null if the token is invalid or expired.
 */
export async function verifyConfirmationToken(
  token: string
): Promise<ConfirmationTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());

    // Verify it's a confirmation token (not an unsubscribe token)
    if (payload.type !== "confirm") {
      return null;
    }

    // Verify required fields exist
    if (
      typeof payload.cid !== "string" ||
      typeof payload.oid !== "string" ||
      typeof payload.tid !== "string"
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
    // Token is invalid or expired
    return null;
  }
}

/**
 * Generate a full confirmation URL for a contact/topic subscription.
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.wraps.dev";
  return `${baseUrl}/confirm/${token}`;
}
