import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isJsonMode,
  jsonError,
  jsonSuccess,
  setJsonMode,
} from "../shared/json-output.js";

describe("isJsonMode", () => {
  afterEach(() => {
    setJsonMode(false);
  });

  it("should return false by default", () => {
    expect(isJsonMode()).toBe(false);
  });
});

describe("setJsonMode", () => {
  afterEach(() => {
    setJsonMode(false);
  });

  it("should enable JSON mode when set to true", () => {
    setJsonMode(true);
    expect(isJsonMode()).toBe(true);
  });

  it("should disable JSON mode when set to false", () => {
    setJsonMode(true);
    expect(isJsonMode()).toBe(true);

    setJsonMode(false);
    expect(isJsonMode()).toBe(false);
  });
});

describe("jsonSuccess", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    setJsonMode(false);
  });

  it("should output correct envelope with success: true", () => {
    jsonSuccess("email.status", { region: "us-east-1" });

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(parsed.success).toBe(true);
  });

  it("should include the command name correctly", () => {
    jsonSuccess("email.status", { region: "us-east-1" });

    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(parsed.command).toBe("email.status");
  });

  it("should include data fields", () => {
    const data = {
      region: "us-east-1",
      domains: ["example.com"],
      resourceCount: 5,
    };

    jsonSuccess("email.status", data);

    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(parsed.data).toEqual(data);
  });

  it("should output valid parseable JSON", () => {
    jsonSuccess("sms.init", { phoneNumber: "+14155551234" });

    const raw = consoleLogSpy.mock.calls[0][0];
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe("jsonError", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    setJsonMode(false);
  });

  it("should output correct envelope with success: false", () => {
    jsonError("email.init", {
      code: "NO_AWS_CREDENTIALS",
      message: "AWS credentials not found",
    });

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(parsed.success).toBe(false);
    expect(parsed.command).toBe("email.init");
    expect(parsed.error).toEqual({
      code: "NO_AWS_CREDENTIALS",
      message: "AWS credentials not found",
    });
  });

  it("should include suggestion and docsUrl when provided", () => {
    jsonError("email.init", {
      code: "NO_AWS_CREDENTIALS",
      message: "AWS credentials not found",
      suggestion: "Run: aws configure",
      docsUrl: "https://wraps.dev/docs/guides/aws-setup",
    });

    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(parsed.error.suggestion).toBe("Run: aws configure");
    expect(parsed.error.docsUrl).toBe(
      "https://wraps.dev/docs/guides/aws-setup"
    );
  });

  it("should omit suggestion and docsUrl when not provided", () => {
    jsonError("email.destroy", {
      code: "NO_STACK",
      message: "No Wraps infrastructure found",
    });

    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(parsed.error).toEqual({
      code: "NO_STACK",
      message: "No Wraps infrastructure found",
    });
    expect(parsed.error.suggestion).toBeUndefined();
    expect(parsed.error.docsUrl).toBeUndefined();
  });

  it("should output valid parseable JSON", () => {
    jsonError("cdn.init", {
      code: "PULUMI_ERROR",
      message: "Failed to create S3 bucket",
      suggestion: "Check your AWS permissions",
    });

    const raw = consoleLogSpy.mock.calls[0][0];
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
