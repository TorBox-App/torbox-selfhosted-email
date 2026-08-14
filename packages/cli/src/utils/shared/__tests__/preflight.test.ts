/**
 * Guard coverage for `runPreflightScan()`'s "Continue anyway?" confirm.
 * Non-interactive/JSON callers used to hang on `clack.confirm()`; they now
 * either throw RESOURCE_CONFLICT or, with `--force`, continue past the
 * conflict without prompting. Behavioral coverage of the scan/warn logic
 * itself lives in `src/commands/__tests__/init-preflight.test.ts` — this
 * file covers only the new force/non-interactive branch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: { warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../json-output.js", () => ({
  isJsonMode: vi.fn().mockReturnValue(false),
}));

vi.mock("../scanner.js", () => ({
  scanAWSResources: vi.fn(),
  filterWrapsResources: vi.fn(),
  checkWrapsResourcesExist: vi.fn(),
}));

import * as clack from "@clack/prompts";
import { isJsonMode } from "../json-output.js";
import { runPreflightScan } from "../preflight.js";
import {
  checkWrapsResourcesExist,
  filterWrapsResources,
  scanAWSResources,
} from "../scanner.js";

const mockScan = vi.mocked(scanAWSResources);
const mockFilter = vi.mocked(filterWrapsResources);
const mockCheck = vi.mocked(checkWrapsResourcesExist);

const CONFLICTING_SCAN = {
  identities: [],
  configurationSets: [
    { name: "wraps-email-config-set", eventDestinations: [] },
  ],
  snsTopics: [],
  dynamoTables: [],
  lambdaFunctions: [],
  iamRoles: [],
};

describe("runPreflightScan — non-interactive conflict handling", () => {
  beforeEach(() => {
    vi.mocked(isJsonMode).mockReturnValue(false);
    vi.mocked(clack.isCancel).mockReturnValue(false);

    mockScan.mockResolvedValue(CONFLICTING_SCAN as never);
    mockFilter.mockReturnValue(CONFLICTING_SCAN as never);
    mockCheck.mockReturnValue({
      hasConfigSet: true,
      hasSNSTopics: false,
      hasDynamoTable: false,
      hasLambdaFunctions: false,
      hasIAMRole: false,
    });

    process.stdin.isTTY = false;
    process.stdout.isTTY = false;
    delete process.env.CI;
  });

  afterEach(() => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
  });

  it("throws RESOURCE_CONFLICT when conflicts exist, non-interactive, and no force", async () => {
    await expect(
      runPreflightScan("us-east-1", "example.com")
    ).rejects.toMatchObject({
      name: "WrapsError",
      code: "RESOURCE_CONFLICT",
    });

    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it("continues without prompting when conflicts exist and force: true", async () => {
    const result = await runPreflightScan("us-east-1", "example.com", {
      force: true,
    });

    expect(result.shouldContinue).toBe(true);
    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it("throws RESOURCE_CONFLICT in JSON mode even with a TTY", async () => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    vi.mocked(isJsonMode).mockReturnValue(true);

    await expect(
      runPreflightScan("us-east-1", "example.com")
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });

    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it("still prompts interactively when a real TTY is attached", async () => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    vi.mocked(clack.confirm).mockResolvedValue(true as never);

    const result = await runPreflightScan("us-east-1", "example.com");

    expect(clack.confirm).toHaveBeenCalledOnce();
    expect(result.shouldContinue).toBe(true);
  });
});
