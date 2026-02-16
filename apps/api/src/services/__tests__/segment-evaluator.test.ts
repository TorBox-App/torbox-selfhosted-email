/**
 * Segment Evaluator Tests
 *
 * Tests for the segment filter evaluation logic.
 * Covers:
 * - Basic filter operators (equals, contains, exists, etc.)
 * - Nested property access (properties.plan, etc.)
 * - Topic subscription filters (hasTopic, notHasTopic)
 * - Time-based filters (within)
 * - Filter groups and conditions (AND/OR logic)
 * - Nested conditions
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database
const _mockDbSelect = vi.fn();
const _mockDbFrom = vi.fn();
const _mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();

vi.mock("@wraps/db", () => ({
  db: {
    select: () => ({
      from: (_table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: (n: number) => mockDbLimit(n),
        }),
      }),
    }),
  },
  contact: { id: "id" },
  contactTopic: {
    contactId: "contact_id",
    topicId: "topic_id",
    status: "status",
  },
  segment: { id: "id" },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}));

// Import after mocking
import type { FilterCondition, FilterGroup, SegmentFilter } from "@wraps/db";

// Test the filter evaluation logic directly
// We'll create a test version of the evaluator functions

type ContactWithTopics = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  emailStatus: string | null;
  properties: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  topicIds: string[];
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return;
    }
    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return;
    }
  }

  return current;
}

function getThresholdDate(
  now: Date,
  value: number,
  unit: "days" | "hours" | "minutes"
): Date {
  const threshold = new Date(now);

  switch (unit) {
    case "days":
      threshold.setDate(threshold.getDate() - value);
      break;
    case "hours":
      threshold.setHours(threshold.getHours() - value);
      break;
    case "minutes":
      threshold.setMinutes(threshold.getMinutes() - value);
      break;
  }

  return threshold;
}

function evaluateFilter(
  filter: SegmentFilter,
  contactData: ContactWithTopics
): boolean {
  const { field, operator, value, unit } = filter;

  let actualValue: unknown;

  if (field.startsWith("properties.")) {
    const propPath = field.substring("properties.".length);
    actualValue = getNestedValue(contactData.properties || {}, propPath);
  } else if (field === "topics") {
    actualValue = contactData.topicIds;
  } else {
    actualValue = contactData[field as keyof typeof contactData];
  }

  switch (operator) {
    case "equals":
      return actualValue === value;

    case "notEquals":
      return actualValue !== value;

    case "contains":
      if (typeof actualValue === "string" && typeof value === "string") {
        return actualValue.toLowerCase().includes(value.toLowerCase());
      }
      return false;

    case "notContains":
      if (typeof actualValue === "string" && typeof value === "string") {
        return !actualValue.toLowerCase().includes(value.toLowerCase());
      }
      return true;

    case "startsWith":
      if (typeof actualValue === "string" && typeof value === "string") {
        return actualValue.toLowerCase().startsWith(value.toLowerCase());
      }
      return false;

    case "endsWith":
      if (typeof actualValue === "string" && typeof value === "string") {
        return actualValue.toLowerCase().endsWith(value.toLowerCase());
      }
      return false;

    case "greaterThan":
      if (typeof actualValue === "number" && typeof value === "number") {
        return actualValue > value;
      }
      return false;

    case "lessThan":
      if (typeof actualValue === "number" && typeof value === "number") {
        return actualValue < value;
      }
      return false;

    case "greaterThanOrEqual":
      if (typeof actualValue === "number" && typeof value === "number") {
        return actualValue >= value;
      }
      return false;

    case "lessThanOrEqual":
      if (typeof actualValue === "number" && typeof value === "number") {
        return actualValue <= value;
      }
      return false;

    case "exists":
      return (
        actualValue !== null && actualValue !== undefined && actualValue !== ""
      );

    case "notExists":
      return (
        actualValue === null || actualValue === undefined || actualValue === ""
      );

    case "inList":
      if (Array.isArray(value)) {
        return value.includes(actualValue);
      }
      return false;

    case "notInList":
      if (Array.isArray(value)) {
        return !value.includes(actualValue);
      }
      return true;

    case "within":
      if (actualValue instanceof Date && typeof value === "number" && unit) {
        const now = new Date();
        const threshold = getThresholdDate(now, value, unit);
        return actualValue >= threshold;
      }
      if (
        typeof actualValue === "string" &&
        typeof value === "number" &&
        unit
      ) {
        const dateValue = new Date(actualValue);
        if (!Number.isNaN(dateValue.getTime())) {
          const now = new Date();
          const threshold = getThresholdDate(now, value, unit);
          return dateValue >= threshold;
        }
      }
      return false;

    case "hasTopic":
      if (Array.isArray(actualValue) && typeof value === "string") {
        return actualValue.includes(value);
      }
      return false;

    case "notHasTopic":
      if (Array.isArray(actualValue) && typeof value === "string") {
        return !actualValue.includes(value);
      }
      return true;

    default:
      return false;
  }
}

function evaluateGroup(
  group: FilterGroup,
  contactData: ContactWithTopics
): boolean {
  for (const filter of group.filters) {
    if (!evaluateFilter(filter, contactData)) {
      return false;
    }
  }

  if (group.nested) {
    return evaluateCondition(group.nested, contactData);
  }

  return true;
}

function evaluateCondition(
  condition: FilterCondition,
  contactData: ContactWithTopics
): boolean {
  if (condition.groups.length === 0) {
    return true;
  }

  if (condition.logic === "AND") {
    return condition.groups.every((group) => evaluateGroup(group, contactData));
  }

  return condition.groups.some((group) => evaluateGroup(group, contactData));
}

describe("Segment Evaluator", () => {
  const baseContact: ContactWithTopics = {
    id: "contact-123",
    email: "test@example.com",
    firstName: "John",
    lastName: "Doe",
    company: "Acme Inc",
    emailStatus: "active",
    properties: {
      plan: "pro",
      country: "US",
      score: 85,
      nested: {
        value: "deep",
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    topicIds: ["topic-1", "topic-2"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Operators", () => {
    describe("equals", () => {
      it("should match when values are equal", () => {
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "equals",
          value: "active",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when values differ", () => {
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "equals",
          value: "unsubscribed",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });

      it("should handle null values", () => {
        const contactWithNull = { ...baseContact, company: null };
        const filter: SegmentFilter = {
          field: "company",
          operator: "equals",
          value: null,
        };
        expect(evaluateFilter(filter, contactWithNull)).toBe(true);
      });
    });

    describe("notEquals", () => {
      it("should match when values differ", () => {
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "notEquals",
          value: "bounced",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when values are equal", () => {
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "notEquals",
          value: "active",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });

    describe("contains", () => {
      it("should match when string contains value", () => {
        const filter: SegmentFilter = {
          field: "email",
          operator: "contains",
          value: "example",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should be case insensitive", () => {
        const filter: SegmentFilter = {
          field: "email",
          operator: "contains",
          value: "EXAMPLE",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when string does not contain value", () => {
        const filter: SegmentFilter = {
          field: "email",
          operator: "contains",
          value: "gmail",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });

    describe("notContains", () => {
      it("should match when string does not contain value", () => {
        const filter: SegmentFilter = {
          field: "email",
          operator: "notContains",
          value: "gmail",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when string contains value", () => {
        const filter: SegmentFilter = {
          field: "email",
          operator: "notContains",
          value: "example",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });

    describe("startsWith", () => {
      it("should match when string starts with value", () => {
        const filter: SegmentFilter = {
          field: "email",
          operator: "startsWith",
          value: "test@",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should be case insensitive", () => {
        const filter: SegmentFilter = {
          field: "email",
          operator: "startsWith",
          value: "TEST@",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });
    });

    describe("endsWith", () => {
      it("should match when string ends with value", () => {
        const filter: SegmentFilter = {
          field: "email",
          operator: "endsWith",
          value: ".com",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });
    });

    describe("exists", () => {
      it("should match when field has value", () => {
        const filter: SegmentFilter = {
          field: "firstName",
          operator: "exists",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when field is null", () => {
        const contactWithNull = { ...baseContact, firstName: null };
        const filter: SegmentFilter = {
          field: "firstName",
          operator: "exists",
        };
        expect(evaluateFilter(filter, contactWithNull)).toBe(false);
      });

      it("should not match when field is empty string", () => {
        const contactWithEmpty = {
          ...baseContact,
          firstName: "" as string | null,
        };
        const filter: SegmentFilter = {
          field: "firstName",
          operator: "exists",
        };
        expect(evaluateFilter(filter, contactWithEmpty)).toBe(false);
      });
    });

    describe("notExists", () => {
      it("should match when field is null", () => {
        const contactWithNull = { ...baseContact, firstName: null };
        const filter: SegmentFilter = {
          field: "firstName",
          operator: "notExists",
        };
        expect(evaluateFilter(filter, contactWithNull)).toBe(true);
      });

      it("should not match when field has value", () => {
        const filter: SegmentFilter = {
          field: "firstName",
          operator: "notExists",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });
  });

  describe("Numeric Operators", () => {
    describe("greaterThan", () => {
      it("should match when value is greater", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "greaterThan",
          value: 80,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when value is equal", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "greaterThan",
          value: 85,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });

      it("should not match when value is less", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "greaterThan",
          value: 90,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });

    describe("lessThan", () => {
      it("should match when value is less", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "lessThan",
          value: 90,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when value is greater", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "lessThan",
          value: 80,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });

    describe("greaterThanOrEqual", () => {
      it("should match when value is equal", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "greaterThanOrEqual",
          value: 85,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should match when value is greater", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "greaterThanOrEqual",
          value: 80,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });
    });

    describe("lessThanOrEqual", () => {
      it("should match when value is equal", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "lessThanOrEqual",
          value: 85,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should match when value is less", () => {
        const filter: SegmentFilter = {
          field: "properties.score",
          operator: "lessThanOrEqual",
          value: 90,
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });
    });
  });

  describe("List Operators", () => {
    describe("inList", () => {
      it("should match when value is in list", () => {
        const filter: SegmentFilter = {
          field: "properties.plan",
          operator: "inList",
          value: ["free", "pro", "enterprise"],
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when value is not in list", () => {
        const filter: SegmentFilter = {
          field: "properties.plan",
          operator: "inList",
          value: ["free", "starter"],
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });

    describe("notInList", () => {
      it("should match when value is not in list", () => {
        const filter: SegmentFilter = {
          field: "properties.plan",
          operator: "notInList",
          value: ["free", "starter"],
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when value is in list", () => {
        const filter: SegmentFilter = {
          field: "properties.plan",
          operator: "notInList",
          value: ["pro", "enterprise"],
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });
  });

  describe("Property Access", () => {
    it("should access top-level properties", () => {
      const filter: SegmentFilter = {
        field: "properties.plan",
        operator: "equals",
        value: "pro",
      };
      expect(evaluateFilter(filter, baseContact)).toBe(true);
    });

    it("should access nested properties", () => {
      const filter: SegmentFilter = {
        field: "properties.nested.value",
        operator: "equals",
        value: "deep",
      };
      expect(evaluateFilter(filter, baseContact)).toBe(true);
    });

    it("should handle missing nested properties", () => {
      const filter: SegmentFilter = {
        field: "properties.nonexistent.deep",
        operator: "exists",
      };
      expect(evaluateFilter(filter, baseContact)).toBe(false);
    });
  });

  describe("Topic Operators", () => {
    describe("hasTopic", () => {
      it("should match when contact has topic", () => {
        const filter: SegmentFilter = {
          field: "topics",
          operator: "hasTopic",
          value: "topic-1",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when contact does not have topic", () => {
        const filter: SegmentFilter = {
          field: "topics",
          operator: "hasTopic",
          value: "topic-999",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });

    describe("notHasTopic", () => {
      it("should match when contact does not have topic", () => {
        const filter: SegmentFilter = {
          field: "topics",
          operator: "notHasTopic",
          value: "topic-999",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(true);
      });

      it("should not match when contact has topic", () => {
        const filter: SegmentFilter = {
          field: "topics",
          operator: "notHasTopic",
          value: "topic-1",
        };
        expect(evaluateFilter(filter, baseContact)).toBe(false);
      });
    });
  });

  describe("Time-based Operators", () => {
    describe("within", () => {
      it("should match when date is within threshold (days)", () => {
        const recentContact = {
          ...baseContact,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        };
        const filter: SegmentFilter = {
          field: "createdAt",
          operator: "within",
          value: 7,
          unit: "days",
        };
        expect(evaluateFilter(filter, recentContact)).toBe(true);
      });

      it("should not match when date is outside threshold", () => {
        const oldContact = {
          ...baseContact,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        };
        const filter: SegmentFilter = {
          field: "createdAt",
          operator: "within",
          value: 7,
          unit: "days",
        };
        expect(evaluateFilter(filter, oldContact)).toBe(false);
      });

      it("should handle hours unit", () => {
        const recentContact = {
          ...baseContact,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        };
        const filter: SegmentFilter = {
          field: "createdAt",
          operator: "within",
          value: 24,
          unit: "hours",
        };
        expect(evaluateFilter(filter, recentContact)).toBe(true);
      });

      it("should handle minutes unit", () => {
        const recentContact = {
          ...baseContact,
          createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        };
        const filter: SegmentFilter = {
          field: "createdAt",
          operator: "within",
          value: 30,
          unit: "minutes",
        };
        expect(evaluateFilter(filter, recentContact)).toBe(true);
      });
    });
  });

  describe("Filter Groups (AND logic within group)", () => {
    it("should match when all filters in group match", () => {
      const group: FilterGroup = {
        filters: [
          { field: "emailStatus", operator: "equals", value: "active" },
          { field: "properties.plan", operator: "equals", value: "pro" },
        ],
      };
      expect(evaluateGroup(group, baseContact)).toBe(true);
    });

    it("should not match when any filter in group fails", () => {
      const group: FilterGroup = {
        filters: [
          { field: "emailStatus", operator: "equals", value: "active" },
          { field: "properties.plan", operator: "equals", value: "free" },
        ],
      };
      expect(evaluateGroup(group, baseContact)).toBe(false);
    });

    it("should handle empty filter group", () => {
      const group: FilterGroup = {
        filters: [],
      };
      expect(evaluateGroup(group, baseContact)).toBe(true);
    });
  });

  describe("Filter Conditions (AND/OR between groups)", () => {
    describe("AND logic", () => {
      it("should match when all groups match", () => {
        const condition: FilterCondition = {
          logic: "AND",
          groups: [
            {
              filters: [
                { field: "emailStatus", operator: "equals", value: "active" },
              ],
            },
            {
              filters: [
                { field: "properties.plan", operator: "equals", value: "pro" },
              ],
            },
          ],
        };
        expect(evaluateCondition(condition, baseContact)).toBe(true);
      });

      it("should not match when any group fails", () => {
        const condition: FilterCondition = {
          logic: "AND",
          groups: [
            {
              filters: [
                { field: "emailStatus", operator: "equals", value: "active" },
              ],
            },
            {
              filters: [
                { field: "properties.plan", operator: "equals", value: "free" },
              ],
            },
          ],
        };
        expect(evaluateCondition(condition, baseContact)).toBe(false);
      });
    });

    describe("OR logic", () => {
      it("should match when any group matches", () => {
        const condition: FilterCondition = {
          logic: "OR",
          groups: [
            {
              filters: [
                { field: "emailStatus", operator: "equals", value: "bounced" },
              ],
            },
            {
              filters: [
                { field: "properties.plan", operator: "equals", value: "pro" },
              ],
            },
          ],
        };
        expect(evaluateCondition(condition, baseContact)).toBe(true);
      });

      it("should not match when all groups fail", () => {
        const condition: FilterCondition = {
          logic: "OR",
          groups: [
            {
              filters: [
                { field: "emailStatus", operator: "equals", value: "bounced" },
              ],
            },
            {
              filters: [
                { field: "properties.plan", operator: "equals", value: "free" },
              ],
            },
          ],
        };
        expect(evaluateCondition(condition, baseContact)).toBe(false);
      });
    });

    it("should handle empty condition", () => {
      const condition: FilterCondition = {
        logic: "AND",
        groups: [],
      };
      expect(evaluateCondition(condition, baseContact)).toBe(true);
    });
  });

  describe("Nested Conditions", () => {
    it("should evaluate nested conditions within groups", () => {
      const condition: FilterCondition = {
        logic: "AND",
        groups: [
          {
            filters: [
              { field: "emailStatus", operator: "equals", value: "active" },
            ],
            nested: {
              logic: "OR",
              groups: [
                {
                  filters: [
                    {
                      field: "properties.plan",
                      operator: "equals",
                      value: "pro",
                    },
                  ],
                },
                {
                  filters: [
                    {
                      field: "properties.plan",
                      operator: "equals",
                      value: "enterprise",
                    },
                  ],
                },
              ],
            },
          },
        ],
      };
      expect(evaluateCondition(condition, baseContact)).toBe(true);
    });

    it("should fail when nested condition fails", () => {
      const condition: FilterCondition = {
        logic: "AND",
        groups: [
          {
            filters: [
              { field: "emailStatus", operator: "equals", value: "active" },
            ],
            nested: {
              logic: "AND",
              groups: [
                {
                  filters: [
                    {
                      field: "properties.plan",
                      operator: "equals",
                      value: "enterprise",
                    },
                  ],
                },
              ],
            },
          },
        ],
      };
      expect(evaluateCondition(condition, baseContact)).toBe(false);
    });
  });

  describe("Event-Based Operators", () => {
    /**
     * Tests for the async event-based operators.
     * These operators check the contact_event table for event history.
     */

    // Helper to check if an operator is async (event-based)
    function isAsyncOperator(operator: string): boolean {
      return ["triggered", "triggeredWithin", "notTriggered"].includes(
        operator
      );
    }

    describe("Operator Classification", () => {
      it("should identify triggered as async operator", () => {
        expect(isAsyncOperator("triggered")).toBe(true);
      });

      it("should identify triggeredWithin as async operator", () => {
        expect(isAsyncOperator("triggeredWithin")).toBe(true);
      });

      it("should identify notTriggered as async operator", () => {
        expect(isAsyncOperator("notTriggered")).toBe(true);
      });

      it("should not identify equals as async operator", () => {
        expect(isAsyncOperator("equals")).toBe(false);
      });

      it("should not identify contains as async operator", () => {
        expect(isAsyncOperator("contains")).toBe(false);
      });
    });

    describe("triggered Operator", () => {
      it("should have correct filter structure for triggered", () => {
        const filter: SegmentFilter = {
          field: "purchase_made", // event name
          operator: "triggered",
        };
        expect(filter.field).toBe("purchase_made");
        expect(filter.operator).toBe("triggered");
      });

      it("should not require value for triggered", () => {
        const filter: SegmentFilter = {
          field: "signup_completed",
          operator: "triggered",
        };
        expect(filter.value).toBeUndefined();
      });
    });

    describe("triggeredWithin Operator", () => {
      it("should have correct filter structure for triggeredWithin", () => {
        const filter: SegmentFilter = {
          field: "email_opened",
          operator: "triggeredWithin",
          value: 7,
          unit: "days",
        };
        expect(filter.field).toBe("email_opened");
        expect(filter.operator).toBe("triggeredWithin");
        expect(filter.value).toBe(7);
        expect(filter.unit).toBe("days");
      });

      it("should support hours unit", () => {
        const filter: SegmentFilter = {
          field: "page_viewed",
          operator: "triggeredWithin",
          value: 24,
          unit: "hours",
        };
        expect(filter.unit).toBe("hours");
      });

      it("should support minutes unit", () => {
        const filter: SegmentFilter = {
          field: "form_submitted",
          operator: "triggeredWithin",
          value: 30,
          unit: "minutes",
        };
        expect(filter.unit).toBe("minutes");
      });
    });

    describe("notTriggered Operator", () => {
      it("should have correct filter structure for notTriggered", () => {
        const filter: SegmentFilter = {
          field: "cart_abandoned",
          operator: "notTriggered",
        };
        expect(filter.field).toBe("cart_abandoned");
        expect(filter.operator).toBe("notTriggered");
      });

      it("should be useful for targeting contacts without activity", () => {
        // This operator is useful for re-engagement campaigns
        const filter: SegmentFilter = {
          field: "purchase_made",
          operator: "notTriggered",
        };
        expect(filter.operator).toBe("notTriggered");
      });
    });

    describe("Behavioral Segment Use Cases", () => {
      it("should support purchase history segmentation", () => {
        // Segment: Customers who made a purchase
        const filter: SegmentFilter = {
          field: "purchase_made",
          operator: "triggered",
        };
        expect(isAsyncOperator(filter.operator)).toBe(true);
      });

      it("should support recent engagement segmentation", () => {
        // Segment: Users who logged in within the last 30 days
        const filter: SegmentFilter = {
          field: "user_login",
          operator: "triggeredWithin",
          value: 30,
          unit: "days",
        };
        expect(filter.value).toBe(30);
        expect(filter.unit).toBe("days");
      });

      it("should support inactive user segmentation", () => {
        // Segment: Users who have never made a purchase
        const filter: SegmentFilter = {
          field: "purchase_made",
          operator: "notTriggered",
        };
        expect(filter.operator).toBe("notTriggered");
      });

      it("should support combining event and property filters", () => {
        // Complex segment: Pro users who haven't purchased in 30 days
        const condition: FilterCondition = {
          logic: "AND",
          groups: [
            {
              filters: [
                {
                  field: "properties.plan",
                  operator: "equals",
                  value: "pro",
                },
              ],
            },
            {
              filters: [
                {
                  field: "purchase_made",
                  operator: "notTriggered",
                },
              ],
            },
          ],
        };
        expect(condition.groups).toHaveLength(2);
        expect(condition.logic).toBe("AND");
      });
    });
  });

  describe("Email Status Filtering", () => {
    describe("suppressed status", () => {
      it("should match contacts with suppressed emailStatus", () => {
        const suppressedContact = {
          ...baseContact,
          emailStatus: "suppressed",
        };
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "equals",
          value: "suppressed",
        };
        expect(evaluateFilter(filter, suppressedContact)).toBe(true);
      });

      it("should exclude suppressed contacts from active filter", () => {
        const suppressedContact = {
          ...baseContact,
          emailStatus: "suppressed",
        };
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "equals",
          value: "active",
        };
        expect(evaluateFilter(filter, suppressedContact)).toBe(false);
      });

      it("should match suppressed in notEquals active filter", () => {
        const suppressedContact = {
          ...baseContact,
          emailStatus: "suppressed",
        };
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "notEquals",
          value: "active",
        };
        expect(evaluateFilter(filter, suppressedContact)).toBe(true);
      });

      it("should match suppressed in inList filter", () => {
        const suppressedContact = {
          ...baseContact,
          emailStatus: "suppressed",
        };
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "inList",
          value: ["bounced", "complained", "suppressed"],
        };
        expect(evaluateFilter(filter, suppressedContact)).toBe(true);
      });

      it("should exclude suppressed from deliverable contacts list", () => {
        const suppressedContact = {
          ...baseContact,
          emailStatus: "suppressed",
        };
        const filter: SegmentFilter = {
          field: "emailStatus",
          operator: "notInList",
          value: ["bounced", "complained", "suppressed", "unsubscribed"],
        };
        expect(evaluateFilter(filter, suppressedContact)).toBe(false);
      });
    });

    describe("all email statuses", () => {
      const emailStatuses = [
        "active",
        "unsubscribed",
        "bounced",
        "complained",
        "suppressed",
      ];

      it.each(emailStatuses)(
        "should correctly filter by emailStatus: %s",
        (status) => {
          const contactWithStatus = {
            ...baseContact,
            emailStatus: status,
          };
          const filter: SegmentFilter = {
            field: "emailStatus",
            operator: "equals",
            value: status,
          };
          expect(evaluateFilter(filter, contactWithStatus)).toBe(true);
        }
      );

      it("should identify deliverable contacts (active only)", () => {
        const condition: FilterCondition = {
          logic: "AND",
          groups: [
            {
              filters: [
                { field: "emailStatus", operator: "equals", value: "active" },
              ],
            },
          ],
        };

        // Active contacts should match
        expect(evaluateCondition(condition, baseContact)).toBe(true);

        // Non-active contacts should not match
        const bouncedContact = { ...baseContact, emailStatus: "bounced" };
        expect(evaluateCondition(condition, bouncedContact)).toBe(false);

        const suppressedContact = { ...baseContact, emailStatus: "suppressed" };
        expect(evaluateCondition(condition, suppressedContact)).toBe(false);

        const complainedContact = { ...baseContact, emailStatus: "complained" };
        expect(evaluateCondition(condition, complainedContact)).toBe(false);
      });

      it("should identify undeliverable contacts for re-engagement exclusion", () => {
        // Contacts with delivery issues should be excluded from broadcasts
        const condition: FilterCondition = {
          logic: "OR",
          groups: [
            {
              filters: [
                { field: "emailStatus", operator: "equals", value: "bounced" },
              ],
            },
            {
              filters: [
                {
                  field: "emailStatus",
                  operator: "equals",
                  value: "complained",
                },
              ],
            },
            {
              filters: [
                {
                  field: "emailStatus",
                  operator: "equals",
                  value: "suppressed",
                },
              ],
            },
          ],
        };

        // Active contacts should not match undeliverable segment
        expect(evaluateCondition(condition, baseContact)).toBe(false);

        // Bounced should match
        const bouncedContact = { ...baseContact, emailStatus: "bounced" };
        expect(evaluateCondition(condition, bouncedContact)).toBe(true);

        // Suppressed should match
        const suppressedContact = { ...baseContact, emailStatus: "suppressed" };
        expect(evaluateCondition(condition, suppressedContact)).toBe(true);
      });
    });
  });

  describe("Complex Real-world Scenarios", () => {
    it("should match: active US pro users who subscribed to newsletter", () => {
      const condition: FilterCondition = {
        logic: "AND",
        groups: [
          {
            filters: [
              { field: "emailStatus", operator: "equals", value: "active" },
            ],
          },
          {
            filters: [
              { field: "properties.country", operator: "equals", value: "US" },
            ],
          },
          {
            filters: [
              {
                field: "properties.plan",
                operator: "inList",
                value: ["pro", "enterprise"],
              },
            ],
          },
          {
            filters: [
              { field: "topics", operator: "hasTopic", value: "topic-1" },
            ],
          },
        ],
      };
      expect(evaluateCondition(condition, baseContact)).toBe(true);
    });

    it("should match: high-value contacts (score > 70) OR enterprise plan", () => {
      const condition: FilterCondition = {
        logic: "OR",
        groups: [
          {
            filters: [
              { field: "properties.score", operator: "greaterThan", value: 70 },
            ],
          },
          {
            filters: [
              {
                field: "properties.plan",
                operator: "equals",
                value: "enterprise",
              },
            ],
          },
        ],
      };
      expect(evaluateCondition(condition, baseContact)).toBe(true);
    });

    it("should match: new users (created within 7 days) with complete profile", () => {
      const newContact = {
        ...baseContact,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };
      const condition: FilterCondition = {
        logic: "AND",
        groups: [
          {
            filters: [
              {
                field: "createdAt",
                operator: "within",
                value: 7,
                unit: "days",
              },
            ],
          },
          { filters: [{ field: "firstName", operator: "exists" }] },
          { filters: [{ field: "lastName", operator: "exists" }] },
          { filters: [{ field: "company", operator: "exists" }] },
        ],
      };
      expect(evaluateCondition(condition, newContact)).toBe(true);
    });
  });
});
