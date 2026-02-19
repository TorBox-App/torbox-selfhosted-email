/**
 * Segment Evaluator Parity Tests
 *
 * Tests that the JS evaluator produces identical results to the SQL builder
 * for all shared operators. Each test targets a specific divergence.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@wraps/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => [],
        }),
      }),
    }),
  },
  contact: { id: "id" },
  contactEvent: {
    id: "id",
    contactId: "contact_id",
    eventName: "event_name",
    createdAt: "created_at",
  },
  contactTopic: {
    contactId: "contact_id",
    topicId: "topic_id",
    status: "status",
  },
  segment: { id: "id" },
  eq: vi.fn(),
}));

import type { SegmentFilter } from "@wraps/db";
import {
  evaluateFilter,
  type ContactWithTopics,
} from "../segment-evaluator";

const baseContact = {
  id: "contact-1",
  organizationId: "org-1",
  email: "test@example.com",
  emailHash: null,
  firstName: "John",
  lastName: "Doe",
  company: "Acme",
  jobTitle: null,
  preferredChannel: null,
  status: "active",
  emailStatus: "active" as const,
  smsStatus: null,
  phone: null,
  phoneHash: null,
  properties: { plan: "pro", score: 85 },
  emailsSent: 10,
  emailsOpened: 5,
  emailsClicked: 2,
  smsSent: 0,
  smsClicked: 0,
  lastActivityAt: new Date("2026-02-15T10:00:00Z"),
  lastEmailSentAt: new Date("2026-02-14T10:00:00Z"),
  lastEmailOpenedAt: new Date("2026-02-13T10:00:00Z"),
  lastEmailClickedAt: new Date("2026-02-12T10:00:00Z"),
  lastSmsSentAt: null,
  lastSmsClickedAt: null,
  emailVerifiedAt: null,
  emailUnsubscribedAt: null,
  emailBouncedAt: null,
  emailComplainedAt: null,
  emailSuppressedAt: null,
  smsConsentedAt: null,
  smsOptedOutAt: null,
  smsInvalidAt: null,
  confirmedAt: null,
  unsubscribedAt: null,
  bouncedAt: null,
  complainedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  createdBy: null,
  topicIds: ["topic-1"],
} satisfies ContactWithTopics;

describe("Segment Evaluator Parity — Unit 1: greaterThanOrEqual/lessThanOrEqual Date support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("greaterThanOrEqual returns true when Date is after comparison Date", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "greaterThanOrEqual",
      value: new Date("2025-12-01T00:00:00Z"),
    };
    // createdAt is 2026-01-01, which is >= 2025-12-01
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("greaterThanOrEqual returns true when Dates are equal", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "greaterThanOrEqual",
      value: new Date("2026-01-01T00:00:00Z"),
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("greaterThanOrEqual returns false when Date is before comparison Date", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "greaterThanOrEqual",
      value: new Date("2026-06-01T00:00:00Z"),
    };
    expect(evaluateFilter(filter, baseContact)).toBe(false);
  });

  it("lessThanOrEqual returns true when Date is before comparison Date", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "lessThanOrEqual",
      value: new Date("2026-06-01T00:00:00Z"),
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("lessThanOrEqual returns true when Dates are equal", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "lessThanOrEqual",
      value: new Date("2026-01-01T00:00:00Z"),
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("lessThanOrEqual returns false when Date is after comparison Date", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "lessThanOrEqual",
      value: new Date("2025-06-01T00:00:00Z"),
    };
    expect(evaluateFilter(filter, baseContact)).toBe(false);
  });
});

describe("Segment Evaluator Parity — Unit 2: Date comparisons parse ISO string values", () => {
  // SQL engine passes ISO strings to PostgreSQL which coerces to timestamp.
  // Filter conditions stored as JSON round-trip dates as strings, not Date objects.
  // The JS engine must parse these string dates for comparison.

  it("greaterThan matches when actualValue (Date) > value (ISO string)", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "greaterThan",
      // JSON round-trip: Date becomes string
      value: "2025-06-01T00:00:00Z",
    };
    // createdAt is 2026-01-01 which is > 2025-06-01
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("greaterThan does not match when actualValue (Date) < value (ISO string)", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "greaterThan",
      value: "2026-06-01T00:00:00Z",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(false);
  });

  it("lessThan matches when actualValue (Date) < value (ISO string)", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "lessThan",
      value: "2026-06-01T00:00:00Z",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("lessThan does not match when actualValue (Date) > value (ISO string)", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "lessThan",
      value: "2025-06-01T00:00:00Z",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(false);
  });

  it("greaterThanOrEqual matches when actualValue (Date) >= value (ISO string)", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "greaterThanOrEqual",
      value: "2026-01-01T00:00:00Z",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("lessThanOrEqual matches when actualValue (Date) <= value (ISO string)", () => {
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "lessThanOrEqual",
      value: "2026-01-01T00:00:00Z",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });
});

describe("Segment Evaluator Parity — Unit 3: exists/notExists empty string alignment", () => {
  // SQL engine: IS NOT NULL — empty string passes (it's not null)
  // JS engine: was checking !== "" which made empty strings fail exists
  // These should align with SQL: exists = IS NOT NULL (only null/undefined fail)

  it("exists returns true for empty string on standard field", () => {
    const contact = { ...baseContact, firstName: "" as string | null };
    const filter: SegmentFilter = {
      field: "firstName",
      operator: "exists",
    };
    // SQL: "" IS NOT NULL → true. JS should match.
    expect(evaluateFilter(filter, contact)).toBe(true);
  });

  it("notExists returns false for empty string on standard field", () => {
    const contact = { ...baseContact, firstName: "" as string | null };
    const filter: SegmentFilter = {
      field: "firstName",
      operator: "notExists",
    };
    // SQL: "" IS NULL → false. JS should match.
    expect(evaluateFilter(filter, contact)).toBe(false);
  });

  it("exists still returns false for null", () => {
    const contact = { ...baseContact, firstName: null };
    const filter: SegmentFilter = {
      field: "firstName",
      operator: "exists",
    };
    expect(evaluateFilter(filter, contact)).toBe(false);
  });

  it("notExists still returns true for null", () => {
    const contact = { ...baseContact, firstName: null };
    const filter: SegmentFilter = {
      field: "firstName",
      operator: "notExists",
    };
    expect(evaluateFilter(filter, contact)).toBe(true);
  });
});

describe("Segment Evaluator Parity — Unit 4: within defaults to days when unit is missing", () => {
  // SQL engine: defaults to days when unit is missing/undefined
  // JS engine: requires unit to be truthy, returns false without it

  it("within matches when unit is missing (defaults to days)", () => {
    const recentContact = {
      ...baseContact,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    };
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "within",
      value: 7,
      // unit intentionally omitted — SQL defaults to days
    };
    expect(evaluateFilter(filter, recentContact)).toBe(true);
  });

  it("within does not match when outside default days window", () => {
    const oldContact = {
      ...baseContact,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    };
    const filter: SegmentFilter = {
      field: "createdAt",
      operator: "within",
      value: 7,
      // unit intentionally omitted
    };
    expect(evaluateFilter(filter, oldContact)).toBe(false);
  });
});

describe("Segment Evaluator Parity — Unit 5: Property equals uses string coercion", () => {
  // SQL engine: properties->>'score' = '85' (text extraction via ->>)
  // JS engine: uses strict === which fails when JSONB number !== string filter value
  // Both should coerce to string comparison for properties

  it("equals matches number property against string value", () => {
    // properties.score is 85 (number from JSONB)
    // filter value is "85" (string from UI/JSON)
    // SQL: properties->>'score' = '85' → true (both strings via ->>)
    const filter: SegmentFilter = {
      field: "properties.score",
      operator: "equals",
      value: "85",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("equals matches string property against number value", () => {
    // properties.plan is "pro" (string)
    // This is the normal case — should still work
    const filter: SegmentFilter = {
      field: "properties.plan",
      operator: "equals",
      value: "pro",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("notEquals handles number property against string value", () => {
    const filter: SegmentFilter = {
      field: "properties.score",
      operator: "notEquals",
      value: "85",
    };
    // 85 as string === "85" → notEquals should be false
    expect(evaluateFilter(filter, baseContact)).toBe(false);
  });

  it("notEquals correctly identifies different values with type coercion", () => {
    const filter: SegmentFilter = {
      field: "properties.score",
      operator: "notEquals",
      value: "99",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("equals matches boolean property against string value", () => {
    const contact = {
      ...baseContact,
      properties: { ...baseContact.properties, active: true },
    };
    const filter: SegmentFilter = {
      field: "properties.active",
      operator: "equals",
      value: "true",
    };
    // SQL: properties->>'active' = 'true' → true
    expect(evaluateFilter(filter, contact)).toBe(true);
  });
});

describe("Segment Evaluator Parity — Unit 6: Property exists/notExists checks key existence", () => {
  // SQL engine: properties ? 'key' — checks if key exists in JSONB, regardless of value
  // For properties, the key can exist with any value (null, "", 0, false)

  it("exists returns true for property with null value (key exists)", () => {
    const contact = {
      ...baseContact,
      properties: { ...baseContact.properties, nullProp: null },
    };
    const filter: SegmentFilter = {
      field: "properties.nullProp",
      operator: "exists",
    };
    // SQL: properties ? 'nullProp' → true (key exists)
    expect(evaluateFilter(filter, contact)).toBe(true);
  });

  it("exists returns true for property with empty string value", () => {
    const contact = {
      ...baseContact,
      properties: { ...baseContact.properties, emptyProp: "" },
    };
    const filter: SegmentFilter = {
      field: "properties.emptyProp",
      operator: "exists",
    };
    // SQL: properties ? 'emptyProp' → true (key exists)
    expect(evaluateFilter(filter, contact)).toBe(true);
  });

  it("exists returns true for property with falsy value (0)", () => {
    const contact = {
      ...baseContact,
      properties: { ...baseContact.properties, zeroProp: 0 },
    };
    const filter: SegmentFilter = {
      field: "properties.zeroProp",
      operator: "exists",
    };
    expect(evaluateFilter(filter, contact)).toBe(true);
  });

  it("exists returns true for property with false value", () => {
    const contact = {
      ...baseContact,
      properties: { ...baseContact.properties, falseProp: false },
    };
    const filter: SegmentFilter = {
      field: "properties.falseProp",
      operator: "exists",
    };
    expect(evaluateFilter(filter, contact)).toBe(true);
  });

  it("exists returns false for non-existent property key", () => {
    const filter: SegmentFilter = {
      field: "properties.nonexistent",
      operator: "exists",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(false);
  });

  it("notExists returns true for non-existent property key", () => {
    const filter: SegmentFilter = {
      field: "properties.nonexistent",
      operator: "notExists",
    };
    expect(evaluateFilter(filter, baseContact)).toBe(true);
  });

  it("notExists returns false for property with null value (key exists)", () => {
    const contact = {
      ...baseContact,
      properties: { ...baseContact.properties, nullProp: null },
    };
    const filter: SegmentFilter = {
      field: "properties.nullProp",
      operator: "notExists",
    };
    // SQL: NOT (properties ? 'nullProp') → false (key exists)
    expect(evaluateFilter(filter, contact)).toBe(false);
  });
});
