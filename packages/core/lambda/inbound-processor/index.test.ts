import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { Context, S3Event } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeReplyToken } from "../../src/reply-token.js";

const s3Mock = mockClient(S3Client);
const ebMock = mockClient(EventBridgeClient);
const ssmMock = mockClient(SSMClient);

const PARSED_BUCKET = "parsed-bucket";

type EmailFixture = {
  to?: Array<{ address: string }>;
  cc?: Array<{ address: string }>;
  from?: { address: string; name?: string };
  headers?: [string, unknown][];
  subject?: string;
};

const parsedState: { queue: EmailFixture[] } = { queue: [] };

function parseFromFixture(fx: EmailFixture) {
  const headers = new Map<string, unknown>(fx.headers ?? []);
  const toValue = (fx.to ?? []).map((a) => ({ address: a.address, name: "" }));
  const ccValue = (fx.cc ?? []).map((a) => ({ address: a.address, name: "" }));
  const fromValue = fx.from
    ? [{ address: fx.from.address, name: fx.from.name ?? "" }]
    : [];
  return {
    messageId: "<msg@example.com>",
    subject: fx.subject ?? "",
    from: fx.from ? { value: fromValue } : undefined,
    to:
      toValue.length > 0
        ? { value: toValue, text: toValue.map((t) => t.address).join(", ") }
        : undefined,
    cc:
      ccValue.length > 0
        ? { value: ccValue, text: ccValue.map((t) => t.address).join(", ") }
        : undefined,
    html: "<p>hi</p>",
    text: "hi",
    headers,
    attachments: [],
    date: new Date("2026-01-01T00:00:00Z"),
  };
}

vi.mock("mailparser", () => ({
  simpleParser: vi.fn(async () => {
    const fx = parsedState.queue.shift() ?? {};
    return parseFromFixture(fx);
  }),
}));

function singleS3Event(key = "raw/abc"): S3Event {
  return {
    Records: [{ s3: { bucket: { name: "raw-bucket" }, object: { key } } }],
  } as unknown as S3Event;
}

function multiS3Event(keys: string[]): S3Event {
  return {
    Records: keys.map((key) => ({
      s3: { bucket: { name: "raw-bucket" }, object: { key } },
    })),
  } as unknown as S3Event;
}

function makeCtx(): Context {
  return { awsRequestId: "req-1" } as unknown as Context;
}

async function capturedPut(idx = 0): Promise<{
  source?: string;
  detail: Record<string, unknown>;
}> {
  const calls = ebMock.commandCalls(PutEventsCommand);
  if (calls.length <= idx) {
    throw new Error(`no EventBridge PutEvents call at idx ${idx}`);
  }
  const entry = calls[idx].args[0].input.Entries?.[0];
  return {
    source: entry?.Source,
    detail: JSON.parse(entry?.Detail ?? "{}") as Record<string, unknown>,
  };
}

async function runHandler(event: S3Event = singleS3Event()) {
  const { handler } = await import("./index.ts");
  await handler(event, makeCtx());
}

beforeEach(() => {
  s3Mock.reset();
  ebMock.reset();
  ssmMock.reset();
  parsedState.queue = [];

  s3Mock.on(GetObjectCommand).callsFake(() => ({
    Body: {
      transformToString: async () => "From: a@example.com\r\n\r\nhello",
    },
  }));
  s3Mock.on(PutObjectCommand).resolves({});
  ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0, Entries: [] });

  process.env.BUCKET_NAME = PARSED_BUCKET;
  // biome-ignore lint/performance/noDelete: process.env coerces `= undefined` to the string "undefined" (truthy). Actual key removal is required so `Boolean(process.env.REPLY_SECRET_PARAMETER_PREFIX)` is false in the feature-disabled tests.
  delete process.env.REPLY_SECRET_PARAMETER_PREFIX;

  // Fresh module — re-initializes the module-scope domainSecretCache per test.
  vi.resetModules();
});

afterEach(() => {
  // biome-ignore lint/performance/noDelete: see above — string "undefined" is truthy.
  delete process.env.REPLY_SECRET_PARAMETER_PREFIX;
});

describe("inbound-processor — non-reply recipient", () => {
  it("emits replyToken: null and autoReply: false for a non r.mail.* recipient", async () => {
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: "inbox@support.foo.com" }],
        headers: [],
      },
    ];

    await runHandler();

    const ev = await capturedPut();
    expect(ev.source).toBe("wraps.inbound");
    expect(ev.detail.replyToken).toBeNull();
    expect(ev.detail.autoReply).toBe(false);
  });
});

describe("inbound-processor — reply-threading branch", () => {
  const secret = Buffer.alloc(32, 0x5a);
  const prefix = "/wraps/email/reply-secret/";

  beforeEach(() => {
    process.env.REPLY_SECRET_PARAMETER_PREFIX = prefix;
    ssmMock.on(GetParameterCommand).resolves({
      Parameter: {
        Value: JSON.stringify({ kid: 1, current: secret.toString("base64") }),
      },
    });
  });

  it("emits status: valid with conversationId/sendId when token verifies", async () => {
    const convId = Buffer.alloc(8, 0x01);
    const sendId = Buffer.alloc(8, 0x02);
    const token = encodeReplyToken({
      kid: 1,
      convId,
      sendId,
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.support.foo.com` }],
        headers: [],
      },
    ];

    await runHandler();

    const ev = await capturedPut();
    const rt = ev.detail.replyToken as {
      status: string;
      conversationId: string;
      sendId: string;
    };
    expect(rt.status).toBe("valid");
    expect(typeof rt.conversationId).toBe("string");
    expect(typeof rt.sendId).toBe("string");
  });

  it("emits status: invalid-signature when HMAC does not match; does not leak ids", async () => {
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0x11),
      sendId: Buffer.alloc(8, 0x22),
      exp: 0,
      secret: Buffer.alloc(32, 0xee),
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.support.foo.com` }],
        headers: [],
      },
    ];

    await runHandler();

    const ev = await capturedPut();
    const rt = ev.detail.replyToken as {
      status: string;
      conversationId: unknown;
      sendId: unknown;
    };
    expect(rt.status).toBe("invalid-signature");
    expect(rt.conversationId).toBeNull();
    expect(rt.sendId).toBeNull();
  });

  it("prefers X-Original-To header over To: for recipient derivation", async () => {
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0x33),
      sendId: Buffer.alloc(8, 0x44),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: "not-a-reply@support.foo.com" }],
        headers: [["x-original-to", `${token}@r.mail.support.foo.com`]],
      },
    ];

    await runHandler();

    const ev = await capturedPut();
    const rt = ev.detail.replyToken as { status: string };
    expect(rt.status).toBe("valid");
    expect(ev.detail.receivingDomain).toBe("r.mail.support.foo.com");
  });

  it("sets autoReply: true for Auto-Submitted: auto-replied headers", async () => {
    parsedState.queue = [
      {
        from: { address: "vacation@external.com" },
        to: [{ address: "inbox@support.foo.com" }],
        headers: [["auto-submitted", "auto-replied"]],
      },
    ];

    await runHandler();

    const ev = await capturedPut();
    expect(ev.detail.autoReply).toBe(true);
  });

  it("reuses the per-domain cache: two records for the same domain → one SSM fetch", async () => {
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0x55),
      sendId: Buffer.alloc(8, 0x66),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.support.foo.com` }],
        headers: [],
      },
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.support.foo.com` }],
        headers: [],
      },
    ];

    await runHandler(multiS3Event(["raw/a", "raw/b"]));

    const getCalls = ssmMock.commandCalls(GetParameterCommand);
    expect(getCalls.length).toBe(1);
  });

  it("per-domain cache: different sending domains → separate SSM fetches", async () => {
    const token1 = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0xa1),
      sendId: Buffer.alloc(8, 0xa2),
      exp: 0,
      secret,
    });
    const token2 = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0xb1),
      sendId: Buffer.alloc(8, 0xb2),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token1}@r.mail.support.foo.com` }],
        headers: [],
      },
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token2}@r.mail.sales.foo.com` }],
        headers: [],
      },
    ];

    await runHandler(multiS3Event(["raw/a", "raw/b"]));

    const getCalls = ssmMock.commandCalls(GetParameterCommand);
    expect(getCalls.length).toBe(2);
    const names = getCalls.map((c) => c.args[0].input.Name).sort();
    expect(names).toEqual([
      `${prefix}sales.foo.com`,
      `${prefix}support.foo.com`,
    ]);
  });

  it("emits status: unknown-domain when SSM value is malformed JSON", async () => {
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0x01),
      sendId: Buffer.alloc(8, 0x02),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.support.foo.com` }],
        headers: [],
      },
    ];
    ssmMock.reset();
    ssmMock.on(GetParameterCommand).resolves({
      Parameter: { Value: "not-valid-json{" },
    });

    await runHandler();

    const ev = await capturedPut();
    const rt = ev.detail.replyToken as { status: string };
    expect(rt.status).toBe("unknown-domain");
  });

  it("emits status: unknown-domain when SSM value is missing required fields", async () => {
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0x11),
      sendId: Buffer.alloc(8, 0x22),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.support.foo.com` }],
        headers: [],
      },
    ];
    ssmMock.reset();
    // Missing `kid` and `current` — e.g. an operator mis-edited the param.
    ssmMock.on(GetParameterCommand).resolves({
      Parameter: { Value: JSON.stringify({ foo: "bar" }) },
    });

    await runHandler();

    const ev = await capturedPut();
    const rt = ev.detail.replyToken as { status: string };
    expect(rt.status).toBe("unknown-domain");
  });

  it("emits status: unknown-domain when SSM returns ParameterNotFound", async () => {
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0xcc),
      sendId: Buffer.alloc(8, 0xdd),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.unknown.foo.com` }],
        headers: [],
      },
    ];
    ssmMock.reset();
    class ParameterNotFound extends Error {
      override name = "ParameterNotFound";
    }
    ssmMock.on(GetParameterCommand).rejects(new ParameterNotFound("nope"));

    await runHandler();

    const ev = await capturedPut();
    const rt = ev.detail.replyToken as { status: string };
    expect(rt.status).toBe("unknown-domain");
  });

  it("emits status: unknown-domain for malformed sending domain; never calls SSM", async () => {
    // Recipient host contains a slash — stripping `r.mail.` leaves a domain
    // that would produce a path-traversal SSM parameter name. The handler
    // must reject it without issuing a GetParameterCommand (which would fail
    // with ValidationException and trigger retry/DLQ).
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0xab),
      sendId: Buffer.alloc(8, 0xcd),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.foo%2Fbar.com` }],
        headers: [],
      },
    ];

    await runHandler();

    const getCalls = ssmMock.commandCalls(GetParameterCommand);
    expect(getCalls.length).toBe(0);
    const ev = await capturedPut();
    const rt = ev.detail.replyToken as { status: string };
    expect(rt.status).toBe("unknown-domain");
  });

  it("emits status: unknown-domain for path-traversal sending domain", async () => {
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0x11),
      sendId: Buffer.alloc(8, 0x22),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail...foo.com` }],
        headers: [],
      },
    ];

    await runHandler();

    const getCalls = ssmMock.commandCalls(GetParameterCommand);
    expect(getCalls.length).toBe(0);
    const ev = await capturedPut();
    const rt = ev.detail.replyToken as { status: string };
    expect(rt.status).toBe("unknown-domain");
  });

  it("verifies tokens signed by non-sequential previous kid when SSM stores previousKid explicitly", async () => {
    // SSM blob uses non-sequential kids (5 current, 3 previous) — could occur
    // if an operator hand-edits the parameter. buildSecretsMap must honor the
    // explicit previousKid rather than assuming `kid - 1`.
    const currentSecret = Buffer.alloc(32, 0xaa);
    const previousSecret = Buffer.alloc(32, 0xbb);
    ssmMock.reset();
    ssmMock.on(GetParameterCommand).resolves({
      Parameter: {
        Value: JSON.stringify({
          kid: 5,
          current: currentSecret.toString("base64"),
          previous: previousSecret.toString("base64"),
          previousKid: 3,
        }),
      },
    });

    // Token signed with the previous key (kid=3), which skipped kid=4.
    const token = encodeReplyToken({
      kid: 3,
      convId: Buffer.alloc(8, 0x33),
      sendId: Buffer.alloc(8, 0x44),
      exp: 0,
      secret: previousSecret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.support.foo.com` }],
        headers: [],
      },
    ];

    await runHandler();

    const ev = await capturedPut();
    const rt = ev.detail.replyToken as { status: string };
    expect(rt.status).toBe("valid");
  });

  it("normalizes mixed-case recipient domains to lowercase for SSM lookup", async () => {
    // SSM params are stored at lowercase (created by CLI), but SES/mailparser
    // may preserve case in the recipient address. The Lambda must lowercase
    // the sending domain so `@r.mail.SUPPORT.FOO.com` finds
    // `/wraps/email/reply-secret/support.foo.com`.
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0x77),
      sendId: Buffer.alloc(8, 0x88),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.SUPPORT.FOO.com` }],
        headers: [],
      },
    ];

    await runHandler();

    const getCalls = ssmMock.commandCalls(GetParameterCommand);
    expect(getCalls.length).toBe(1);
    expect(getCalls[0].args[0].input.Name).toBe(`${prefix}support.foo.com`);
    const ev = await capturedPut();
    const rt = ev.detail.replyToken as { status: string };
    expect(rt.status).toBe("valid");
  });

  it("strips the r.mail. prefix to compute SSM parameter name", async () => {
    const token = encodeReplyToken({
      kid: 1,
      convId: Buffer.alloc(8, 0x77),
      sendId: Buffer.alloc(8, 0x88),
      exp: 0,
      secret,
    });
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: `${token}@r.mail.support.foo.com` }],
        headers: [],
      },
    ];

    await runHandler();

    const getCalls = ssmMock.commandCalls(GetParameterCommand);
    expect(getCalls.length).toBe(1);
    expect(getCalls[0].args[0].input.Name).toBe(`${prefix}support.foo.com`);
  });
});

describe("inbound-processor — feature-disabled path", () => {
  it("never calls SSM and always emits replyToken: null when prefix env is unset", async () => {
    parsedState.queue = [
      {
        from: { address: "sender@external.com" },
        to: [{ address: "something@r.mail.support.foo.com" }],
        headers: [],
      },
    ];

    await runHandler();

    const ev = await capturedPut();
    expect(ev.detail.replyToken).toBeNull();
    expect(ssmMock.commandCalls(GetParameterCommand).length).toBe(0);
  });
});
