import { describe, expect, it } from "vitest";
import { WrapsError } from "../../utils/shared/errors.js";
import { mapInboundTestSendError } from "../email/inbound.js";

const ctx = {
  source: "test@jaststore.com",
  recipient: "test@jaststore.com",
  domain: "jaststore.com",
  receivingDomain: "jaststore.com",
  region: "us-east-1",
};

function makeAwsError(name: string, message: string): Error {
  const error = new Error(message) as Error & {
    $metadata: { httpStatusCode: number };
  };
  error.name = name;
  error.$metadata = { httpStatusCode: 400 };
  return error;
}

describe("mapInboundTestSendError", () => {
  it("maps MessageRejected to a sandbox/unverified diagnosis with no credentials lie", () => {
    // This is the exact bug Nicholas Graham reported.
    const original = makeAwsError(
      "MessageRejected",
      "Email address is not verified. The following identities failed the check in region US-EAST-1: test@jaststore.com"
    );

    const result = mapInboundTestSendError(original, ctx);

    expect(result).toBeInstanceOf(WrapsError);
    expect(result.message).not.toMatch(/credentials not found/i);
    const wraps = result as WrapsError;
    expect(wraps.code).toBe("INBOUND_TEST_MESSAGE_REJECTED");
    // The suggestion should mention the actual diagnostic context
    expect(wraps.suggestion).toContain("sandbox");
    expect(wraps.suggestion).toContain("test@jaststore.com");
    expect(wraps.suggestion).toContain("us-east-1");
    expect(wraps.suggestion).toContain("wraps email status");
    // And must NOT push the user toward `aws configure`
    expect(wraps.suggestion).not.toMatch(/aws configure/i);
  });

  it("maps an InvalidParameterValue 'not verified' message to the same diagnosis", () => {
    // SES sometimes throws InvalidParameterValue for unverified senders.
    const original = makeAwsError(
      "InvalidParameterValue",
      "Sender domain is not verified."
    );

    const result = mapInboundTestSendError(original, ctx);

    expect(result).toBeInstanceOf(WrapsError);
    const wraps = result as WrapsError;
    expect(wraps.code).toBe("INBOUND_TEST_MESSAGE_REJECTED");
    expect(wraps.message).not.toMatch(/credentials/i);
  });

  it("maps a 'not verified' message under any error name to the sandbox diagnosis", () => {
    // Defense in depth — if AWS SDK v3 returns name: 'Error' (a known quirk)
    // we still recognize the not-verified case from the message.
    const original = makeAwsError("Error", "Email address is not verified.");

    const result = mapInboundTestSendError(original, ctx);

    expect(result).toBeInstanceOf(WrapsError);
    expect((result as WrapsError).code).toBe("INBOUND_TEST_MESSAGE_REJECTED");
  });

  it("maps MailFromDomainNotVerifiedException to its own diagnosis", () => {
    const original = makeAwsError(
      "MailFromDomainNotVerifiedException",
      "Mail from domain mail.jaststore.com is not verified."
    );

    const result = mapInboundTestSendError(original, ctx);

    expect(result).toBeInstanceOf(WrapsError);
    const wraps = result as WrapsError;
    expect(wraps.code).toBe("INBOUND_TEST_MAIL_FROM_NOT_VERIFIED");
    expect(wraps.message).toContain("jaststore.com");
    expect(wraps.message).not.toMatch(/credentials/i);
  });

  it("maps AccountSendingPausedException to a paused-account diagnosis", () => {
    const original = makeAwsError(
      "AccountSendingPausedException",
      "Email sending is paused for this account."
    );

    const result = mapInboundTestSendError(original, ctx);

    const wraps = result as WrapsError;
    expect(wraps.code).toBe("INBOUND_TEST_SENDING_PAUSED");
    expect(wraps.suggestion).toContain("Reputation");
  });

  it("maps AccessDeniedException to an IAM permission diagnosis with the failing region", () => {
    const original = makeAwsError(
      "AccessDeniedException",
      "User is not authorized to perform: ses:SendEmail"
    );

    const result = mapInboundTestSendError(original, ctx);

    const wraps = result as WrapsError;
    expect(wraps.code).toBe("INBOUND_TEST_PERMISSION_DENIED");
    expect(wraps.message).toContain("us-east-1");
    expect(wraps.message).toContain("ses:SendEmail");
    expect(wraps.message).not.toMatch(/credentials not found/i);
  });

  it("passes WrapsErrors through unchanged", () => {
    const original = new WrapsError(
      "Already a wraps error",
      "ALREADY_MAPPED",
      "do nothing"
    );

    const result = mapInboundTestSendError(original, ctx);

    expect(result).toBe(original);
  });

  it("re-throws unknown AWS errors so the global handler can surface them", () => {
    // For an unrecognized error name, the mapper should pass the original
    // through so Layer 1 (handleCLIError -> awsErrorToWrapsError) can do
    // its generic AWS error fallback (which now also doesn't lie).
    const original = makeAwsError(
      "SomeNewSESExceptionWeNeverHeardOf",
      "Something specific happened"
    );

    const result = mapInboundTestSendError(original, ctx);

    expect(result).toBe(original);
  });

  it("wraps non-Error throwables in a generic WrapsError", () => {
    const result = mapInboundTestSendError("a string error", ctx);

    expect(result).toBeInstanceOf(WrapsError);
    const wraps = result as WrapsError;
    expect(wraps.code).toBe("INBOUND_TEST_SEND_FAILED");
    expect(wraps.message).toContain("test@jaststore.com");
  });
});
