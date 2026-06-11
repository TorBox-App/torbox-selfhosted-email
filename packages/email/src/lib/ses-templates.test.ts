/**
 * testRenderSESTemplate classification tests.
 *
 * The outcome of this function decides whether a publish is BLOCKED
 * (render-failed) or proceeds without verification (skipped). A
 * misclassification fails open, so each branch is pinned here — including
 * the AWS SDK v3 quirk where errors arrive as name: "Error" with the real
 * exception type only in the message.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { testRenderSESTemplate } from "./ses-templates";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(async (..._args: unknown[]) => ({})),
}));

// The SDK classes are invoked with `new` — mocks must be constructible
// (function expressions, not arrows).
vi.mock("@aws-sdk/client-sesv2", () => {
  function command(input: unknown) {
    return { input };
  }
  return {
    SESv2Client: vi.fn(function SESv2ClientMock() {
      return { send: mockSend };
    }),
    TestRenderEmailTemplateCommand: vi.fn(command),
    CreateEmailTemplateCommand: vi.fn(command),
    UpdateEmailTemplateCommand: vi.fn(command),
    DeleteEmailTemplateCommand: vi.fn(command),
    GetEmailTemplateCommand: vi.fn(command),
  };
});

const credentials = {
  accessKeyId: "test-key",
  secretAccessKey: "test-secret",
  sessionToken: "test-token",
};

function sesError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function runTestRender() {
  return testRenderSESTemplate(credentials, "us-east-1", {
    templateName: "wraps-probe-tmpl-1",
    templateData: { firstName: "", dashboardUrl: "" },
  });
}

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({});
});

describe("testRenderSESTemplate", () => {
  it("returns ok and sends the template data as JSON when SES renders", async () => {
    const outcome = await runTestRender();

    expect(outcome).toEqual({ status: "ok" });
    const command = mockSend.mock.calls[0][0] as {
      input: { TemplateName: string; TemplateData: string };
    };
    expect(command.input.TemplateName).toBe("wraps-probe-tmpl-1");
    expect(JSON.parse(command.input.TemplateData)).toEqual({
      firstName: "",
      dashboardUrl: "",
    });
  });

  it("classifies BadRequestException as render-failed (publish must block)", async () => {
    mockSend.mockRejectedValueOnce(
      sesError("BadRequestException", "Template rendering failed")
    );

    expect(await runTestRender()).toEqual({
      status: "render-failed",
      reason: "Template rendering failed",
    });
  });

  it("classifies a generic-named error with an 'Attribute' message as render-failed", async () => {
    // AWS SDK v3 quirk: the exception type sometimes only appears in the
    // message, with name: "Error".
    mockSend.mockRejectedValueOnce(
      sesError("Error", "Attribute 'IF' is not present in the rendering data")
    );

    expect(await runTestRender()).toEqual({
      status: "render-failed",
      reason: "Attribute 'IF' is not present in the rendering data",
    });
  });

  it("classifies AccessDeniedException as skipped with the update-role hint", async () => {
    mockSend.mockRejectedValueOnce(
      sesError("AccessDeniedException", "Access denied")
    );

    const outcome = await runTestRender();
    expect(outcome.status).toBe("skipped");
    if (outcome.status !== "skipped") return;
    expect(outcome.reason).toContain("wraps platform update-role");
  });

  it("classifies a generic-named 'not authorized to perform' error as skipped", async () => {
    mockSend.mockRejectedValueOnce(
      sesError(
        "Error",
        "User: arn:aws:sts::123:assumed-role/x is not authorized to perform: ses:TestRenderEmailTemplate"
      )
    );

    const outcome = await runTestRender();
    expect(outcome.status).toBe("skipped");
    if (outcome.status !== "skipped") return;
    expect(outcome.reason).toContain("wraps platform update-role");
  });

  it("classifies throttling as skipped — a throttle must never block a publish", async () => {
    mockSend.mockRejectedValueOnce(
      sesError("TooManyRequestsException", "Rate exceeded")
    );

    expect(await runTestRender()).toEqual({
      status: "skipped",
      reason: "Rate exceeded",
    });
  });

  it("classifies unknown errors as skipped rather than blocking", async () => {
    mockSend.mockRejectedValueOnce(sesError("Error", "socket hang up"));

    expect(await runTestRender()).toEqual({
      status: "skipped",
      reason: "socket hang up",
    });
  });
});
