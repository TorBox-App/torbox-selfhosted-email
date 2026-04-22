/**
 * Region resolution for post-deploy commands.
 *
 * These tests pin the contract that drives the bug fix for post-deploy
 * commands silent-defaulting to us-east-1: the resolver NEVER picks a
 * default region, and errors cleanly in non-interactive contexts rather
 * than hanging on a clack.select().
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock at system boundaries only — metadata reads the filesystem, clack is
// interactive I/O, json-output is module state. `aws.js` is deliberately NOT
// mocked per plan's mock-boundary rule; `getAWSRegion()` runs real and reads
// the env vars cleared in beforeEach, producing its "us-east-1" default
// naturally for the zero-connections fallback test.
vi.mock("../metadata.js", () => ({
  findConnectionsForAccount: vi.fn(),
  findConnectionsWithService: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
}));

vi.mock("../json-output.js", () => ({
  isJsonMode: vi.fn().mockReturnValue(false),
}));

import * as clack from "@clack/prompts";
import { WrapsError } from "../errors.js";
import { isJsonMode } from "../json-output.js";
import {
  findConnectionsForAccount,
  findConnectionsWithService,
} from "../metadata.js";
import { resolveRegionForCommand } from "../region-resolver.js";

const ACCOUNT = "123456789012";

function connection(region: string, service = "email") {
  return {
    accountId: ACCOUNT,
    region,
    services: { [service]: { config: {} } },
    timestamp: "2026-04-21T00:00:00Z",
  };
}

describe("resolveRegionForCommand", () => {
  beforeEach(() => {
    vi.mocked(findConnectionsForAccount).mockReset();
    vi.mocked(findConnectionsWithService).mockReset();
    vi.mocked(clack.select).mockReset();
    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(isJsonMode).mockReturnValue(false);
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    delete process.env.CI;
  });

  afterEach(() => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
  });

  it("returns the --region option when provided (wins over env and metadata)", async () => {
    process.env.AWS_REGION = "us-east-1";
    vi.mocked(findConnectionsWithService).mockResolvedValue([
      connection("eu-west-1") as any,
    ]);

    const region = await resolveRegionForCommand({
      accountId: ACCOUNT,
      optionRegion: "us-west-1",
      service: "email",
    });

    expect(region).toBe("us-west-1");
    expect(findConnectionsWithService).not.toHaveBeenCalled();
  });

  it("returns AWS_REGION when option is absent", async () => {
    process.env.AWS_REGION = "ap-south-1";

    const region = await resolveRegionForCommand({
      accountId: ACCOUNT,
      service: "email",
    });

    expect(region).toBe("ap-south-1");
  });

  it("auto-picks the only saved region when option and env are absent", async () => {
    vi.mocked(findConnectionsWithService).mockResolvedValue([
      connection("us-west-1") as any,
    ]);

    const region = await resolveRegionForCommand({
      accountId: ACCOUNT,
      service: "email",
    });

    expect(region).toBe("us-west-1");
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("throws REGION_REQUIRED when multiple regions exist and stdin is not a TTY", async () => {
    process.stdin.isTTY = false;
    vi.mocked(findConnectionsWithService).mockResolvedValue([
      connection("us-west-1") as any,
      connection("eu-west-1") as any,
    ]);

    await expect(
      resolveRegionForCommand({ accountId: ACCOUNT, service: "email" })
    ).rejects.toMatchObject({
      name: "WrapsError",
      code: "REGION_REQUIRED",
    });

    expect(clack.select).not.toHaveBeenCalled();
  });

  it("throws REGION_REQUIRED in JSON mode even with a TTY", async () => {
    vi.mocked(isJsonMode).mockReturnValue(true);
    vi.mocked(findConnectionsWithService).mockResolvedValue([
      connection("us-west-1") as any,
      connection("eu-west-1") as any,
    ]);

    await expect(
      resolveRegionForCommand({ accountId: ACCOUNT, service: "email" })
    ).rejects.toBeInstanceOf(WrapsError);
  });

  it("falls back to getAWSRegion() when no saved connections exist and no env — preserves pre-enforcement behavior", async () => {
    vi.mocked(findConnectionsWithService).mockResolvedValue([]);

    const region = await resolveRegionForCommand({
      accountId: ACCOUNT,
      service: "email",
    });

    // getAWSRegion() mock returns us-east-1, preserving the legacy default
    // for users who've never run `init`. Callers that want strictness pass
    // optionRegion or set AWS_REGION.
    expect(region).toBe("us-east-1");
  });

  it("prompts when interactive and multiple regions are saved", async () => {
    vi.mocked(findConnectionsWithService).mockResolvedValue([
      connection("us-west-1") as any,
      connection("eu-west-1") as any,
    ]);
    vi.mocked(clack.select).mockResolvedValue("eu-west-1" as never);

    const region = await resolveRegionForCommand({
      accountId: ACCOUNT,
      service: "email",
    });

    expect(region).toBe("eu-west-1");
    expect(clack.select).toHaveBeenCalledOnce();
  });

  it("uses findConnectionsForAccount when service is omitted", async () => {
    vi.mocked(findConnectionsForAccount).mockResolvedValue([
      connection("us-east-2") as any,
    ]);

    const region = await resolveRegionForCommand({ accountId: ACCOUNT });

    expect(region).toBe("us-east-2");
    expect(findConnectionsForAccount).toHaveBeenCalledWith(ACCOUNT);
    expect(findConnectionsWithService).not.toHaveBeenCalled();
  });
});
