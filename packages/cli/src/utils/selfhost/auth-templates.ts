import {
  describeProvisionOutcomes,
  type ProvisionOutcome,
  provisionAuthTemplates,
} from "@wraps/core";
import type { DeploymentProgress } from "../shared/output.js";

/**
 * Publish the auth email templates during an API-only (Pulumi) deploy or
 * upgrade.
 *
 * This variant deploys no dashboard — the operator hosts apps/web themselves —
 * but the templates still have to exist in THIS account, because that is where
 * their dashboard's SES sends from. `wraps selfhost env` supplies the matching
 * AUTH_EMAIL_FROM and configuration set.
 *
 * Never throws. The control plane is already deployed and serving by the time
 * this runs; a template that SES rejects is worth a warning, not a failed
 * deployment. The warning names the consequence, because the symptom otherwise
 * appears much later as a failed signup.
 */
export async function provisionAuthTemplatesWithProgress(
  region: string,
  progress: DeploymentProgress
): Promise<ProvisionOutcome[]> {
  let outcomes: ProvisionOutcome[];
  try {
    outcomes = await progress.execute(
      "Publishing auth email templates to SES",
      () => provisionAuthTemplates(region)
    );
  } catch (error) {
    progress.info(
      `Could not publish auth email templates: ${error instanceof Error ? error.message : String(error)} — signup verification, invitations and password reset will fail until this succeeds`
    );
    return [];
  }

  const { published, skipped, failed } = describeProvisionOutcomes(outcomes);

  if (published.length > 0) {
    progress.info(
      `Published ${published.length} auth email template${published.length === 1 ? "" : "s"}: ${published.map((o) => o.templateName).join(", ")}`
    );
  }

  for (const outcome of skipped) {
    progress.info(
      `${outcome.templateName} published, but SES could not confirm it renders: ${outcome.detail}`
    );
  }

  for (const outcome of failed) {
    progress.info(
      `Template ${outcome.templateName} failed to publish (${outcome.detail}) — the email that uses it will fail to send`
    );
  }

  return outcomes;
}
