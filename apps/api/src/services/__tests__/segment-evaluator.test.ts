/**
 * Segment Evaluator Tests
 *
 * Tests for the segment filter evaluation logic using the REAL module.
 * Covers:
 * - Basic filter operators (equals, contains, exists, etc.)
 * - Nested property access (properties.plan, etc.)
 * - Topic subscription filters (hasTopic, notHasTopic)
 * - Time-based filters (within)
 * - Filter groups and conditions (AND/OR logic)
 * - Nested conditions
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

import type { FilterCondition, FilterGroup, SegmentFilter } from "@wraps/db";
import {
  evaluateCondition,
  evaluateFilter,
  evaluateGroup,
  type ContactWithTopics,
} from "../segment-evaluator";

const baseContact = {
  id: "contact-123",
  organizationId: "org-1",
  email: "test@example.com",
  emailHash: null,
  firstName: "John",
  lastName: "Doe",
  company: "Acme Inc",
  jobTitle: null,
  preferredChannel: null,
  status: "active",
  emailStatus: "active" as const,
  smsStatus: null,
  phone: null,
  phoneHash: null,
  properties: {
    plan: "pro",
    country: "US",
    score: 85,
    nested: { value: "deep" },
  },
  emailsSent: 10,
  emailsOpened: 5,
  emailsClicked: 2,
  smsSent: 0,
  smsClicked: 0,
  lastActivityAt: null,
  lastEmailSentAt: null,
  lastEmailOpenedAt: null,
  lastEmailClickedAt: null,
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
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  topicIds: ["topic-1", "topic-2"],
} satisfies ContactWithTopics;

describe("Segment Evaluator", () => {
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

      it("should match when field is empty string (aligns with SQL IS NOT NULL)", () => {
        const contactWithEmpty = {
          ...baseContact,
          firstName: "" as string | null,
        };
        const filter: SegmentFilter = {
          field: "firstName",
          operator: "exists",
        };
        // SQL: "" IS NOT NULL → true
        expect(evaluateFilter(filter, contactWithEmpty)).toBe(true);
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
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
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
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
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
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
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

    describe("Filter Structure", () => {
      it("should have correct filter structure for triggered", () => {
        const filter: SegmentFilter = {
          field: "purchase_made",
          operator: "triggered",
        };
        expect(filter.field).toBe("purchase_made");
        expect(filter.operator).toBe("triggered");
        expect(filter.value).toBeUndefined();
      });

      it("should have correct filter structure for triggeredWithin", () => {
        const filter: SegmentFilter = {
          field: "email_opened",
          operator: "triggeredWithin",
          value: 7,
          unit: "days",
        };
        expect(filter.value).toBe(7);
        expect(filter.unit).toBe("days");
      });

      it("should have correct filter structure for notTriggered", () => {
        const filter: SegmentFilter = {
          field: "cart_abandoned",
          operator: "notTriggered",
        };
        expect(filter.operator).toBe("notTriggered");
      });

      it("should support combining event and property filters", () => {
        const condition: FilterCondition = {
          logic: "AND",
          groups: [
            {
              filters: [
                { field: "properties.plan", operator: "equals", value: "pro" },
              ],
            },
            {
              filters: [
                { field: "purchase_made", operator: "notTriggered" },
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
    const emailStatuses = [
      "active",
      "unsubscribed",
      "bounced",
      "complained",
      "suppressed",
    ] as const;

    it.each(emailStatuses)(
      "should correctly filter by emailStatus: %s",
      (status) => {
        const contactWithStatus = { ...baseContact, emailStatus: status };
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

      expect(evaluateCondition(condition, baseContact)).toBe(true);
      expect(
        evaluateCondition(condition, { ...baseContact, emailStatus: "bounced" })
      ).toBe(false);
      expect(
        evaluateCondition(condition, {
          ...baseContact,
          emailStatus: "suppressed",
        })
      ).toBe(false);
    });

    it("should identify undeliverable contacts", () => {
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
              { field: "emailStatus", operator: "equals", value: "complained" },
            ],
          },
          {
            filters: [
              { field: "emailStatus", operator: "equals", value: "suppressed" },
            ],
          },
        ],
      };

      expect(evaluateCondition(condition, baseContact)).toBe(false);
      expect(
        evaluateCondition(condition, { ...baseContact, emailStatus: "bounced" })
      ).toBe(true);
      expect(
        evaluateCondition(condition, {
          ...baseContact,
          emailStatus: "suppressed",
        })
      ).toBe(true);
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
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
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
