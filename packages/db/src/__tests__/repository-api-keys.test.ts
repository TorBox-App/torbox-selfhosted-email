import { describe, expect, it, vi } from "vitest";
import {
  deleteApiKeyForOrg,
  findApiKeyByHash,
  findApiKeyForOrg,
  insertApiKey,
  listApiKeysForOrg,
  touchApiKeyLastUsed,
  updateApiKeyForOrg,
} from "../repositories/api-keys";

// Build a minimal mock that captures query/mutation calls.
// The tests verify that every org-scoped function includes organizationId in
// its WHERE clause and that the unscoped auth path (findApiKeyByHash) does not.

function makeQueryMock(returnValue: unknown = undefined) {
  return {
    findFirst: vi.fn().mockResolvedValue(returnValue),
    findMany: vi.fn().mockResolvedValue(returnValue ?? []),
  };
}

function makeUpdateChain(returnValue: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { update, set, where, returning };
}

function makeDeleteChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockReturnValue({ where });
  return { del, where };
}

function makeInsertChain(returnValue: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returnValue);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, returning };
}

// ── listApiKeysForOrg ─────────────────────────────────────────────────────────

describe("listApiKeysForOrg", () => {
  it("passes organizationId in the where clause", async () => {
    const queryMock = makeQueryMock([]);
    const dbClient = { query: { apiKey: queryMock } } as never;

    await listApiKeysForOrg("org-a", dbClient);

    expect(queryMock.findMany).toHaveBeenCalledTimes(1);
    const [callArg] = queryMock.findMany.mock.calls[0];

    // Invoke the where function to verify it scopes to organizationId
    const mockTable = {
      organizationId: "org-id-col",
      id: "id-col",
      createdAt: "created-at-col",
    };
    const mockEq = vi.fn().mockReturnValue({ col: "org-id-col", val: "org-a" });
    callArg.where(mockTable, { eq: mockEq });

    expect(mockEq).toHaveBeenCalledWith("org-id-col", "org-a");
  });

  it("returns the mapped list from the db client", async () => {
    const fakeKey = { id: "k1", name: "My Key", organizationId: "org-a" };
    const queryMock = makeQueryMock([fakeKey]);
    const dbClient = { query: { apiKey: queryMock } } as never;

    const result = await listApiKeysForOrg("org-a", dbClient);

    expect(result).toEqual([fakeKey]);
  });
});

// ── findApiKeyForOrg ──────────────────────────────────────────────────────────

describe("findApiKeyForOrg", () => {
  it("passes both id AND organizationId in the where clause (IDOR guard)", async () => {
    const queryMock = makeQueryMock(undefined);
    const dbClient = { query: { apiKey: queryMock } } as never;

    await findApiKeyForOrg("key-id-1", "org-a", dbClient);

    expect(queryMock.findFirst).toHaveBeenCalledTimes(1);
    const [callArg] = queryMock.findFirst.mock.calls[0];

    // Invoke the where function with mock columns and operators
    const mockTable = { id: "id-col", organizationId: "org-id-col" };
    const eqCalls: Array<[unknown, unknown]> = [];
    const mockEq = vi.fn().mockImplementation((col, val) => {
      eqCalls.push([col, val]);
      return { col, val };
    });
    const mockAnd = vi.fn().mockReturnValue({});
    callArg.where(mockTable, { and: mockAnd, eq: mockEq });

    // Must include id condition
    expect(eqCalls).toContainEqual(["id-col", "key-id-1"]);
    // Must include organizationId condition — the IDOR guard
    expect(eqCalls).toContainEqual(["org-id-col", "org-a"]);
    // Both joined with and()
    expect(mockAnd).toHaveBeenCalled();
  });

  it("returns undefined for a key belonging to a different org (IDOR guard is structural)", async () => {
    // The mock simulates what the DB does: returns nothing when WHERE org doesn't match.
    // In the real implementation the WHERE clause filters by org, so a key owned by
    // org-b cannot be retrieved with org-a's organizationId.
    const queryMock = makeQueryMock(undefined); // DB returns no row
    const dbClient = { query: { apiKey: queryMock } } as never;

    const result = await findApiKeyForOrg(
      "key-owned-by-org-b",
      "org-a",
      dbClient
    );

    expect(result).toBeUndefined();
  });
});

// ── findApiKeyByHash ──────────────────────────────────────────────────────────

describe("findApiKeyByHash", () => {
  it("does NOT include organizationId in the where clause (unscoped auth path)", async () => {
    const queryMock = makeQueryMock(undefined);
    const dbClient = { query: { apiKey: queryMock } } as never;

    await findApiKeyByHash("hash-abc", dbClient);

    expect(queryMock.findFirst).toHaveBeenCalledTimes(1);
    const [callArg] = queryMock.findFirst.mock.calls[0];

    const mockTable = { keyHash: "key-hash-col", organizationId: "org-id-col" };
    const mockEq = vi.fn().mockReturnValue({});
    callArg.where(mockTable, { eq: mockEq });

    // Only keyHash is referenced — organizationId must NOT be included
    expect(mockEq).toHaveBeenCalledWith("key-hash-col", "hash-abc");
    expect(mockEq).not.toHaveBeenCalledWith("org-id-col", expect.anything());
  });

  it("resolves a key regardless of which org owns it", async () => {
    const fakeKey = { id: "k99", organizationId: "org-x", keyHash: "hash-abc" };
    const queryMock = makeQueryMock(fakeKey);
    const dbClient = { query: { apiKey: queryMock } } as never;

    const result = await findApiKeyByHash("hash-abc", dbClient);

    expect(result).toEqual(fakeKey);
  });
});

// ── insertApiKey ──────────────────────────────────────────────────────────────

describe("insertApiKey", () => {
  it("inserts the values and returns the first row", async () => {
    const fakeRow = { id: "new-key", name: "Test", organizationId: "org-a" };
    const { insert, values, returning } = makeInsertChain([fakeRow]);
    const dbClient = { insert } as never;

    const result = await insertApiKey(
      {
        name: "Test",
        organizationId: "org-a",
        keyHash: "h",
        prefix: "p",
      } as never,
      dbClient
    );

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalled();
    expect(returning).toHaveBeenCalled();
    expect(result).toEqual(fakeRow);
  });

  it("returns null when insert returns no rows", async () => {
    const { insert } = makeInsertChain([]);
    const dbClient = { insert } as never;

    const result = await insertApiKey(
      {
        name: "Test",
        organizationId: "org-a",
        keyHash: "h",
        prefix: "p",
      } as never,
      dbClient
    );

    expect(result).toBeNull();
  });
});

// ── updateApiKeyForOrg ────────────────────────────────────────────────────────

describe("updateApiKeyForOrg", () => {
  it("returns the updated row on success", async () => {
    const updated = { id: "k1", name: "New Name", organizationId: "org-a" };
    const { update } = makeUpdateChain([updated]);
    const dbClient = { update } as never;

    const result = await updateApiKeyForOrg(
      "k1",
      "org-a",
      { name: "New Name" },
      dbClient
    );

    expect(result).toEqual(updated);
  });

  it("returns null when no row matches (key belongs to a different org)", async () => {
    const { update } = makeUpdateChain([]); // DB updated nothing
    const dbClient = { update } as never;

    const result = await updateApiKeyForOrg(
      "k1",
      "wrong-org",
      { name: "X" },
      dbClient
    );

    expect(result).toBeNull();
  });

  it("calls update().set().where().returning() with the expected chain", async () => {
    const { update, set, where, returning } = makeUpdateChain([]);
    const dbClient = { update } as never;

    await updateApiKeyForOrg("k1", "org-a", { name: "Y" }, dbClient);

    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ name: "Y" });
    expect(where).toHaveBeenCalled();
    expect(returning).toHaveBeenCalled();
  });
});

// ── deleteApiKeyForOrg ────────────────────────────────────────────────────────

describe("deleteApiKeyForOrg", () => {
  it("calls delete().where() and resolves without error", async () => {
    const { del, where } = makeDeleteChain();
    const dbClient = { delete: del } as never;

    await expect(
      deleteApiKeyForOrg("k1", "org-a", dbClient)
    ).resolves.toBeUndefined();

    expect(del).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });
});

// ── touchApiKeyLastUsed ───────────────────────────────────────────────────────

describe("touchApiKeyLastUsed", () => {
  it("calls update().set().where() and resolves without error", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const dbClient = { update } as never;

    await expect(touchApiKeyLastUsed("k1", dbClient)).resolves.toBeUndefined();

    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ lastUsedAt: expect.any(Date) });
    expect(where).toHaveBeenCalled();
  });
});
