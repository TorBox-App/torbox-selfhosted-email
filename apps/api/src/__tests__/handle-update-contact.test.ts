/**
 * handleUpdateContact Tests
 *
 * Tests the update_contact workflow step handler, focusing on:
 * 1. First-class field updates (set/unset)
 * 2. Custom property operations (increment, decrement, append, remove)
 * 3. Organization scoping on the DB write
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Track what the DB receives
let lastUpdateSet: Record<string, unknown> | null = null;
let lastUpdateWhereArg: unknown = null;

// Mock drizzle-orm (and, sql are imported from here in the source)
const mockAnd = vi.fn((...args: unknown[]) => ({ _op: "and", args }));
const mockSql = Object.assign(
  vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    _sql: true,
    strings,
    values,
  })),
  { raw: vi.fn() }
);

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => mockAnd(...args),
  sql: mockSql,
}));

// Mock eq from @wraps/db
const mockEq = vi.fn((a: unknown, b: unknown) => ({ _op: "eq", a, b }));

vi.mock("@wraps/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        lastUpdateSet = values;
        return {
          where: vi.fn((condition: unknown) => {
            lastUpdateWhereArg = condition;
            return Promise.resolve();
          }),
        };
      }),
    })),
  },
  contact: {
    id: "contact.id",
    organizationId: "contact.organizationId",
  },
  eq: (a: unknown, b: unknown) => mockEq(a, b),
  CASCADE_ENGAGEMENT_FIELD: "engagement.status",
  awsAccount: {},
  contactTopic: {},
  messageSend: {},
  organization: {},
  template: {},
  workflow: {},
  workflowExecution: {},
  workflowStepExecution: {},
}));

vi.mock("@wraps/email", () => ({
  generateSESTemplateName: vi.fn(),
  transformVariablesForSes: vi.fn(),
  upsertSESTemplate: vi.fn(),
}));

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn(() => ""),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn(),
}));

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn(),
}));

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn(),
}));

vi.mock("../services/workflow-queue", () => ({
  deleteScheduledStep: vi.fn(),
  enqueueWorkflowStep: vi.fn(),
  enqueueWorkflowStepBatch: vi.fn(),
  scheduleWaitTimeout: vi.fn(),
  scheduleWorkflowStep: vi.fn(),
}));

vi.mock("../services/workflow-scheduler", () => ({
  createNextWorkflowSchedule: vi.fn(),
}));

vi.mock("handlebars", () => ({
  default: { compile: vi.fn(() => vi.fn(() => "")) },
}));

function makeContact(overrides: Record<string, unknown> = {}) {
  return {
    id: "contact-1",
    organizationId: "org-1",
    email: "test@example.com",
    properties: { score: 10, tags: ["a", "b"] },
    ...overrides,
  } as any;
}

beforeEach(() => {
  lastUpdateSet = null;
  lastUpdateWhereArg = null;
  vi.clearAllMocks();
});

describe("handleUpdateContact", () => {
  it("scopes DB update by both contactId and organizationId", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    await handleUpdateContact(
      {
        type: "update_contact",
        updates: [{ field: "firstName", operation: "set", value: "Jane" }],
      },
      makeContact()
    );

    expect(mockAnd).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledWith("contact.id", "contact-1");
    expect(mockEq).toHaveBeenCalledWith("contact.organizationId", "org-1");
  });

  it("sets first-class fields directly", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    const result = await handleUpdateContact(
      {
        type: "update_contact",
        updates: [
          { field: "firstName", operation: "set", value: "Jane" },
          { field: "lastName", operation: "set", value: "Doe" },
          { field: "company", operation: "set", value: "Acme" },
        ],
      },
      makeContact()
    );

    expect(result.action).toBe("next");
    expect(lastUpdateSet?.firstName).toBe("Jane");
    expect(lastUpdateSet?.lastName).toBe("Doe");
    expect(lastUpdateSet?.company).toBe("Acme");
  });

  it("unsets first-class fields to null", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    await handleUpdateContact(
      {
        type: "update_contact",
        updates: [{ field: "firstName", operation: "unset", value: "" }],
      },
      makeContact()
    );

    expect(lastUpdateSet?.firstName).toBeNull();
  });

  it("sets custom properties", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    await handleUpdateContact(
      {
        type: "update_contact",
        updates: [{ field: "plan", operation: "set", value: "pro" }],
      },
      makeContact()
    );

    const props = lastUpdateSet?.properties as Record<string, unknown>;
    expect(props.plan).toBe("pro");
    expect(props.score).toBe(10);
  });

  it("increments numeric properties", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    await handleUpdateContact(
      {
        type: "update_contact",
        updates: [{ field: "score", operation: "increment", value: 5 }],
      },
      makeContact()
    );

    const props = lastUpdateSet?.properties as Record<string, unknown>;
    expect(props.score).toBe(15);
  });

  it("decrements numeric properties", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    await handleUpdateContact(
      {
        type: "update_contact",
        updates: [{ field: "score", operation: "decrement", value: 3 }],
      },
      makeContact()
    );

    const props = lastUpdateSet?.properties as Record<string, unknown>;
    expect(props.score).toBe(7);
  });

  it("appends to array properties", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    await handleUpdateContact(
      {
        type: "update_contact",
        updates: [{ field: "tags", operation: "append", value: "c" }],
      },
      makeContact()
    );

    const props = lastUpdateSet?.properties as Record<string, unknown>;
    expect(props.tags).toEqual(["a", "b", "c"]);
  });

  it("removes from array properties", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    await handleUpdateContact(
      {
        type: "update_contact",
        updates: [{ field: "tags", operation: "remove", value: "a" }],
      },
      makeContact()
    );

    const props = lastUpdateSet?.properties as Record<string, unknown>;
    expect(props.tags).toEqual(["b"]);
  });

  it("returns updated field names in data", async () => {
    const { handleUpdateContact } = await import(
      "../(ee)/workers/workflow-processor"
    );

    const result = await handleUpdateContact(
      {
        type: "update_contact",
        updates: [
          { field: "firstName", operation: "set", value: "Jane" },
          { field: "score", operation: "increment", value: 1 },
        ],
      },
      makeContact()
    );

    expect(result.data.updatedFields).toEqual(["firstName", "score"]);
  });
});
