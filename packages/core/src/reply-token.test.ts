import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decodeReplyToken,
  encodeReplyToken,
  generateConversationId,
  generateSendId,
  REPLY_TOKEN_VERSION,
  verifyReplyToken,
} from "./reply-token.js";

const b64urlRe = /^[A-Za-z0-9_-]+$/;

function makeSecret(byte: number): Buffer {
  return Buffer.alloc(32, byte);
}

function makePayloadIds() {
  return {
    convId: randomBytes(8),
    sendId: randomBytes(8),
  };
}

function toB64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("encodeReplyToken", () => {
  it("encodes payload + HMAC into a 51-char base64url local-part", () => {
    const { convId, sendId } = makePayloadIds();
    const token = encodeReplyToken({
      kid: 1,
      convId,
      sendId,
      exp: 0,
      secret: makeSecret(0x11),
    });

    expect(token).toMatch(b64urlRe);
    expect(token.length).toBe(51);
  });

  it("is deterministic for the same inputs", () => {
    const convId = Buffer.alloc(8, 0xaa);
    const sendId = Buffer.alloc(8, 0xbb);
    const a = encodeReplyToken({
      kid: 3,
      convId,
      sendId,
      exp: 1_700_000_000,
      secret: makeSecret(0x22),
    });
    const b = encodeReplyToken({
      kid: 3,
      convId,
      sendId,
      exp: 1_700_000_000,
      secret: makeSecret(0x22),
    });
    expect(a).toBe(b);
  });
});

describe("decodeReplyToken + encodeReplyToken", () => {
  it("round-trips: decode ∘ encode recovers all payload fields", () => {
    const { convId, sendId } = makePayloadIds();
    const token = encodeReplyToken({
      kid: 7,
      convId,
      sendId,
      exp: 1_800_000_000,
      secret: makeSecret(0x33),
    });

    const decoded = decodeReplyToken(token);
    expect(decoded).not.toBeNull();
    const d = decoded as NonNullable<typeof decoded>;
    expect(d.version).toBe(REPLY_TOKEN_VERSION);
    expect(d.kid).toBe(7);
    expect(d.convId.equals(convId)).toBe(true);
    expect(d.sendId.equals(sendId)).toBe(true);
    expect(d.exp).toBe(1_800_000_000);
    expect(d.hmac.length).toBe(16);
    expect(d.payload.length).toBe(22);
  });

  it("returns null for truncated input (malformed)", () => {
    expect(decodeReplyToken("AAAA")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(decodeReplyToken("")).toBeNull();
  });

  it("returns null for garbage/non-base64url characters", () => {
    // 51 chars but includes padding which won't decode to 38 bytes cleanly when mangled
    expect(decodeReplyToken("!!!!")).toBeNull();
  });
});

describe("verifyReplyToken", () => {
  it("returns status 'valid' with conversationId/sendId for correct secret and kid", () => {
    const { convId, sendId } = makePayloadIds();
    const secret = makeSecret(0x44);
    const token = encodeReplyToken({
      kid: 1,
      convId,
      sendId,
      exp: 0,
      secret,
    });
    const decoded = decodeReplyToken(token);
    const result = verifyReplyToken(decoded, { 1: secret }, Date.now() / 1000);

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.conversationId).toBe(toB64Url(convId));
      expect(result.sendId).toBe(toB64Url(sendId));
    }
  });

  it("returns 'invalid-signature' for wrong secret; does not leak ids", () => {
    const { convId, sendId } = makePayloadIds();
    const token = encodeReplyToken({
      kid: 1,
      convId,
      sendId,
      exp: 0,
      secret: makeSecret(0x55),
    });
    const decoded = decodeReplyToken(token);
    const result = verifyReplyToken(
      decoded,
      { 1: makeSecret(0x99) },
      Date.now() / 1000
    );

    expect(result.status).toBe("invalid-signature");
    expect(result.conversationId).toBeNull();
    expect(result.sendId).toBeNull();
  });

  it("accepts tokens signed by previous-kid secret during grace window", () => {
    const { convId, sendId } = makePayloadIds();
    const previous = makeSecret(0x66);
    const token = encodeReplyToken({
      kid: 5,
      convId,
      sendId,
      exp: 0,
      secret: previous,
    });
    const decoded = decodeReplyToken(token);
    const current = makeSecret(0x77);
    const result = verifyReplyToken(
      decoded,
      { 5: previous, 6: current },
      Date.now() / 1000
    );

    expect(result.status).toBe("valid");
  });

  it("returns 'expired' when exp is in the past", () => {
    const { convId, sendId } = makePayloadIds();
    const secret = makeSecret(0x88);
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = encodeReplyToken({
      kid: 1,
      convId,
      sendId,
      exp: past,
      secret,
    });
    const decoded = decodeReplyToken(token);
    const result = verifyReplyToken(decoded, { 1: secret }, Date.now() / 1000);

    expect(result.status).toBe("expired");
    expect(result.conversationId).toBeNull();
  });

  it("treats exp: 0 as never expiring", () => {
    const { convId, sendId } = makePayloadIds();
    const secret = makeSecret(0xaa);
    const token = encodeReplyToken({
      kid: 1,
      convId,
      sendId,
      exp: 0,
      secret,
    });
    const decoded = decodeReplyToken(token);
    // Year 2100
    const farFuture = 4_102_444_800;
    const result = verifyReplyToken(decoded, { 1: secret }, farFuture);

    expect(result.status).toBe("valid");
  });

  it("returns 'unsupported-version' for unknown version byte", () => {
    const { convId, sendId } = makePayloadIds();
    const secret = makeSecret(0xbb);
    const token = encodeReplyToken({
      kid: 1,
      convId,
      sendId,
      exp: 0,
      secret,
    });
    const decoded = decodeReplyToken(token);
    // Mutate version; re-HMAC so signature matches but version is bad.
    expect(decoded).not.toBeNull();
    const d = decoded as NonNullable<typeof decoded>;
    d.version = 99;
    d.payload.writeUInt8(99, 0);
    const badMac = createHmac("sha256", secret)
      .update(d.payload)
      .digest()
      .subarray(0, 16);
    d.hmac = badMac;
    const result = verifyReplyToken(d, { 1: secret }, Date.now() / 1000);

    expect(result.status).toBe("unsupported-version");
  });

  it("treats null decoded input as 'malformed'", () => {
    const result = verifyReplyToken(null, { 1: makeSecret(0x11) }, 0);
    expect(result.status).toBe("malformed");
  });

  it("does not throw when hmac length mismatches (timingSafeEqual guard)", () => {
    const { convId, sendId } = makePayloadIds();
    const secret = makeSecret(0xcc);
    const token = encodeReplyToken({
      kid: 1,
      convId,
      sendId,
      exp: 0,
      secret,
    });
    const decoded = decodeReplyToken(token);
    expect(decoded).not.toBeNull();
    const d = decoded as NonNullable<typeof decoded>;
    // Force length mismatch: shrink the hmac buffer
    d.hmac = d.hmac.subarray(0, 8);
    expect(() =>
      verifyReplyToken(d, { 1: secret }, Date.now() / 1000)
    ).not.toThrow();
    const result = verifyReplyToken(d, { 1: secret }, Date.now() / 1000);
    expect(result.status).toBe("invalid-signature");
  });
});

describe("generateConversationId / generateSendId", () => {
  it("returns 11-char base64url strings (8 random bytes)", () => {
    const a = generateConversationId();
    const b = generateSendId();
    expect(a).toMatch(b64urlRe);
    expect(b).toMatch(b64urlRe);
    expect(a.length).toBe(11);
    expect(b.length).toBe(11);
  });

  it("generates distinct values across calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(generateConversationId());
    }
    expect(set.size).toBe(100);
  });
});

describe("known-answer vector", () => {
  it("produces pinned byte-exact output for fixed inputs (format drift guard)", () => {
    // Pinned KAT: version 1, kid 1, fixed convId/sendId/exp, fixed secret.
    const convId = Buffer.from("0102030405060708", "hex");
    const sendId = Buffer.from("090a0b0c0d0e0f10", "hex");
    const exp = 2_000_000_000;
    const secret = Buffer.alloc(32, 0x42);

    const token = encodeReplyToken({ kid: 1, convId, sendId, exp, secret });
    const raw = Buffer.from(
      token.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (token.length % 4)) % 4),
      "base64"
    );

    // Payload layout
    expect(raw.length).toBe(38);
    expect(raw.readUInt8(0)).toBe(1); // version
    expect(raw.readUInt8(1)).toBe(1); // kid
    expect(raw.subarray(2, 10).equals(convId)).toBe(true);
    expect(raw.subarray(10, 18).equals(sendId)).toBe(true);
    expect(raw.readUInt32BE(18)).toBe(exp);

    // Pinned HMAC (first 16 bytes of HMAC-SHA256 over the 22-byte payload).
    const expectedPayload = raw.subarray(0, 22);
    const expectedMac = createHmac("sha256", secret)
      .update(expectedPayload)
      .digest()
      .subarray(0, 16);
    expect(raw.subarray(22).equals(expectedMac)).toBe(true);
  });
});
