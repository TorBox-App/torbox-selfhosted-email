/**
 * Batch Sender - Segment Filtering Integration Tests
 *
 * Tests that getContactsChunk properly fetches segment conditions
 * and applies them to the contact query.
 */

import type { FilterCondition } from "@wraps/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Track calls for assertions
let segmentQueryResult: unknown[] = [];
let contactQueryResult: unknown[] = [];
let segmentQueried = false;
let contactQueried = false;

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");

  return {
    ...actual,
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: unknown) => {
          const tableName =
            table &&
            typeof table === "object" &&
            Symbol.for("drizzle:Name") in table
              ? (table as Record<symbol, string>)[Symbol.for("drizzle:Name")]
              : typeof table === "object" && table !== null && "_" in table
                ? (table as { _: { name: string } })._.name
                : "unknown";

          if (tableName === "segment") {
            segmentQueried = true;
            // Segment query: .select().from(segment).where() — returns array directly
            return {
              where: vi
                .fn()
                .mockImplementation(() => Promise.resolve(segmentQueryResult)),
            };
          }

          contactQueried = true;
          // Contact query: .select().from(contact).where().orderBy().limit()
          return {
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockImplementation(() =>
                    Promise.resolve(contactQueryResult)
                  ),
              }),
            }),
          };
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
      }),
    },
  };
});

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "test",
    secretAccessKey: "test",
    sessionToken: "test",
  }),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
const { getContactsChunk } = await import("../workers/batch-sender");

describe("getContactsChunk - segment filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentQueryResult = [];
    contactQueryResult = [];
    segmentQueried = false;
    contactQueried = false;
  });

  it("fetches segment and applies condition when audienceType=segment", async () => {
    const condition: FilterCondition = {
      logic: "AND",
      groups: [
        {
          filters: [{ field: "emailsSent", operator: "greaterThan", value: 5 }],
        },
      ],
    };

    segmentQueryResult = [
      {
        id: "seg-1",
        organizationId: "org-123",
        condition,
      },
    ];

    contactQueryResult = [
      {
        id: "contact-1",
        email: "user@example.com",
        phone: null,
        firstName: "Test",
        lastName: "User",
        company: null,
        jobTitle: null,
        properties: {},
      },
    ];

    const result = await getContactsChunk("org-123", "email", 100, {
      audienceType: "segment",
      segmentId: "seg-1",
    });

    // Should have queried the segment table
    expect(segmentQueried).toBe(true);
    // Should also query contacts
    expect(contactQueried).toBe(true);
    // Should return the filtered contacts
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("user@example.com");
  });

  it("returns empty array when segment not found", async () => {
    segmentQueryResult = [];

    const result = await getContactsChunk("org-123", "email", 100, {
      audienceType: "segment",
      segmentId: "seg-missing",
    });

    // Should have queried the segment table
    expect(segmentQueried).toBe(true);
    // Should NOT query contacts since segment was not found
    expect(contactQueried).toBe(false);
    // Should return empty array
    expect(result).toEqual([]);
  });

  it("does not query segment table when audienceType is not segment", async () => {
    contactQueryResult = [
      {
        id: "contact-1",
        email: "user@example.com",
        phone: null,
        firstName: "Test",
        lastName: "User",
        company: null,
        jobTitle: null,
        properties: {},
      },
    ];

    const result = await getContactsChunk("org-123", "email", 100, {
      audienceType: "all",
    });

    expect(segmentQueried).toBe(false);
    expect(result).toHaveLength(1);
  });
});
