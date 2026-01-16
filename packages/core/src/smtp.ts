import { createHmac } from "node:crypto";

/**
 * Convert AWS IAM secret access key to SES SMTP password.
 *
 * AWS SES uses a specific algorithm to derive SMTP passwords from IAM credentials.
 * @see https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html
 *
 * @param secretAccessKey - The IAM secret access key
 * @param region - The AWS region (e.g., "us-east-1")
 * @returns The derived SMTP password (base64 encoded)
 */
export function convertToSMTPPassword(
  secretAccessKey: string,
  region: string
): string {
  // AWS SMTP password derivation constants
  const DATE = "11111111";
  const SERVICE = "ses";
  const MESSAGE = "SendRawEmail";
  const TERMINAL = "aws4_request";
  const VERSION = 0x04;

  // Step 1: Create signing key using HMAC-SHA256 chain
  const kDate = createHmac("sha256", `AWS4${secretAccessKey}`)
    .update(DATE)
    .digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(SERVICE).digest();
  const kTerminal = createHmac("sha256", kService).update(TERMINAL).digest();
  const kMessage = createHmac("sha256", kTerminal).update(MESSAGE).digest();

  // Step 2: Prepend version byte and base64 encode
  const signatureWithVersion = Buffer.concat([
    Buffer.from([VERSION]),
    kMessage,
  ]);
  return signatureWithVersion.toString("base64");
}

/**
 * Get the SMTP endpoint for a given AWS region
 *
 * @param region - The AWS region
 * @returns The SMTP endpoint URL
 */
export function getSMTPEndpoint(region: string): string {
  return `email-smtp.${region}.amazonaws.com`;
}

/**
 * SMTP connection details
 */
export type SMTPConnectionDetails = {
  host: string;
  port: number;
  secure: boolean;
};

/**
 * Get SMTP connection details for a region
 *
 * @param region - The AWS region
 * @returns SMTP connection configuration
 */
export function getSMTPConnectionDetails(
  region: string
): SMTPConnectionDetails {
  return {
    host: getSMTPEndpoint(region),
    port: 587, // STARTTLS
    secure: false, // Use STARTTLS
  };
}
