#!/usr/bin/env node
/**
 * Pure-node helper: mint a signed reply-to token for deployment tests.
 *
 * Inputs (env):
 *   REPLY_SECRET_B64 — base64-encoded 32-byte HMAC secret (from SSM)
 *   REPLY_KID        — current key id (integer)
 *
 * Output: one JSON line on stdout:
 *   { token, conversationId, sendId, exp }
 *
 * The on-wire binary format MUST match `packages/core/src/reply-token.ts`
 * and `wraps-js/packages/email/src/reply-token-codec.ts` exactly. The KAT
 * tests in those files pin the byte layout.
 */
import { createHmac, randomBytes } from "node:crypto";

const { REPLY_SECRET_B64, REPLY_KID } = process.env;
if (!(REPLY_SECRET_B64 && REPLY_KID)) {
  console.error("REPLY_SECRET_B64 and REPLY_KID env vars are required");
  process.exit(2);
}

const secret = Buffer.from(REPLY_SECRET_B64, "base64");
if (secret.length !== 32) {
  console.error(`secret must decode to 32 bytes, got ${secret.length}`);
  process.exit(2);
}
const kid = Number.parseInt(REPLY_KID, 10);
if (!Number.isFinite(kid) || kid < 0 || kid > 255) {
  console.error(`kid must be a u8 integer, got ${REPLY_KID}`);
  process.exit(2);
}

const convId = randomBytes(8);
const sendId = randomBytes(8);
const exp = Math.floor(Date.now() / 1000) + 3600; // 1h TTL is fine for tests

const payload = Buffer.alloc(22);
payload.writeUInt8(1, 0); // version
payload.writeUInt8(kid, 1);
convId.copy(payload, 2);
sendId.copy(payload, 10);
payload.writeUInt32BE(exp, 18);

const mac = createHmac("sha256", secret)
  .update(payload)
  .digest()
  .subarray(0, 16);
const raw = Buffer.concat([payload, mac]);

const toB64Url = (b) =>
  b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

process.stdout.write(
  `${JSON.stringify({
    token: toB64Url(raw),
    conversationId: toB64Url(convId),
    sendId: toB64Url(sendId),
    exp,
  })}\n`
);
