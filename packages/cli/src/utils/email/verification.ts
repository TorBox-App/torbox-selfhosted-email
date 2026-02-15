import {
  GetIdentityVerificationAttributesCommand,
  SESClient,
  VerifyEmailIdentityCommand,
} from "@aws-sdk/client-ses";
import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import * as clack from "@clack/prompts";
import pc from "picocolors";

type DomainSendingStatus = {
  verified: boolean;
  dkimStatus: string;
};

/**
 * Check whether a domain is verified for sending in SES.
 * Lightweight: single GetEmailIdentity call.
 */
export async function checkDomainSendingStatus(
  domain: string,
  region: string
): Promise<DomainSendingStatus> {
  const sesv2 = new SESv2Client({ region });
  const response = await sesv2.send(
    new GetEmailIdentityCommand({ EmailIdentity: domain })
  );
  return {
    verified: !!response.VerifiedForSendingStatus,
    dkimStatus: response.DkimAttributes?.Status || "PENDING",
  };
}

type PollOptions = {
  intervalMs?: number;
  timeoutMs?: number;
};

const DEFAULT_DOMAIN_POLL_INTERVAL_MS = 15_000; // 15 seconds
const DEFAULT_DOMAIN_POLL_TIMEOUT_MS = 5 * 60_000; // 5 minutes

/**
 * Poll domain verification status with a clack spinner.
 * Returns true when verified, false on timeout.
 */
export async function pollDomainVerification(
  domain: string,
  region: string,
  options?: PollOptions
): Promise<boolean> {
  const intervalMs = options?.intervalMs ?? DEFAULT_DOMAIN_POLL_INTERVAL_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_DOMAIN_POLL_TIMEOUT_MS;
  const startTime = Date.now();
  const sesv2 = new SESv2Client({ region });

  const spinner = clack.spinner();
  spinner.start(
    `Waiting for ${pc.cyan(domain)} DNS verification (this can take a few minutes)...`
  );

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    try {
      const response = await sesv2.send(
        new GetEmailIdentityCommand({ EmailIdentity: domain })
      );
      const verified = !!response.VerifiedForSendingStatus;
      const dkimStatus = response.DkimAttributes?.Status || "PENDING";

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const elapsedStr =
        elapsed >= 60
          ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
          : `${elapsed}s`;

      if (verified) {
        spinner.stop(
          pc.green(`✓ Domain ${domain} is verified! (${elapsedStr})`)
        );
        return true;
      }

      spinner.message(
        `DKIM: ${dkimStatus} — ${elapsedStr} elapsed, checking every ${intervalMs / 1000}s...`
      );
      // guardrails:allow-next-line no-swallowed-errors — transient API errors during polling are non-fatal, will retry
    } catch {}
  }

  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  spinner.stop(
    pc.yellow(
      `⏱ Timed out after ${Math.round(totalElapsed / 60)}m waiting for DNS verification`
    )
  );
  return false;
}

const DEFAULT_RECIPIENT_POLL_INTERVAL_MS = 10_000; // 10 seconds
const DEFAULT_RECIPIENT_POLL_TIMEOUT_MS = 5 * 60_000; // 5 minutes

/**
 * Send a verification email to a recipient (SES sandbox requirement)
 * and poll until they confirm. Returns verified status.
 */
export async function verifySandboxRecipient(
  email: string,
  region: string,
  options?: PollOptions
): Promise<{ verified: boolean; email: string; error?: string }> {
  const intervalMs = options?.intervalMs ?? DEFAULT_RECIPIENT_POLL_INTERVAL_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_RECIPIENT_POLL_TIMEOUT_MS;

  const ses = new SESClient({ region });

  // Trigger verification email
  try {
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: email }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { verified: false, email, error: msg };
  }

  const spinner = clack.spinner();
  spinner.start(
    `Verification email sent to ${pc.cyan(email)} — waiting for confirmation...`
  );

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    try {
      const response = await ses.send(
        new GetIdentityVerificationAttributesCommand({
          Identities: [email],
        })
      );

      const attrs = response.VerificationAttributes?.[email];
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const elapsedStr =
        elapsed >= 60
          ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
          : `${elapsed}s`;

      if (attrs?.VerificationStatus === "Success") {
        spinner.stop(pc.green(`✓ ${email} verified! (${elapsedStr})`));
        return { verified: true, email };
      }

      spinner.message(
        `Waiting for ${email} to click verification link (${elapsedStr} elapsed)...`
      );
      // guardrails:allow-next-line no-swallowed-errors — transient API errors during polling are non-fatal, will retry
    } catch {}
  }

  spinner.stop(pc.yellow(`⏱ Timed out waiting for ${email} to verify`));
  return { verified: false, email };
}
