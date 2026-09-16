/**
 * Unit tests for `resolveOrganization` — the org picker used by
 * `wraps platform connect` / `wraps selfhost connect`.
 *
 * Plan 333: `--org` must resolve non-interactively, and a run that can't
 * prompt (JSON mode, or `--yes`) with more than one org must fail loudly
 * rather than auto-picking one. Auto-picking would risk connecting a
 * production AWS account to the wrong organization.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts");

import * as clack from "@clack/prompts";
import type { OrgInfo } from "../../../utils/shared/config.js";
import { setJsonMode } from "../../../utils/shared/json-output.js";
import { resolveOrganization } from "../connect.js";

class ExitError extends Error {
  constructor(public code?: number) {
    super(`process.exit(${code})`);
  }
}

const ORGS: OrgInfo[] = [
  { id: "org-1", name: "Acme", slug: "acme" },
  { id: "org-2", name: "Beta Co", slug: "beta-co" },
  { id: "org-3", name: "Gamma", slug: "gamma" },
];

describe("resolveOrganization", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setJsonMode(false);

    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitError(code);
    }) as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.select).mockResolvedValue("org-1");
    vi.mocked(clack.log).error = vi.fn();
    vi.mocked(clack.log).warn = vi.fn();
    vi.mocked(clack.log).info = vi.fn();
  });

  afterEach(() => {
    setJsonMode(false);
  });

  function jsonEnvelopes(): any[] {
    return consoleLogSpy.mock.calls
      .map((c) => {
        try {
          return JSON.parse(c[0] as string);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  it("0 orgs → returns null without prompting", async () => {
    const result = await resolveOrganization([], {});
    expect(result).toBeNull();
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("undefined orgs → returns null without prompting", async () => {
    const result = await resolveOrganization(undefined, {});
    expect(result).toBeNull();
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("exactly one org, no --org → resolves without prompting", async () => {
    const result = await resolveOrganization([ORGS[0]], {});
    expect(result).toEqual(ORGS[0]);
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("--org <slug> with multiple orgs → resolves, no prompt", async () => {
    const result = await resolveOrganization(ORGS, { org: "beta-co" });
    expect(result).toEqual(ORGS[1]);
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("--org <slug> matches case-insensitively", async () => {
    const result = await resolveOrganization(ORGS, { org: "BETA-CO" });
    expect(result).toEqual(ORGS[1]);
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("--org <id> → resolves by id", async () => {
    const result = await resolveOrganization(ORGS, { org: "org-3" });
    expect(result).toEqual(ORGS[2]);
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("--org with a slug that does not exist → non-zero exit, lists available slugs, no prompt", async () => {
    await expect(
      resolveOrganization(ORGS, { org: "does-not-exist" })
    ).rejects.toBeInstanceOf(ExitError);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(clack.select).not.toHaveBeenCalled();

    const errText = vi
      .mocked(clack.log.error)
      .mock.calls.flat()
      .map(String)
      .join("\n");
    expect(errText).toContain("does-not-exist");
    const guidance = consoleLogSpy.mock.calls.flat().map(String).join("\n");
    expect(guidance).toContain("acme");
    expect(guidance).toContain("beta-co");
    expect(guidance).toContain("gamma");
  });

  it("--org miss in JSON mode → JSON error envelope, no prompt", async () => {
    setJsonMode(true);

    await expect(
      resolveOrganization(ORGS, { org: "does-not-exist", json: true })
    ).rejects.toBeInstanceOf(ExitError);

    expect(clack.select).not.toHaveBeenCalled();
    const env = jsonEnvelopes().find((e) => e.command === "platform.connect");
    expect(env.success).toBe(false);
    expect(env.error.code).toBe("ORG_NOT_FOUND");
    expect(env.error.suggestion).toContain("acme");
  });

  it("multiple orgs + --json, no --org → non-zero exit, does not auto-pick", async () => {
    setJsonMode(true);

    await expect(
      resolveOrganization(ORGS, { json: true })
    ).rejects.toBeInstanceOf(ExitError);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(clack.select).not.toHaveBeenCalled();

    const env = jsonEnvelopes().find((e) => e.command === "platform.connect");
    expect(env.success).toBe(false);
    expect(env.error.code).toBe("ORG_AMBIGUOUS");
    expect(env.error.message).toContain("--org");
  });

  it("multiple orgs + --yes, no --org → non-zero exit, does not auto-pick", async () => {
    await expect(
      resolveOrganization(ORGS, { yes: true })
    ).rejects.toBeInstanceOf(ExitError);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(clack.select).not.toHaveBeenCalled();

    const errText = vi
      .mocked(clack.log.error)
      .mock.calls.flat()
      .map(String)
      .join("\n");
    expect(errText).toContain("--org");
  });

  it("multiple orgs, fully interactive → prompts and resolves the selection", async () => {
    vi.mocked(clack.select).mockResolvedValue("org-2");

    const result = await resolveOrganization(ORGS, {});

    expect(clack.select).toHaveBeenCalledTimes(1);
    expect(result).toEqual(ORGS[1]);
  });

  it("interactive prompt cancelled → exits 0 without selecting", async () => {
    vi.mocked(clack.isCancel).mockReturnValue(true);

    await expect(resolveOrganization(ORGS, {})).rejects.toBeInstanceOf(
      ExitError
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
