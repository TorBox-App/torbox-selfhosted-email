/**
 * workflow init Tests
 *
 * Tests the scaffold command that creates example workflows and config.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock filesystem
const mockExistsSync = vi.fn(() => false);
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}));

// Mock clack prompts
const mockConfirm = vi.fn(() => true);
const mockIntro = vi.fn();
const mockOutro = vi.fn();
const mockLogInfo = vi.fn();
const mockLogSuccess = vi.fn();
const mockLogError = vi.fn();
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();
const mockIsCancel = vi.fn(() => false);

vi.mock("@clack/prompts", () => ({
  intro: (...args: unknown[]) => mockIntro(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  isCancel: (...args: unknown[]) => mockIsCancel(...args),
  log: {
    info: (...args: unknown[]) => mockLogInfo(...args),
    success: (...args: unknown[]) => mockLogSuccess(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  },
  spinner: () => ({
    start: mockSpinnerStart,
    stop: mockSpinnerStop,
  }),
}));

vi.mock("picocolors", () => ({
  default: {
    bgCyan: (s: string) => s,
    black: (s: string) => s,
    cyan: (s: string) => s,
    bold: (s: string) => s,
    green: (s: string) => s,
    dim: (s: string) => s,
    underline: (s: string) => s,
    red: (s: string) => s,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockMkdirSync.mockImplementation(() => {});
  mockWriteFileSync.mockImplementation(() => {});
  mockConfirm.mockResolvedValue(true);
  mockIsCancel.mockReturnValue(false);
});

describe("workflowInit", () => {
  it("creates workflows directory and example files", async () => {
    const { workflowInit } = await import("../init");

    await workflowInit();

    // Created directory
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining("wraps/workflows"),
      { recursive: true }
    );

    // Wrote 3 files: cart-recovery, welcome-sequence, config
    expect(mockWriteFileSync).toHaveBeenCalledTimes(3);

    const writeCalls = mockWriteFileSync.mock.calls;
    const paths = writeCalls.map((c: unknown[]) => c[0] as string);

    expect(paths.some((p: string) => p.includes("cart-recovery.ts"))).toBe(
      true
    );
    expect(paths.some((p: string) => p.includes("welcome-sequence.ts"))).toBe(
      true
    );
    expect(paths.some((p: string) => p.includes("wraps.config.ts"))).toBe(true);
  });

  it("writes cascade example with correct imports", async () => {
    const { workflowInit } = await import("../init");

    await workflowInit();

    const cascadeCall = mockWriteFileSync.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes("cart-recovery.ts")
    );
    expect(cascadeCall).toBeDefined();

    const content = cascadeCall![1] as string;
    expect(content).toContain("cascade");
    expect(content).toContain("defineWorkflow");
    expect(content).toContain("cart.abandoned");
  });

  it("writes welcome example with correct structure", async () => {
    const { workflowInit } = await import("../init");

    await workflowInit();

    const welcomeCall = mockWriteFileSync.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes("welcome-sequence.ts")
    );
    expect(welcomeCall).toBeDefined();

    const content = welcomeCall![1] as string;
    expect(content).toContain("contact_created");
    expect(content).toContain("sendEmail");
    expect(content).toContain("condition");
  });

  it("skips config creation if already exists", async () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      if (typeof path === "string" && path.includes("wraps.config.ts"))
        return true;
      return false;
    });

    const { workflowInit } = await import("../init");

    await workflowInit();

    // Should only write 2 files (the workflows, not config)
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
    const paths = mockWriteFileSync.mock.calls.map(
      (c: unknown[]) => c[0] as string
    );
    expect(paths.some((p: string) => p.includes("wraps.config.ts"))).toBe(
      false
    );
  });

  it("prompts for overwrite when files exist and respects 'no'", async () => {
    mockExistsSync.mockReturnValue(true); // Both dir and files exist
    mockConfirm.mockResolvedValue(false);

    const { workflowInit } = await import("../init");

    await workflowInit();

    expect(mockConfirm).toHaveBeenCalled();
    // Should NOT write any files
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it("skips prompt with --yes flag", async () => {
    mockExistsSync.mockReturnValue(true);

    const { workflowInit } = await import("../init");

    await workflowInit({ yes: true });

    // Should not prompt
    expect(mockConfirm).not.toHaveBeenCalled();
    // Should write files
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("handles cancellation gracefully", async () => {
    mockExistsSync.mockReturnValue(true);
    mockIsCancel.mockReturnValue(true);

    const { workflowInit } = await import("../init");

    await workflowInit();

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("handles filesystem errors gracefully", async () => {
    mockMkdirSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const { workflowInit } = await import("../init");

    await workflowInit();

    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining("permission denied")
    );
  });

  it("shows next steps after scaffolding", async () => {
    const { workflowInit } = await import("../init");

    await workflowInit();

    // Should show next steps mentioning config edit and push command
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.stringContaining("wraps.config.ts")
    );
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.stringContaining("wraps email workflows push")
    );
  });
});
