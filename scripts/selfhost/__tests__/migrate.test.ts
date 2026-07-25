import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * runMigrations is the selfhost deploy/upgrade path's only DB write. deploy.test
 * and upgrade.test both mock `pg` with a Pool that discards its constructor
 * argument, so neither could see whether the NORMALIZED url reaches the pool —
 * reverting the normalizer there left the whole suite green while every
 * PlanetScale customer got `ENOENT open 'system'` back.
 */
const mockPoolCtor = vi.hoisted(() => vi.fn());
const mockPoolEnd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockMigrate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("pg", () => ({
  Pool: class {
    end = mockPoolEnd;
    constructor(config: unknown) {
      mockPoolCtor(config);
    }
  },
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn().mockReturnValue({}),
}));

vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: mockMigrate,
}));

const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  step: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@clack/prompts", () => ({ log: mockLog }));

function connectionString(): string {
  const config = mockPoolCtor.mock.calls[0]?.[0] as {
    connectionString: string;
  };
  return config.connectionString;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMigrate.mockResolvedValue(undefined);
  mockPoolEnd.mockResolvedValue(undefined);
});

describe("runMigrations", () => {
  it("connects with sslrootcert=system stripped and verification pinned", async () => {
    const { runMigrations } = await import("../migrate.js");
    await runMigrations(
      "postgresql://u:pw@xyz.horizon.psdb.cloud:5432/db?sslmode=verify-full&sslrootcert=system"
    );

    expect(connectionString()).not.toContain("sslrootcert");
    expect(connectionString()).toContain("sslmode=verify-full");
  });

  it("rejects a libpq keyword/value DSN before opening a pool", async () => {
    const { runMigrations } = await import("../migrate.js");

    await expect(
      runMigrations("host=x.psdb.cloud dbname=db sslmode=verify-full")
    ).rejects.toThrow(/keyword\/value/);
    expect(mockPoolCtor).not.toHaveBeenCalled();
    expect(mockMigrate).not.toHaveBeenCalled();
  });

  it("rejects a MySQL URL before opening a pool", async () => {
    const { runMigrations } = await import("../migrate.js");

    await expect(runMigrations("mysql://u:p@h:3306/db")).rejects.toThrow(
      /requires PostgreSQL/
    );
    expect(mockPoolCtor).not.toHaveBeenCalled();
  });

  it("surfaces the pg cause and its hint when a migration fails", async () => {
    const pgError = Object.assign(
      new Error('permission denied for database "wraps"'),
      { code: "42501" }
    );
    const drizzleError = new Error(
      'Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"\nparams: '
    );
    drizzleError.cause = pgError;
    mockMigrate.mockRejectedValue(drizzleError);

    const { runMigrations } = await import("../migrate.js");
    const failure = await runMigrations(
      "postgres://u:pw@h:5432/db?sslmode=verify-full"
    ).catch((error: Error) => error);

    expect(failure.message).toContain('permission denied for database "wraps"');
    expect(failure.message).toContain("42501");
    expect(failure.message).toContain("GRANT CREATE ON DATABASE");
  });

  it("closes the pool even when the migration throws", async () => {
    mockMigrate.mockRejectedValue(new Error("boom"));

    const { runMigrations } = await import("../migrate.js");
    await runMigrations("postgres://u:pw@h:5432/db").catch(() => undefined);

    expect(mockPoolEnd).toHaveBeenCalledTimes(1);
  });

  it("logs the stripped-parameter note so the rewrite is not silent", async () => {
    const { runMigrations } = await import("../migrate.js");
    await runMigrations("postgres://u:pw@h:5432/db?sslrootcert=system");

    const logged = mockLog.info.mock.calls.flat().join("\n");
    expect(logged).toMatch(/sslrootcert/);
  });
});
