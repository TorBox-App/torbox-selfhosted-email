import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The publishing itself is covered in packages/core (provision-auth-templates
 * and the auth-templates variable contract). What is left here is the SST
 * variant's reporting, and the one property that matters operationally: this
 * step must never turn a deployed, serving control plane into a failed deploy.
 */

const mockProvision = vi.hoisted(() => vi.fn());
vi.mock("../../../packages/core/src/provision-auth-templates.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../packages/core/src/provision-auth-templates.js")
  >("../../../packages/core/src/provision-auth-templates.js");
  return { ...actual, provisionAuthTemplates: mockProvision };
});

const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  step: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@clack/prompts", () => ({ log: mockLog }));

const { provisionTemplatesWithProgress } = await import("../templates.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockProvision.mockResolvedValue([
    { templateName: "email-verification", status: "published" },
  ]);
});

describe("provisionTemplatesWithProgress", () => {
  it("passes the deploy region through", async () => {
    await provisionTemplatesWithProgress("eu-west-1");

    // SES templates are per-region — publishing into the ambient region would
    // leave the deployed region without them.
    expect(mockProvision).toHaveBeenCalledWith("eu-west-1");
  });

  it("names what was published", async () => {
    await provisionTemplatesWithProgress("us-east-1");

    expect(mockLog.success.mock.calls.flat().join("\n")).toContain(
      "email-verification"
    );
  });

  it("warns instead of throwing when SES is unreachable", async () => {
    // The stack is already deployed and serving by this point.
    mockProvision.mockRejectedValue(new Error("Network down"));

    await expect(provisionTemplatesWithProgress("us-east-1")).resolves.toEqual(
      []
    );
    expect(mockLog.warn).toHaveBeenCalled();
  });

  it("names the user-visible consequence when a template fails", async () => {
    mockProvision.mockResolvedValue([
      {
        templateName: "email-verification",
        status: "failed",
        detail: "AccessDenied",
      },
    ]);

    await provisionTemplatesWithProgress("us-east-1");

    expect(mockLog.warn.mock.calls.flat().join("\n")).toMatch(/fail to send/i);
  });

  it("reports a render-skipped template as published, not failed", async () => {
    mockProvision.mockResolvedValue([
      {
        templateName: "team-invitation",
        status: "render-skipped",
        detail: "missing ses:TestRenderEmailTemplate",
      },
    ]);

    await provisionTemplatesWithProgress("us-east-1");

    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.info.mock.calls.flat().join("\n")).toContain(
      "team-invitation"
    );
  });
});
