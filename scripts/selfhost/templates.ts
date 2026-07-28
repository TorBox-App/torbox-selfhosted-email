import * as clack from "@clack/prompts";
import pc from "picocolors";
import {
  describeProvisionOutcomes,
  type ProvisionOutcome,
  provisionAuthTemplates,
} from "../../packages/core/src/provision-auth-templates.js";

export type { ProvisionOutcome } from "../../packages/core/src/provision-auth-templates.js";

/**
 * Publish the auth email templates with the console output shared by the SST
 * variant's deploy and upgrade. The Pulumi variant has its own wrapper in
 * packages/cli — same core call, different progress reporting.
 *
 * Never throws. A deployment whose infrastructure came up correctly should not
 * be reported as failed because SES rejected a template — the stack is real and
 * already serving. The warning names the consequence so it is not mistaken for
 * noise, since the symptom otherwise appears much later at first signup.
 */
export async function provisionTemplatesWithProgress(
  region: string
): Promise<ProvisionOutcome[]> {
  clack.log.step("Publishing auth email templates to SES...");

  let outcomes: ProvisionOutcome[];
  try {
    outcomes = await provisionAuthTemplates(region);
  } catch (error) {
    clack.log.warn(
      `Could not publish auth email templates: ${error instanceof Error ? error.message : String(error)}\nSignup verification, invitations and mobile-rescue email will fail until this succeeds.`
    );
    return [];
  }

  const { published, skipped, failed } = describeProvisionOutcomes(outcomes);

  if (published.length > 0) {
    clack.log.success(
      `Published ${published.length} auth email template${published.length === 1 ? "" : "s"}: ${published.map((o) => o.templateName).join(", ")}`
    );
  }

  for (const outcome of skipped) {
    clack.log.info(
      `${pc.cyan(outcome.templateName)} published, but SES could not confirm it renders: ${outcome.detail}`
    );
  }

  for (const outcome of failed) {
    clack.log.warn(
      `Template ${pc.cyan(outcome.templateName)} failed to publish: ${outcome.detail}\nThe email that uses it will fail to send.`
    );
  }

  return outcomes;
}
