/**
 * Guard coverage for `ensureInteractive()` — the fail-fast primitive that
 * every exported `prompt*`/`confirm*` helper in `prompts.ts` now calls
 * before touching Clack. Clack's `select()`/`confirm()`/`text()` hang
 * silently without a TTY; this guard throws a machine-readable
 * `NON_INTERACTIVE_INPUT` error instead.
 *
 * Full prompt-by-prompt behavior (options, hints, cancellation) is covered
 * in `src/utils/__tests__/prompts.test.ts`, which simulates an interactive
 * TTY so those tests exercise the underlying Clack call as before. This
 * file covers only the guard itself and one representative helper, modeled
 * on `region-resolver.test.ts`'s TTY/JSON-mode simulation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { ensureInteractive, promptProvider } from "../prompts.js";

describe("ensureInteractive", () => {
  beforeEach(() => {
    vi.mocked(isJsonMode).mockReturnValue(false);
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    delete process.env.CI;
  });

  afterEach(() => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
  });

  it("throws NON_INTERACTIVE_INPUT when stdin is not a TTY", () => {
    process.stdin.isTTY = false;

    expect(() => ensureInteractive("Thing", "--thing <value>")).toThrowError(
      expect.objectContaining({
        name: "WrapsError",
        code: "NON_INTERACTIVE_INPUT",
      })
    );
  });

  it("throws NON_INTERACTIVE_INPUT when stdout is not a TTY", () => {
    process.stdout.isTTY = false;

    expect(() => ensureInteractive("Thing", "--thing <value>")).toThrowError(
      expect.objectContaining({ code: "NON_INTERACTIVE_INPUT" })
    );
  });

  it("throws NON_INTERACTIVE_INPUT when CI env var is set, even with a TTY", () => {
    process.env.CI = "true";

    expect(() => ensureInteractive("Thing", "--thing <value>")).toThrowError(
      expect.objectContaining({ code: "NON_INTERACTIVE_INPUT" })
    );
  });

  it("throws when isJsonMode() is true even with a TTY", () => {
    vi.mocked(isJsonMode).mockReturnValue(true);

    expect(() => ensureInteractive("Thing", "--thing <value>")).toThrowError(
      expect.objectContaining({ code: "NON_INTERACTIVE_INPUT" })
    );
  });

  it("is a no-op when interactive and not in JSON mode", () => {
    expect(() => ensureInteractive("Thing", "--thing <value>")).not.toThrow();
  });

  it("includes the flag hint in the thrown error's suggestion", () => {
    process.stdin.isTTY = false;

    try {
      ensureInteractive("Thing", "--thing <value>");
      throw new Error("expected ensureInteractive to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WrapsError);
      expect((error as WrapsError).suggestion).toContain("--thing <value>");
    }
  });
});

describe("promptProvider (representative helper)", () => {
  beforeEach(() => {
    vi.mocked(isJsonMode).mockReturnValue(false);
    vi.mocked(clack.isCancel).mockReturnValue(false);
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    delete process.env.CI;
  });

  afterEach(() => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
  });

  it("rejects with a --provider flag hint in non-TTY mode instead of hanging", async () => {
    process.stdin.isTTY = false;

    await expect(promptProvider()).rejects.toMatchObject({
      name: "WrapsError",
      code: "NON_INTERACTIVE_INPUT",
      suggestion: expect.stringContaining("--provider"),
    });

    expect(clack.select).not.toHaveBeenCalled();
  });

  it("rejects instead of hanging when isJsonMode() is true even with a TTY", async () => {
    vi.mocked(isJsonMode).mockReturnValue(true);

    await expect(promptProvider()).rejects.toMatchObject({
      code: "NON_INTERACTIVE_INPUT",
    });

    expect(clack.select).not.toHaveBeenCalled();
  });

  it("proceeds to the real Clack prompt when interactive and not JSON", async () => {
    vi.mocked(clack.select).mockResolvedValue("vercel" as never);

    const result = await promptProvider();

    expect(result).toBe("vercel");
    expect(clack.select).toHaveBeenCalledOnce();
  });
});
