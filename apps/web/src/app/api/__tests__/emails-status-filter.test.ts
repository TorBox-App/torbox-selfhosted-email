import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "user-1", email: "test@example.com", name: "Test" },
        session: {
          id: "session-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token",
        },
      })),
    },
  },
}));

vi.mock("@/lib/organization", () => ({
  getOrganizationWithMembership: vi.fn(async () => ({
    id: "org-1",
    name: "Test Org",
    slug: "test-org",
  })),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
  serializeError: (e: unknown) => e,
}));

const mockQueryEmailEvents = vi.fn();
const mockQueryEventsByMessageIds = vi.fn();
vi.mock("@/lib/aws/dynamodb", () => ({
  queryEmailEvents: (...args: unknown[]) => mockQueryEmailEvents(...args),
  queryEventsByMessageIds: (...args: unknown[]) =>
    mockQueryEventsByMessageIds(...args),
}));

vi.mock("@wraps/db", () => ({
  db: {
    query: {
      awsAccount: {
        findMany: vi.fn(async () => [
          { id: "acc-1", accountId: "123456789012", organizationId: "org-1" },
        ]),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    })),
  },
}));

vi.mock("@wraps/db/schema/app", () => ({
  awsAccount: { organizationId: "organizationId" },
}));

vi.mock("@wraps/db/schema/batch", () => ({
  messageSend: {
    id: "id",
    messageId: "messageId",
    from: "from",
    recipient: "recipient",
    subject: "subject",
    status: "status",
    sentAt: "sentAt",
    openedAt: "openedAt",
    clickedAt: "clickedAt",
    organizationId: "organizationId",
    channel: "channel",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ op: "and", args }),
  eq: (col: unknown, val: unknown) => ({ op: "eq", col, val }),
  gte: (col: unknown, val: unknown) => ({ op: "gte", col, val }),
  lte: (col: unknown, val: unknown) => ({ op: "lte", col, val }),
  isNotNull: (col: unknown) => ({ op: "isNotNull", col }),
  desc: (col: unknown) => ({ op: "desc", col }),
}));

const now = Date.now();
const baseEvent = {
  accountId: "123456789012",
  from: "sender@example.com",
  to: ["recipient@example.com"],
  subject: "Test Email",
  createdAt: now,
  expiresAt: now + 86_400_000,
};

function makeSendEvent(messageId: string, sentAt = now - 1000) {
  return {
    ...baseEvent,
    messageId,
    sentAt,
    mailSentAt: sentAt,
    eventType: "Send",
    eventData: "{}",
  };
}

function makeBounceEvent(messageId: string, sentAt = now - 1000) {
  return {
    ...baseEvent,
    messageId,
    sentAt: sentAt + 500,
    mailSentAt: sentAt,
    eventType: "Bounce",
    eventData: "{}",
  };
}

function makeComplaintEvent(messageId: string, sentAt = now - 1000) {
  return {
    ...baseEvent,
    messageId,
    sentAt: sentAt + 500,
    mailSentAt: sentAt,
    eventType: "Complaint",
    eventData: "{}",
  };
}

function makeDeliveryEvent(messageId: string, sentAt = now - 1000) {
  return {
    ...baseEvent,
    messageId,
    sentAt: sentAt + 200,
    mailSentAt: sentAt,
    eventType: "Delivery",
    eventData: "{}",
  };
}

describe("Emails API — server-side status filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryEventsByMessageIds.mockResolvedValue([]);
  });

  it("returns all emails when no status param is provided", async () => {
    mockQueryEmailEvents.mockResolvedValueOnce([
      makeSendEvent("msg-bounce-1"),
      makeBounceEvent("msg-bounce-1"),
      makeSendEvent("msg-complaint-1"),
      makeComplaintEvent("msg-complaint-1"),
      makeSendEvent("msg-delivered-1"),
      makeDeliveryEvent("msg-delivered-1"),
    ]);

    const { GET } = await import("../[orgSlug]/emails/route");
    const request = new Request(
      "http://localhost/api/test-org/emails?days=7&limit=100"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);

    const statuses = data.map((e: { status: string }) => e.status);
    expect(statuses).toContain("bounced");
    expect(statuses).toContain("complained");
    expect(statuses).toContain("delivered");
  });

  it("returns only bounced emails when status=bounced", async () => {
    mockQueryEmailEvents.mockResolvedValueOnce([
      makeSendEvent("msg-bounce-1"),
      makeBounceEvent("msg-bounce-1"),
      makeSendEvent("msg-complaint-1"),
      makeComplaintEvent("msg-complaint-1"),
      makeSendEvent("msg-delivered-1"),
      makeDeliveryEvent("msg-delivered-1"),
    ]);

    const { GET } = await import("../[orgSlug]/emails/route");
    const request = new Request(
      "http://localhost/api/test-org/emails?days=7&limit=100&status=bounced"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe("bounced");
    expect(data[0].messageId).toBe("msg-bounce-1");
  });

  it("returns only complained emails when status=complained", async () => {
    mockQueryEmailEvents.mockResolvedValueOnce([
      makeSendEvent("msg-bounce-1"),
      makeBounceEvent("msg-bounce-1"),
      makeSendEvent("msg-complaint-1"),
      makeComplaintEvent("msg-complaint-1"),
      makeSendEvent("msg-delivered-1"),
      makeDeliveryEvent("msg-delivered-1"),
    ]);

    const { GET } = await import("../[orgSlug]/emails/route");
    const request = new Request(
      "http://localhost/api/test-org/emails?days=7&limit=100&status=complained"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe("complained");
    expect(data[0].messageId).toBe("msg-complaint-1");
  });

  it("ignores invalid status values to prevent injection", async () => {
    mockQueryEmailEvents.mockResolvedValueOnce([
      makeSendEvent("msg-bounce-1"),
      makeBounceEvent("msg-bounce-1"),
      makeSendEvent("msg-delivered-1"),
      makeDeliveryEvent("msg-delivered-1"),
    ]);

    const { GET } = await import("../[orgSlug]/emails/route");
    const request = new Request(
      "http://localhost/api/test-org/emails?days=7&limit=100&status=invalid_status"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
  });
});
