/**
 * Workflows Generate Command Tests
 *
 * Tests template mode for the generate command.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../utils/shared/json-output.js";

// Mock external dependencies
vi.mock("@clack/prompts");
vi.mock("node:fs");
vi.mock("node:path");
vi.mock("../../telemetry/events.js");

import * as fs from "node:fs";
import * as path from "node:path";
import * as prompts from "@clack/prompts";
import { trackCommand } from "../../telemetry/events.js";
// Import after mocks
import { workflowsGenerate } from "../email/workflows/generate.js";

describe("workflowsGenerate", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock path.join to just concatenate
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));

    // Mock fs defaults
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    // Mock prompts
    vi.mocked(prompts.intro).mockImplementation(() => {});
    vi.mocked(prompts.log).success = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).info = vi.fn();

    // Mock telemetry
    vi.mocked(trackCommand).mockImplementation(() => {});
  });

  afterEach(() => {
    setJsonMode(false);
    consoleLogSpy.mockRestore();
  });

  // ── Template Mode ──

  describe("template mode", () => {
    it("should create a workflow file from the welcome template", async () => {
      await workflowsGenerate({ template: "welcome" });

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("welcome.ts"),
        expect.stringContaining("defineWorkflow"),
        "utf-8"
      );
      expect(prompts.log.success).toHaveBeenCalledWith(
        expect.stringContaining("welcome.ts")
      );
    });

    it("should create a workflow file from each built-in template", async () => {
      const templates = [
        "welcome",
        "cart-recovery",
        "trial-conversion",
        "re-engagement",
        "onboarding",
      ];

      for (const template of templates) {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
        vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
        vi.mocked(prompts.intro).mockImplementation(() => {});
        vi.mocked(prompts.log).success = vi.fn();

        await workflowsGenerate({ template });

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining(`${template}.ts`),
          expect.stringContaining("defineWorkflow"),
          "utf-8"
        );
      }
    });

    it("should use --name flag as the slug", async () => {
      await workflowsGenerate({ template: "welcome", name: "my-welcome" });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("my-welcome.ts"),
        expect.any(String),
        "utf-8"
      );
    });

    it("should error for unknown template", async () => {
      await workflowsGenerate({ template: "nonexistent" });

      expect(prompts.log.error).toHaveBeenCalledWith(
        expect.stringContaining("nonexistent")
      );
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("should error when file already exists without --force", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await workflowsGenerate({ template: "welcome" });

      expect(prompts.log.error).toHaveBeenCalledWith(
        expect.stringContaining("already exists")
      );
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("should overwrite when file exists with --force", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await workflowsGenerate({ template: "welcome", force: true });

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should track template mode in telemetry", async () => {
      await workflowsGenerate({ template: "welcome" });

      expect(trackCommand).toHaveBeenCalledWith(
        "email:workflows:generate",
        expect.objectContaining({ mode: "template" })
      );
    });
  });

  // ── Template Mode JSON Output ──

  describe("template mode JSON output", () => {
    beforeEach(() => {
      setJsonMode(true);
    });

    it("should output JSON on success", async () => {
      await workflowsGenerate({ template: "welcome", json: true });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.command === "email.workflows.generate";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.success).toBe(true);
      expect(output.data.mode).toBe("template");
      expect(output.data.template).toBe("welcome");
      expect(output.data.slug).toBe("welcome");
      expect(output.data.path).toBe("wraps/workflows/welcome.ts");
    });

    it("should output JSON error for unknown template", async () => {
      await workflowsGenerate({ template: "nonexistent", json: true });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.command === "email.workflows.generate";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe("UNKNOWN_TEMPLATE");
    });

    it("should output JSON error when file exists", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await workflowsGenerate({ template: "welcome", json: true });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return (
            parsed.command === "email.workflows.generate" && !parsed.success
          );
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.error.code).toBe("FILE_EXISTS");
    });
  });

  // ── Usage (no args) ──

  describe("usage", () => {
    it("should show usage when no template provided", async () => {
      await workflowsGenerate({});

      expect(prompts.log.error).toHaveBeenCalledWith(
        expect.stringContaining("--template")
      );
    });

    it("should output JSON error when no args in JSON mode", async () => {
      setJsonMode(true);

      await workflowsGenerate({ json: true });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.command === "email.workflows.generate";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe("MISSING_INPUT");
    });
  });
});
