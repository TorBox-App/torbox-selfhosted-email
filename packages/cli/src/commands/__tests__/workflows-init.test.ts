/**
 * Workflows Init Command Tests
 *
 * Tests the `wraps email workflows init` command including
 * directory creation, example scaffolding, and Claude context.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../utils/shared/json-output.js";

// Mock external dependencies
vi.mock("@clack/prompts");
vi.mock("node:fs");
vi.mock("node:fs/promises");
vi.mock("node:path");
vi.mock("../../telemetry/events.js");

// Mock scaffold-claude utilities
const mockScaffoldClaudeMdSection = vi.fn();
const mockScaffoldClaudeSkill = vi.fn();
vi.mock("../../utils/shared/scaffold-claude.js", () => ({
  scaffoldClaudeMdSection: (...args: unknown[]) =>
    mockScaffoldClaudeMdSection(...args),
  scaffoldClaudeSkill: (...args: unknown[]) => mockScaffoldClaudeSkill(...args),
}));

// DeploymentProgress mock
const mockProgress = {
  start: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  info: vi.fn(),
};
vi.mock("../../utils/shared/output.js", () => ({
  // biome-ignore lint/complexity/useArrowFunction: constructor mock needs lazy eval of mockProgress (vi.mock is hoisted)
  DeploymentProgress: vi.fn(function () {
    return mockProgress;
  }),
}));

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import * as prompts from "@clack/prompts";
import { trackCommand } from "../../telemetry/events.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import { workflowsInit } from "../email/workflows/init.js";

describe("workflowsInit", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Re-set DeploymentProgress mock
    // biome-ignore lint/complexity/useArrowFunction: constructor mock requires regular function for `new`
    vi.mocked(DeploymentProgress).mockImplementation(function () {
      return mockProgress as never;
    });

    // Mock path.join
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));

    // Mock fs defaults
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue("");

    // Mock prompts
    vi.mocked(prompts.intro).mockImplementation(() => {});
    vi.mocked(prompts.log).success = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).warn = vi.fn();
    vi.mocked(prompts.log).info = vi.fn();

    // Mock scaffold-claude
    mockScaffoldClaudeMdSection.mockResolvedValue(undefined);
    mockScaffoldClaudeSkill.mockResolvedValue(undefined);

    // Mock telemetry
    vi.mocked(trackCommand).mockImplementation(() => {});
  });

  afterEach(() => {
    setJsonMode(false);
    consoleLogSpy.mockRestore();
  });

  it("creates wraps/workflows/ directory", async () => {
    await workflowsInit({});

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining("wraps/workflows"),
      { recursive: true }
    );
  });

  it("writes example workflow by default", async () => {
    await workflowsInit({});

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("welcome.ts"),
      expect.stringContaining("defineWorkflow"),
      "utf-8"
    );
  });

  it("skips example workflow with --no-example", async () => {
    await workflowsInit({ noExample: true });

    const writeCalls = vi.mocked(writeFile).mock.calls;
    const welcomeWrite = writeCalls.find(
      (c) => typeof c[0] === "string" && c[0].includes("welcome.ts")
    );
    expect(welcomeWrite).toBeUndefined();
  });

  it("scaffolds .claude/ context by default", async () => {
    await workflowsInit({});

    expect(mockScaffoldClaudeMdSection).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "workflows",
      })
    );
    expect(mockScaffoldClaudeSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: "wraps-workflows",
      })
    );
  });

  it("skips .claude/ scaffolding with --no-claude", async () => {
    await workflowsInit({ noClaude: true });

    expect(mockScaffoldClaudeMdSection).not.toHaveBeenCalled();
    expect(mockScaffoldClaudeSkill).not.toHaveBeenCalled();
  });

  it("handles .claude/ scaffolding failure gracefully", async () => {
    mockScaffoldClaudeMdSection.mockRejectedValue(
      new Error("EACCES: permission denied")
    );

    // Should not throw
    await workflowsInit({});

    expect(mockProgress.info).toHaveBeenCalledWith(
      expect.stringContaining("Could not scaffold")
    );
  });

  it("creates minimal wraps.config.ts if missing", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await workflowsInit({});

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("wraps.config.ts"),
      expect.stringContaining("defineConfig"),
      "utf-8"
    );
    // Config should include workflowsDir
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("wraps.config.ts"),
      expect.stringContaining("workflowsDir"),
      "utf-8"
    );
  });

  it("appends workflowsDir to existing config if missing", async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === "string" && p.includes("wraps.config.ts")) return true;
      return false;
    });
    vi.mocked(readFile).mockResolvedValue(
      `import { defineConfig } from '@wraps.dev/email';\n\nexport default defineConfig({\n  org: 'test',\n});\n`
    );

    await workflowsInit({});

    // Should update the config file with workflowsDir
    const configWrite = vi
      .mocked(writeFile)
      .mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("wraps.config.ts")
      );
    if (configWrite) {
      expect(configWrite[1]).toContain("workflowsDir");
    }
  });

  it("does not duplicate workflowsDir in existing config", async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === "string" && p.includes("wraps.config.ts")) return true;
      return false;
    });
    vi.mocked(readFile).mockResolvedValue(
      `export default defineConfig({ org: 'test', workflowsDir: './workflows' });`
    );

    await workflowsInit({});

    // Should NOT write to config (already has workflowsDir)
    const configWrite = vi
      .mocked(writeFile)
      .mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("wraps.config.ts")
      );
    expect(configWrite).toBeUndefined();
  });

  it("tracks telemetry", async () => {
    await workflowsInit({});

    expect(trackCommand).toHaveBeenCalledWith(
      "email:workflows:init",
      expect.objectContaining({ success: true })
    );
  });

  describe("JSON output", () => {
    beforeEach(() => {
      setJsonMode(true);
    });

    it("outputs JSON with file list", async () => {
      await workflowsInit({ json: true });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.command === "email.workflows.init";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.success).toBe(true);
      expect(output.data.dir).toBe("wraps/workflows");
      expect(output.data.files).toEqual(
        expect.arrayContaining([
          "wraps/workflows/welcome.ts",
          ".claude/CLAUDE.md",
          ".claude/skills/wraps-workflows/SKILL.md",
        ])
      );
    });

    it("excludes .claude files from JSON when --no-claude", async () => {
      await workflowsInit({ json: true, noClaude: true });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.command === "email.workflows.init";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.data.files).not.toEqual(
        expect.arrayContaining([".claude/CLAUDE.md"])
      );
    });
  });
});
