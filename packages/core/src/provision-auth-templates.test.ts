import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = mockSend;
  },
  CreateEmailTemplateCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  UpdateEmailTemplateCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  TestRenderEmailTemplateCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

const { AUTH_SES_TEMPLATES } = await import("./auth-templates.js");
const { describeProvisionOutcomes, provisionAuthTemplates } = await import(
  "./provision-auth-templates.js"
);

/** Name of the command class each send() call was given. */
function commandNames(): string[] {
  return mockSend.mock.calls.map((c) => c[0].constructor.name);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({});
});

describe("provisionAuthTemplates", () => {
  it("publishes every template the auth senders address by name", async () => {
    const outcomes = await provisionAuthTemplates("us-east-1");

    expect(outcomes.map((o) => o.templateName)).toEqual([
      "email-verification",
      "mobile-rescue",
      "team-invitation",
    ]);
    expect(outcomes.every((o) => o.status === "published")).toBe(true);
  });

  it("sends the real subject and body, not just the template name", async () => {
    await provisionAuthTemplates("us-east-1");

    const created = mockSend.mock.calls
      .map((c) => c[0].input)
      .find(
        (i: { TemplateName?: string }) =>
          i.TemplateName === "email-verification"
      );
    expect(created.TemplateContent.Subject).toBe("Verify your email address");
    expect(created.TemplateContent.Html).toContain("{{verificationUrl}}");
    expect(created.TemplateContent.Text).toContain("{{verificationUrl}}");
  });

  it("confirms each published template renders in SES", async () => {
    // The whole reason to publish at deploy time: SES's Handlebars dialect can
    // reject a template that looks fine in the source file.
    await provisionAuthTemplates("us-east-1");

    expect(
      commandNames().filter((n) => n === "TestRenderEmailTemplateCommand")
    ).toHaveLength(AUTH_SES_TEMPLATES.length);
  });

  it("updates a template that already exists", async () => {
    // Re-running deploy or upgrade is how an edited template ships.
    mockSend.mockImplementation(
      (command: { constructor: { name: string } }) => {
        if (command.constructor.name === "CreateEmailTemplateCommand") {
          return Promise.reject(
            Object.assign(new Error("exists"), {
              name: "AlreadyExistsException",
            })
          );
        }
        return Promise.resolve({});
      }
    );

    const outcomes = await provisionAuthTemplates("us-east-1");

    expect(outcomes.every((o) => o.status === "published")).toBe(true);
    expect(
      commandNames().filter((n) => n === "UpdateEmailTemplateCommand")
    ).toHaveLength(AUTH_SES_TEMPLATES.length);
  });

  it("reports a template SES refuses to render as failed, not published", async () => {
    mockSend.mockImplementation(
      (command: { constructor: { name: string } }) => {
        if (command.constructor.name === "TestRenderEmailTemplateCommand") {
          return Promise.reject(
            Object.assign(new Error("Attribute 'x' is not present"), {
              name: "BadRequestException",
            })
          );
        }
        return Promise.resolve({});
      }
    );

    const outcomes = await provisionAuthTemplates("us-east-1");

    expect(outcomes.every((o) => o.status === "failed")).toBe(true);
    expect(outcomes[0]?.detail).toContain("not present");
  });

  it("still counts a template as published when the render check is denied", async () => {
    // Older roles may lack ses:TestRenderEmailTemplate. That is not a broken
    // template and must not be reported as one.
    mockSend.mockImplementation(
      (command: { constructor: { name: string } }) => {
        if (command.constructor.name === "TestRenderEmailTemplateCommand") {
          return Promise.reject(
            Object.assign(new Error("is not authorized to perform"), {
              name: "AccessDeniedException",
            })
          );
        }
        return Promise.resolve({});
      }
    );

    const outcomes = await provisionAuthTemplates("us-east-1");

    expect(outcomes.every((o) => o.status === "render-skipped")).toBe(true);
  });

  it("keeps publishing the rest after one template fails", async () => {
    let firstCreate = true;
    mockSend.mockImplementation(
      (command: { constructor: { name: string } }) => {
        if (
          command.constructor.name === "CreateEmailTemplateCommand" &&
          firstCreate
        ) {
          firstCreate = false;
          return Promise.reject(new Error("Throttled"));
        }
        return Promise.resolve({});
      }
    );

    const outcomes = await provisionAuthTemplates("us-east-1");

    expect(outcomes[0]).toMatchObject({
      templateName: "email-verification",
      status: "failed",
      detail: "Throttled",
    });
    expect(outcomes.slice(1).every((o) => o.status === "published")).toBe(true);
  });
});

describe("describeProvisionOutcomes", () => {
  it("splits outcomes by status", () => {
    const split = describeProvisionOutcomes([
      { templateName: "a", status: "published" },
      { templateName: "b", status: "render-skipped" },
      { templateName: "c", status: "failed" },
    ]);

    expect(split.published.map((o) => o.templateName)).toEqual(["a"]);
    expect(split.skipped.map((o) => o.templateName)).toEqual(["b"]);
    expect(split.failed.map((o) => o.templateName)).toEqual(["c"]);
  });
});
