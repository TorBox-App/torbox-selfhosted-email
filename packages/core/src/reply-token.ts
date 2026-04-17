import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const REPLY_TOKEN_VERSION = 1;
const PAYLOAD_LEN = 22;
const HMAC_LEN = 16;
const TOKEN_LEN = PAYLOAD_LEN + HMAC_LEN;

export type ReplyTokenStatus =
  | "valid"
  | "invalid-signature"
  | "expired"
  | "unsupported-version"
  | "malformed"
  | "unknown-domain";

export type DecodedReplyToken = {
  version: number;
  kid: number;
  convId: Buffer;
  sendId: Buffer;
  exp: number;
  hmac: Buffer;
  payload: Buffer;
};

export type VerifiedReplyToken =
  | {
      status: "valid";
      conversationId: string;
      sendId: string;
    }
  | {
      status: Exclude<ReplyTokenStatus, "valid">;
      conversationId: null;
      sendId: null;
    };

export type EncodeReplyTokenInput = {
  kid: number;
  convId: Buffer;
  sendId: Buffer;
  exp: number;
  secret: Buffer;
};

function hmac16(payload: Buffer, secret: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update(payload)
    .digest()
    .subarray(0, HMAC_LEN);
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function encodeReplyToken(input: EncodeReplyTokenInput): string {
  if (input.convId.length !== 8) {
    throw new Error("convId must be 8 bytes");
  }
  if (input.sendId.length !== 8) {
    throw new Error("sendId must be 8 bytes");
  }
  const payload = Buffer.alloc(PAYLOAD_LEN);
  payload.writeUInt8(REPLY_TOKEN_VERSION, 0);
  // biome-ignore lint/suspicious/noBitwiseOperators: mask to u8 for binary wire format
  payload.writeUInt8(input.kid & 0xff, 1);
  input.convId.copy(payload, 2);
  input.sendId.copy(payload, 10);
  // biome-ignore lint/suspicious/noBitwiseOperators: mask to u32 for binary wire format
  payload.writeUInt32BE(input.exp >>> 0, 18);

  const mac = hmac16(payload, input.secret);
  return toBase64Url(Buffer.concat([payload, mac]));
}

export function decodeReplyToken(local: string): DecodedReplyToken | null {
  if (typeof local !== "string" || local.length === 0) {
    return null;
  }
  let raw: Buffer;
  try {
    raw = fromBase64Url(local);
  } catch {
    return null;
  }
  if (raw.length !== TOKEN_LEN) {
    return null;
  }
  const payload = raw.subarray(0, PAYLOAD_LEN);
  const hmac = raw.subarray(PAYLOAD_LEN);
  return {
    version: payload.readUInt8(0),
    kid: payload.readUInt8(1),
    convId: Buffer.from(payload.subarray(2, 10)),
    sendId: Buffer.from(payload.subarray(10, 18)),
    exp: payload.readUInt32BE(18),
    hmac: Buffer.from(hmac),
    payload: Buffer.from(payload),
  };
}

export function verifyReplyToken(
  decoded: DecodedReplyToken | null,
  secrets: Record<number, Buffer>,
  nowSeconds: number
): VerifiedReplyToken {
  if (!decoded) {
    return { status: "malformed", conversationId: null, sendId: null };
  }
  if (decoded.version !== REPLY_TOKEN_VERSION) {
    return {
      status: "unsupported-version",
      conversationId: null,
      sendId: null,
    };
  }
  const secret = secrets[decoded.kid];
  if (!secret) {
    return {
      status: "invalid-signature",
      conversationId: null,
      sendId: null,
    };
  }
  const expected = hmac16(decoded.payload, secret);
  if (expected.length !== decoded.hmac.length) {
    return {
      status: "invalid-signature",
      conversationId: null,
      sendId: null,
    };
  }
  if (!timingSafeEqual(expected, decoded.hmac)) {
    return {
      status: "invalid-signature",
      conversationId: null,
      sendId: null,
    };
  }
  if (decoded.exp !== 0 && decoded.exp < nowSeconds) {
    return { status: "expired", conversationId: null, sendId: null };
  }
  return {
    status: "valid",
    conversationId: toBase64Url(decoded.convId),
    sendId: toBase64Url(decoded.sendId),
  };
}

export function generateConversationId(): string {
  return toBase64Url(randomBytes(8));
}

export function generateSendId(): string {
  return toBase64Url(randomBytes(8));
}
