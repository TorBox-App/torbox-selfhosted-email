/**
 * Push Conflict Detection Tests
 *
 * Tests the upsertTemplateFromCli function:
 * 1. Returns conflict when lastEditedFrom=dashboard and force=false
 * 2. Succeeds when lastEditedFrom=dashboard and force=true
 * 3. Succeeds when lastEditedFrom=cli (no conflict)
 * 4. Succeeds for new templates (insert)
 * 5. Sets lastEditedFrom=cli on insert and update
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../middleware/auth";

// Mock DB state
let mockExistingTemplate: Record<string, unknown> | null = null;
let lastInsertValues: Record<string, unknown> | null = null;
let lastUpdateSet: Record<string, unknown> | null = null;

// Mock @wraps/db before imports
vi.mock("@wraps/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() =>
            mockExistingTemplate ? [mockExistingTemplate] : []
          ),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        lastUpdateSet = values;
        return {
          where: vi.fn(() => Promise.resolve()),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        lastInsertValues = values;
        return Promise.resolve();
      }),
    })),
  },
  template: {
    id: "id",
    slug: "slug",
    organizationId: "organizationId",
    lastEditedFrom: "lastEditedFrom",
    updatedAt: "updatedAt",
  },
  eq: vi.fn(),
  and: vi.fn(),
}));

const authContext: AuthContext = {
  apiKeyId: "key-1",
  organizationId: "org-1",
  userId: "user-1",
  planId: "starter",
};

const basePushBody = {
  slug: "welcome",
  source: '// React Email source\nimport { Html } from "@react-email/components";',
  compiledHtml: "<html><body>Hello</body></html>",
  compiledText: "Hello",
  subject: "Welcome!",
  emailType: "transactional" as const,
  variables: [],
  sourceHash: "abc123def456",
  sesTemplateName: "welcome",
};

beforeEach(() => {
  mockExistingTemplate = null;
  lastInsertValues = null;
  lastUpdateSet = null;
  vi.clearAllMocks();
});

describe("upsertTemplateFromCli - Push Conflict Detection", () => {
  it("should return conflict when lastEditedFrom=dashboard and force=false", async () => {
    mockExistingTemplate = {
      id: "tmpl-1",
      lastEditedFrom: "dashboard",
      updatedAt: new Date("2024-06-15T12:00:00Z"),
    };

    const { upsertTemplateFromCli } = await import(
      "../routes/templates-sync"
    );

    const result = await upsertTemplateFromCli(authContext, {
      ...basePushBody,
      force: false,
    });

    expect(result.conflict).toBe(true);
    expect(result.id).toBe("tmpl-1");
    expect(result.created).toBe(false);
    expect(result.updatedAt).toBe("2024-06-15T12:00:00.000Z");
    // Should NOT have updated the DB
    expect(lastUpdateSet).toBeNull();
  });

  it("should return conflict when lastEditedFrom=dashboard and force not provided", async () => {
    mockExistingTemplate = {
      id: "tmpl-1",
      lastEditedFrom: "dashboard",
      updatedAt: new Date("2024-06-15T12:00:00Z"),
    };

    const { upsertTemplateFromCli } = await import(
      "../routes/templates-sync"
    );

    const result = await upsertTemplateFromCli(authContext, basePushBody);

    expect(result.conflict).toBe(true);
    expect(lastUpdateSet).toBeNull();
  });

  it("should succeed with force=true even when lastEditedFrom=dashboard", async () => {
    mockExistingTemplate = {
      id: "tmpl-1",
      lastEditedFrom: "dashboard",
      updatedAt: new Date("2024-06-15T12:00:00Z"),
    };

    const { upsertTemplateFromCli } = await import(
      "../routes/templates-sync"
    );

    const result = await upsertTemplateFromCli(authContext, {
      ...basePushBody,
      force: true,
    });

    expect(result.conflict).toBeUndefined();
    expect(result.id).toBe("tmpl-1");
    expect(result.created).toBe(false);
    // Should have updated the DB
    expect(lastUpdateSet).not.toBeNull();
    expect(lastUpdateSet?.lastEditedFrom).toBe("cli");
  });

  it("should succeed when lastEditedFrom=cli", async () => {
    mockExistingTemplate = {
      id: "tmpl-1",
      lastEditedFrom: "cli",
      updatedAt: new Date("2024-06-15T12:00:00Z"),
    };

    const { upsertTemplateFromCli } = await import(
      "../routes/templates-sync"
    );

    const result = await upsertTemplateFromCli(authContext, basePushBody);

    expect(result.conflict).toBeUndefined();
    expect(result.created).toBe(false);
    expect(lastUpdateSet).not.toBeNull();
    expect(lastUpdateSet?.lastEditedFrom).toBe("cli");
    expect(lastUpdateSet?.source).toBe(basePushBody.source);
  });

  it("should succeed when lastEditedFrom is null", async () => {
    mockExistingTemplate = {
      id: "tmpl-1",
      lastEditedFrom: null,
      updatedAt: new Date("2024-06-15T12:00:00Z"),
    };

    const { upsertTemplateFromCli } = await import(
      "../routes/templates-sync"
    );

    const result = await upsertTemplateFromCli(authContext, basePushBody);

    expect(result.conflict).toBeUndefined();
    expect(result.created).toBe(false);
  });

  it("should insert new template when slug does not exist", async () => {
    mockExistingTemplate = null;

    const { upsertTemplateFromCli } = await import(
      "../routes/templates-sync"
    );

    const result = await upsertTemplateFromCli(authContext, basePushBody);

    expect(result.created).toBe(true);
    expect(result.conflict).toBeUndefined();
    expect(result.id).toBeDefined();
    // Should have inserted into DB
    expect(lastInsertValues).not.toBeNull();
    expect(lastInsertValues?.slug).toBe("welcome");
    expect(lastInsertValues?.lastEditedFrom).toBe("cli");
    expect(lastInsertValues?.organizationId).toBe("org-1");
    expect(lastInsertValues?.status).toBe("PUBLISHED");
  });

  it("should set pushedFromCli=true on update", async () => {
    mockExistingTemplate = {
      id: "tmpl-1",
      lastEditedFrom: "cli",
      updatedAt: new Date(),
    };

    const { upsertTemplateFromCli } = await import(
      "../routes/templates-sync"
    );

    await upsertTemplateFromCli(authContext, basePushBody);

    expect(lastUpdateSet?.pushedFromCli).toBe(true);
    expect(lastUpdateSet?.status).toBe("PUBLISHED");
  });
});
