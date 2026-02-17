/**
 * Workflows Generate Command Tests
 *
 * Tests both template mode and LLM mode for the generate command.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../utils/shared/json-output.js";

// Mock external dependencies
vi.mock("@clack/prompts");
vi.mock("node:fs");
vi.mock("node:path");
vi.mock("../../telemetry/events.js");
vi.mock("../../utils/email/workflow-ts.js");
vi.mock("../../utils/email/workflow-transform.js");
vi.mock("../../utils/email/workflow-validator.js");
vi.mock("../../utils/shared/config.js");
// DeploymentProgress mock must be defined before vi.mock
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

import * as fs from "node:fs";
import * as path from "node:path";
import * as prompts from "@clack/prompts";
import { trackCommand } from "../../telemetry/events.js";
import { transformWorkflow } from "../../utils/email/workflow-transform.js";
import { parseWorkflowTs } from "../../utils/email/workflow-ts.js";
import { validateTransformedWorkflow } from "../../utils/email/workflow-validator.js";
import { getApiBaseUrl, resolveTokenAsync } from "../../utils/shared/config.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
// Import after mocks
import { workflowsGenerate } from "../email/workflows/generate.js";

describe("workflowsGenerate", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Re-set DeploymentProgress mock after clearAllMocks
    // biome-ignore lint/complexity/useArrowFunction: constructor mock requires regular function for `new`
    vi.mocked(DeploymentProgress).mockImplementation(function () {
      return mockProgress as never;
    });

    // Mock path.join to just concatenate
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));

    // Mock fs defaults
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    // Mock prompts
    vi.mocked(prompts.intro).mockImplementation(() => {});
    vi.mocked(prompts.cancel).mockImplementation(() => {});
    vi.mocked(prompts.isCancel).mockReturnValue(false);
    vi.mocked(prompts.confirm).mockResolvedValue(true);
    vi.mocked(prompts.log).success = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).info = vi.fn();

    // Mock validation pipeline (default: all valid)
    vi.mocked(parseWorkflowTs).mockResolvedValue({
      definition: {} as never,
      sourceTs: "",
      sourceHash: "",
    });
    vi.mocked(transformWorkflow).mockReturnValue({} as never);
    vi.mocked(validateTransformedWorkflow).mockReturnValue({
      valid: true,
      errors: [],
    } as never);

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
    it("should show usage when no template and no description", async () => {
      await workflowsGenerate({});

      expect(prompts.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Provide a description")
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

  // ── LLM Mode ──

  describe("LLM mode", () => {
    const mockCode = `import { defineWorkflow, sendEmail } from '@wraps.dev/client';
export default defineWorkflow({
  name: 'Test Workflow',
  trigger: { type: 'contact_created' },
  steps: [sendEmail('send-welcome', { template: 'welcome' })],
});`;

    beforeEach(() => {
      vi.mocked(resolveTokenAsync).mockResolvedValue("test-token-123");
      vi.mocked(getApiBaseUrl).mockReturnValue("https://api.wraps.dev");

      // Mock global fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: mockCode, slug: "test-workflow" }),
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should throw notAuthenticated when no token", async () => {
      vi.mocked(resolveTokenAsync).mockResolvedValue(null);

      await expect(
        workflowsGenerate({ description: "welcome series" })
      ).rejects.toThrow("Not authenticated");
    });

    it("should call the generate API with description and slug", async () => {
      await workflowsGenerate({
        description: "Welcome series",
        yes: true,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.wraps.dev/v1/workflows/generate",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
          body: expect.stringContaining("Welcome series"),
        })
      );
    });

    it("should write the generated code to disk", async () => {
      await workflowsGenerate({
        description: "Welcome series",
        yes: true,
      });

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("welcome-series.ts"),
        mockCode,
        "utf-8"
      );
    });

    it("should use --name flag for output slug", async () => {
      await workflowsGenerate({
        description: "Welcome series",
        name: "custom-slug",
        yes: true,
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("custom-slug.ts"),
        expect.any(String),
        "utf-8"
      );
    });

    it("should show preview and require confirmation without --yes", async () => {
      vi.mocked(prompts.confirm).mockResolvedValue(true);

      await workflowsGenerate({
        description: "Welcome series",
      });

      expect(prompts.confirm).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should not write when user declines confirmation", async () => {
      vi.mocked(prompts.confirm).mockResolvedValue(false);

      await workflowsGenerate({
        description: "Welcome series",
      });

      expect(prompts.confirm).toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("should handle user cancellation via isCancel", async () => {
      vi.mocked(prompts.isCancel).mockReturnValue(true);
      vi.mocked(prompts.confirm).mockResolvedValue(Symbol("cancel") as never);

      await workflowsGenerate({
        description: "Welcome series",
      });

      expect(prompts.cancel).toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("should show code without writing in --dry-run mode", async () => {
      await workflowsGenerate({
        description: "Welcome series",
        dryRun: true,
      });

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      // Should print the code
      expect(consoleLogSpy).toHaveBeenCalledWith(mockCode);
    });

    it("should auto-validate after writing", async () => {
      await workflowsGenerate({
        description: "Welcome series",
        yes: true,
      });

      expect(parseWorkflowTs).toHaveBeenCalled();
      expect(transformWorkflow).toHaveBeenCalled();
      expect(validateTransformedWorkflow).toHaveBeenCalled();
    });

    it("should show validation warnings gracefully", async () => {
      vi.mocked(validateTransformedWorkflow).mockReturnValue({
        valid: true,
        errors: [{ severity: "warning", message: "Minor issue" }],
      } as never);

      await workflowsGenerate({
        description: "Welcome series",
        yes: true,
      });

      // File should still be written
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockProgress.succeed).toHaveBeenCalledWith(
        expect.stringContaining("warning")
      );
    });

    it("should show validation errors without deleting file", async () => {
      vi.mocked(validateTransformedWorkflow).mockReturnValue({
        valid: false,
        errors: [{ severity: "error", message: "Bad step" }],
      } as never);

      await workflowsGenerate({
        description: "Welcome series",
        yes: true,
      });

      // File should still exist
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockProgress.fail).toHaveBeenCalledWith(
        expect.stringContaining("validation error")
      );
    });

    it("should handle validation failure gracefully", async () => {
      vi.mocked(parseWorkflowTs).mockRejectedValue(new Error("Parse error"));

      await workflowsGenerate({
        description: "Welcome series",
        yes: true,
      });

      // File should still be written
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockProgress.info).toHaveBeenCalledWith(
        expect.stringContaining("auto-validate")
      );
    });

    it("should error when file exists without --force", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await workflowsGenerate({
        description: "Welcome series",
      });

      expect(prompts.log.error).toHaveBeenCalledWith(
        expect.stringContaining("already exists")
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should track LLM mode in telemetry", async () => {
      await workflowsGenerate({
        description: "Welcome series",
        yes: true,
      });

      expect(trackCommand).toHaveBeenCalledWith(
        "email:workflows:generate",
        expect.objectContaining({ mode: "llm" })
      );
    });
  });

  // ── LLM Mode Error Handling ──

  describe("LLM mode error handling", () => {
    beforeEach(() => {
      vi.mocked(resolveTokenAsync).mockResolvedValue("test-token-123");
      vi.mocked(getApiBaseUrl).mockReturnValue("https://api.wraps.dev");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should throw aiUsageLimitReached on 429", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limited"),
      });

      await expect(
        workflowsGenerate({ description: "test", yes: true })
      ).rejects.toThrow("AI generation usage limit reached");
    });

    it("should throw workflowGenerationFailed on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve(JSON.stringify({ error: "Server error" })),
      });

      await expect(
        workflowsGenerate({ description: "test", yes: true })
      ).rejects.toThrow("Workflow generation failed");
    });

    it("should handle non-JSON error body from API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(
        workflowsGenerate({ description: "test", yes: true })
      ).rejects.toThrow("Workflow generation failed");
    });
  });

  // ── LLM Mode JSON Output ──

  describe("LLM mode JSON output", () => {
    const mockCode = `import { defineWorkflow } from '@wraps.dev/client';
export default defineWorkflow({ name: 'Test', trigger: { type: 'manual' }, steps: [] });`;

    beforeEach(() => {
      setJsonMode(true);
      vi.mocked(resolveTokenAsync).mockResolvedValue("test-token-123");
      vi.mocked(getApiBaseUrl).mockReturnValue("https://api.wraps.dev");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: mockCode, slug: "test" }),
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should output JSON success on LLM generation", async () => {
      await workflowsGenerate({
        description: "test workflow",
        json: true,
        yes: true,
      });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return (
            parsed.command === "email.workflows.generate" && parsed.success
          );
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.data.mode).toBe("llm");
      expect(output.data.slug).toBe("test-workflow");
    });

    it("should output JSON for dry run", async () => {
      await workflowsGenerate({
        description: "test workflow",
        dryRun: true,
        json: true,
      });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return (
            parsed.command === "email.workflows.generate" && parsed.success
          );
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.data.dryRun).toBe(true);
      expect(output.data.code).toBe(mockCode);
    });
  });
});
