import { type SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { describe, expect, it, vi } from "vitest";
import { sendEmail, WRAPS_CONFIGURATION_SET_NAME } from "../send";

type SimpleContent = {
  Subject?: { Data?: string };
  Body?: {
    Html?: { Data?: string };
    Text?: { Data?: string };
  };
  Headers?: Array<{ Name: string; Value: string }>;
};

type CapturedInput = {
  FromEmailAddress?: string;
  ReplyToAddresses?: string[];
  Destination?: { ToAddresses?: string[] };
  Content?: { Simple?: SimpleContent };
  ConfigurationSetName?: string;
  EmailTags?: Array<{ Name: string; Value: string }>;
};

function createCapturingClient(messageId = "test-message-id") {
  const sendMock = vi.fn(async (_command: SendEmailCommand) => ({
    MessageId: messageId,
    $metadata: { httpStatusCode: 200 },
  }));
  return {
    client: { send: sendMock } as unknown as SESv2Client,
    sendMock,
  };
}

function getCapturedInput(sendMock: ReturnType<typeof vi.fn>): CapturedInput {
  const command = sendMock.mock.calls[0]?.[0] as SendEmailCommand;
  expect(command).toBeInstanceOf(SendEmailCommand);
  return command.input as CapturedInput;
}

describe("sendEmail", () => {
  it("attaches both List-Unsubscribe headers when marketing.unsubscribeUrl is set", async () => {
    const { client, sendMock } = createCapturingClient();

    await sendEmail({
      client,
      from: "Acme <hello@acme.dev>",
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      marketing: {
        unsubscribeUrl: "https://api.wraps.dev/unsubscribe/abc.def.ghi",
      },
      tags: [{ name: "source", value: "test" }],
    });

    const input = getCapturedInput(sendMock);
    const headers = input.Content?.Simple?.Headers ?? [];
    expect(headers).toEqual([
      {
        Name: "List-Unsubscribe",
        Value: "<https://api.wraps.dev/unsubscribe/abc.def.ghi>",
      },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
  });

  it("omits List-Unsubscribe headers for transactional sends (no marketing field)", async () => {
    const { client, sendMock } = createCapturingClient();

    await sendEmail({
      client,
      from: "hello@acme.dev",
      to: "user@example.com",
      subject: "Receipt",
      html: "<p>Receipt</p>",
      text: "Receipt",
      tags: [{ name: "source", value: "test" }],
    });

    const input = getCapturedInput(sendMock);
    expect(input.Content?.Simple?.Headers).toBeUndefined();
  });

  it("uses the Wraps tracking configuration set by default", async () => {
    const { client, sendMock } = createCapturingClient();

    await sendEmail({
      client,
      from: "hello@acme.dev",
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: [],
    });

    const input = getCapturedInput(sendMock);
    expect(input.ConfigurationSetName).toBe(WRAPS_CONFIGURATION_SET_NAME);
    expect(WRAPS_CONFIGURATION_SET_NAME).toBe("wraps-email-tracking");
  });

  it("threads EmailTags through unchanged in name/value form", async () => {
    const { client, sendMock } = createCapturingClient();

    await sendEmail({
      client,
      from: "hello@acme.dev",
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: [
        { name: "organizationId", value: "org-1" },
        { name: "templateId", value: "tpl-1" },
        { name: "source", value: "broadcast" },
      ],
    });

    const input = getCapturedInput(sendMock);
    expect(input.EmailTags).toEqual([
      { Name: "organizationId", Value: "org-1" },
      { Name: "templateId", Value: "tpl-1" },
      { Name: "source", Value: "broadcast" },
    ]);
  });

  it("forwards optional replyTo as a single-element ReplyToAddresses array", async () => {
    const { client, sendMock } = createCapturingClient();

    await sendEmail({
      client,
      from: "hello@acme.dev",
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      replyTo: "support@acme.dev",
      tags: [],
    });

    const input = getCapturedInput(sendMock);
    expect(input.ReplyToAddresses).toEqual(["support@acme.dev"]);
  });

  it("omits ReplyToAddresses when no replyTo provided", async () => {
    const { client, sendMock } = createCapturingClient();

    await sendEmail({
      client,
      from: "hello@acme.dev",
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: [],
    });

    const input = getCapturedInput(sendMock);
    expect(input.ReplyToAddresses).toBeUndefined();
  });

  it("populates From, Destination, Subject, Html, and Text on the command", async () => {
    const { client, sendMock } = createCapturingClient();

    await sendEmail({
      client,
      from: "Acme <hello@acme.dev>",
      to: "user@example.com",
      subject: "Order shipped",
      html: "<h1>Shipped</h1>",
      text: "Shipped",
      tags: [],
    });

    const input = getCapturedInput(sendMock);
    expect(input.FromEmailAddress).toBe("Acme <hello@acme.dev>");
    expect(input.Destination?.ToAddresses).toEqual(["user@example.com"]);
    expect(input.Content?.Simple?.Subject?.Data).toBe("Order shipped");
    expect(input.Content?.Simple?.Body?.Html?.Data).toBe("<h1>Shipped</h1>");
    expect(input.Content?.Simple?.Body?.Text?.Data).toBe("Shipped");
  });

  it("returns the SES MessageId", async () => {
    const { client } = createCapturingClient("ses-msg-42");
    const result = await sendEmail({
      client,
      from: "hello@acme.dev",
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: [],
    });
    expect(result.messageId).toBe("ses-msg-42");
  });

  it("throws when SES omits MessageId — better than fabricating a fake one that would orphan downstream tracking events", async () => {
    const sendMock = vi.fn(async () => ({
      $metadata: { httpStatusCode: 200 },
    }));
    const client = { send: sendMock } as unknown as SESv2Client;

    await expect(
      sendEmail({
        client,
        from: "hello@acme.dev",
        to: "user@example.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        text: "Hi",
        tags: [],
      })
    ).rejects.toThrow("SES SendEmail returned no MessageId");
  });

  it("respects an explicit configurationSetName override", async () => {
    const { client, sendMock } = createCapturingClient();

    await sendEmail({
      client,
      from: "hello@acme.dev",
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: [],
      configurationSetName: "my-custom-set",
    });

    const input = getCapturedInput(sendMock);
    expect(input.ConfigurationSetName).toBe("my-custom-set");
  });
});
