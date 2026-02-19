/**
 * Segment Filter SQL Builder Tests
 *
 * Tests for pure SQL builder functions that translate segment conditions
 * into Drizzle SQL fragments. Used by both the web app and batch sender.
 */

import type { FilterCondition, SegmentFilter } from "@wraps/db";
import { buildConditionSQL, buildFilterSQL } from "@wraps/db";
import { describe, expect, it } from "vitest";

// Helper to serialize drizzle SQL to string for assertions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pgConfig: any = {
  escapeName: (name: string) => `"${name}"`,
  escapeParam: (num: number, _value: unknown) => `$${num}`,
  escapeString: (str: string) => `'${str.replace(/'/g, "''")}'`,
};

function toSQL(sqlObj: ReturnType<typeof buildConditionSQL>) {
  if (!sqlObj) return null;
  return sqlObj.toQuery(pgConfig);
}

describe("buildConditionSQL", () => {
  it("combines filters across groups with AND logic", () => {
    const condition: FilterCondition = {
      logic: "AND",
      groups: [
        {
          filters: [{ field: "emailsSent", operator: "greaterThan", value: 5 }],
        },
        {
          filters: [{ field: "status", operator: "equals", value: "active" }],
        },
      ],
    };

    const result = buildConditionSQL(condition);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query).not.toBeNull();
    // Should contain both conditions joined by AND
    expect(query!.sql).toContain('"emails_sent"');
    expect(query!.sql).toContain('"status"');
  });

  it("combines filters across groups with OR logic", () => {
    const condition: FilterCondition = {
      logic: "OR",
      groups: [
        {
          filters: [{ field: "emailsSent", operator: "greaterThan", value: 5 }],
        },
        {
          filters: [{ field: "status", operator: "equals", value: "active" }],
        },
      ],
    };

    const result = buildConditionSQL(condition);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query).not.toBeNull();
    // Should contain both conditions
    expect(query!.sql).toContain('"emails_sent"');
    expect(query!.sql).toContain('"status"');
    // OR logic should produce OR between groups (not just AND)
    expect(query!.sql).toContain(" or ");
  });

  it("returns null for empty condition", () => {
    const condition: FilterCondition = {
      logic: "AND",
      groups: [],
    };

    const result = buildConditionSQL(condition);
    expect(result).toBeNull();
  });

  it("returns null for groups with no valid filters", () => {
    const condition: FilterCondition = {
      logic: "AND",
      groups: [
        {
          filters: [
            { field: "unknownField", operator: "equals", value: "test" },
          ],
        },
      ],
    };

    const result = buildConditionSQL(condition);
    expect(result).toBeNull();
  });
});

describe("buildFilterSQL", () => {
  it("handles standard column equals operator", () => {
    const filter: SegmentFilter = {
      field: "status",
      operator: "equals",
      value: "active",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain('"status"');
    expect(query!.params).toContain("active");
  });

  it("handles contains operator with ILIKE", () => {
    const filter: SegmentFilter = {
      field: "email",
      operator: "contains",
      value: "gmail",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain('"email"');
    expect(query!.sql).toContain("ILIKE");
    expect(query!.params).toContain("%gmail%");
  });

  it("handles greaterThan operator", () => {
    const filter: SegmentFilter = {
      field: "emailsSent",
      operator: "greaterThan",
      value: 10,
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain('"emails_sent"');
    expect(query!.sql).toContain(">");
  });

  it("handles custom properties with dot notation", () => {
    const filter: SegmentFilter = {
      field: "properties.plan",
      operator: "equals",
      value: "pro",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("properties");
    expect(query!.params).toContain("pro");
  });

  it("handles topic hasTopic filter", () => {
    const filter: SegmentFilter = {
      field: "topics",
      operator: "hasTopic",
      value: "topic-123",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("EXISTS");
    expect(query!.sql).toContain("contact_topic");
    expect(query!.params).toContain("topic-123");
  });

  it("handles topic notHasTopic filter", () => {
    const filter: SegmentFilter = {
      field: "topics",
      operator: "notHasTopic",
      value: "topic-456",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("NOT EXISTS");
    expect(query!.sql).toContain("contact_topic");
    expect(query!.params).toContain("topic-456");
  });

  it("handles within time-based operator with days", () => {
    const filter: SegmentFilter = {
      field: "lastActivityAt",
      operator: "within",
      value: 30,
      unit: "days",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain('"last_activity_at"');
    expect(query!.sql).toContain("NOW()");
    expect(query!.sql).toContain("INTERVAL");
  });

  it("handles within time-based operator with hours", () => {
    const filter: SegmentFilter = {
      field: "lastEmailSentAt",
      operator: "within",
      value: 24,
      unit: "hours",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("INTERVAL");
    expect(query!.params).toContain("24 hours");
  });

  it("handles inList operator", () => {
    const filter: SegmentFilter = {
      field: "status",
      operator: "inList",
      value: ["active", "bounced"],
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("ANY");
  });

  it("handles notInList operator", () => {
    const filter: SegmentFilter = {
      field: "status",
      operator: "notInList",
      value: ["bounced", "complained"],
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("ALL");
  });

  it("handles empty inList as FALSE", () => {
    const filter: SegmentFilter = {
      field: "status",
      operator: "inList",
      value: [],
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("FALSE");
  });

  it("handles exists/notExists operators", () => {
    const existsFilter: SegmentFilter = {
      field: "lastActivityAt",
      operator: "exists",
    };
    const notExistsFilter: SegmentFilter = {
      field: "lastActivityAt",
      operator: "notExists",
    };

    const existsResult = buildFilterSQL(existsFilter);
    const notExistsResult = buildFilterSQL(notExistsFilter);

    expect(existsResult).not.toBeNull();
    expect(notExistsResult).not.toBeNull();

    expect(toSQL(existsResult)!.sql).toContain("IS NOT NULL");
    expect(toSQL(notExistsResult)!.sql).toContain("IS NULL");
  });

  it("handles properties exists/notExists", () => {
    const filter: SegmentFilter = {
      field: "properties.plan",
      operator: "exists",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("properties");
    expect(query!.sql).toContain("?");
  });

  it("returns null for unknown field", () => {
    const filter: SegmentFilter = {
      field: "nonexistentField",
      operator: "equals",
      value: "test",
    };

    const result = buildFilterSQL(filter);
    expect(result).toBeNull();
  });
});

describe("buildFilterSQL - event operators", () => {
  it("handles triggered operator with EXISTS subquery on contact_event", () => {
    const filter: SegmentFilter = {
      field: "purchase_made",
      operator: "triggered",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("EXISTS");
    expect(query!.sql).toContain("contact_event");
    expect(query!.sql).toContain("event_name");
    expect(query!.params).toContain("purchase_made");
  });

  it("handles triggeredWithin operator with time-bounded EXISTS", () => {
    const filter: SegmentFilter = {
      field: "email_opened",
      operator: "triggeredWithin",
      value: 7,
      unit: "days",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("EXISTS");
    expect(query!.sql).toContain("contact_event");
    expect(query!.sql).toContain("event_name");
    expect(query!.sql).toContain("created_at");
    expect(query!.sql).toContain("INTERVAL");
    expect(query!.params).toContain("email_opened");
    expect(query!.params).toContain("7 days");
  });

  it("handles triggeredWithin with hours unit", () => {
    const filter: SegmentFilter = {
      field: "page_viewed",
      operator: "triggeredWithin",
      value: 24,
      unit: "hours",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.params).toContain("24 hours");
  });

  it("handles triggeredWithin with minutes unit", () => {
    const filter: SegmentFilter = {
      field: "button_clicked",
      operator: "triggeredWithin",
      value: 30,
      unit: "minutes",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.params).toContain("30 minutes");
  });

  it("handles triggeredWithin defaults to days when unit is missing", () => {
    const filter: SegmentFilter = {
      field: "form_submitted",
      operator: "triggeredWithin",
      value: 14,
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.params).toContain("14 days");
  });

  it("handles notTriggered operator with NOT EXISTS subquery", () => {
    const filter: SegmentFilter = {
      field: "cart_abandoned",
      operator: "notTriggered",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("NOT EXISTS");
    expect(query!.sql).toContain("contact_event");
    expect(query!.sql).toContain("event_name");
    expect(query!.params).toContain("cart_abandoned");
  });
});

describe("buildFilterSQL - property startsWith/endsWith", () => {
  it("handles startsWith on property fields", () => {
    const filter: SegmentFilter = {
      field: "properties.company",
      operator: "startsWith",
      value: "Acme",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("properties");
    expect(query!.sql).toContain("ILIKE");
    expect(query!.params).toContain("Acme%");
  });

  it("handles endsWith on property fields", () => {
    const filter: SegmentFilter = {
      field: "properties.email",
      operator: "endsWith",
      value: "@gmail.com",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("properties");
    expect(query!.sql).toContain("ILIKE");
    expect(query!.params).toContain("%@gmail.com");
  });
});

describe("buildFilterSQL - property numeric comparisons", () => {
  it("handles greaterThan on property fields with numeric cast", () => {
    const filter: SegmentFilter = {
      field: "properties.score",
      operator: "greaterThan",
      value: 80,
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("properties");
    expect(query!.sql).toContain("::numeric");
    expect(query!.sql).toContain(">");
  });

  it("handles lessThan on property fields with numeric cast", () => {
    const filter: SegmentFilter = {
      field: "properties.score",
      operator: "lessThan",
      value: 50,
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("::numeric");
    expect(query!.sql).toContain("<");
  });

  it("handles greaterThanOrEqual on property fields", () => {
    const filter: SegmentFilter = {
      field: "properties.age",
      operator: "greaterThanOrEqual",
      value: 18,
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("::numeric");
    expect(query!.sql).toContain(">=");
  });

  it("handles lessThanOrEqual on property fields", () => {
    const filter: SegmentFilter = {
      field: "properties.age",
      operator: "lessThanOrEqual",
      value: 65,
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("::numeric");
    expect(query!.sql).toContain("<=");
  });
});

describe("buildFilterSQL - property inList/notInList", () => {
  it("handles inList on property fields", () => {
    const filter: SegmentFilter = {
      field: "properties.plan",
      operator: "inList",
      value: ["free", "pro", "enterprise"],
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("properties");
    expect(query!.sql).toContain("ANY");
  });

  it("handles notInList on property fields", () => {
    const filter: SegmentFilter = {
      field: "properties.plan",
      operator: "notInList",
      value: ["churned", "banned"],
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("properties");
    expect(query!.sql).toContain("ALL");
  });

  it("handles empty inList on property fields as FALSE", () => {
    const filter: SegmentFilter = {
      field: "properties.plan",
      operator: "inList",
      value: [],
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("FALSE");
  });

  it("handles empty notInList on property fields as TRUE", () => {
    const filter: SegmentFilter = {
      field: "properties.plan",
      operator: "notInList",
      value: [],
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("TRUE");
  });
});

describe("buildConditionSQL - nested groups", () => {
  it("handles nested conditions recursively", () => {
    const condition: FilterCondition = {
      logic: "AND",
      groups: [
        {
          filters: [{ field: "status", operator: "equals", value: "active" }],
          nested: {
            logic: "OR",
            groups: [
              {
                filters: [
                  { field: "emailsSent", operator: "greaterThan", value: 5 },
                ],
              },
              {
                filters: [
                  { field: "emailsOpened", operator: "greaterThan", value: 0 },
                ],
              },
            ],
          },
        },
      ],
    };

    const result = buildConditionSQL(condition);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain('"status"');
    expect(query!.sql).toContain('"emails_sent"');
    expect(query!.sql).toContain('"emails_opened"');
    // The nested OR should be present
    expect(query!.sql).toContain(" or ");
  });
});
