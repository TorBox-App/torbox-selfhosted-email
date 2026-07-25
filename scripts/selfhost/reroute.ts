import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import { deployEmailStack } from "../../packages/cli/src/infrastructure/email-stack.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../packages/cli/src/utils/shared/fs.js";
import type { ConnectionMetadata } from "../../packages/cli/src/utils/shared/metadata.js";
import {
  buildEmailStackConfig,
  saveConnectionMetadata,
} from "../../packages/cli/src/utils/shared/metadata.js";
import { ensurePulumiInstalled } from "../../packages/cli/src/utils/shared/pulumi.js";

/**
 * The SES event webhook target, as the email stack expects it: a BASE url.
 *
 * `eventbridge.ts` appends `/webhooks/ses/{awsAccountNumber}` itself, matching
 * the API's only SES ingestion route. Passing a full path here produced
 * `.../v1/ses-events/webhooks/ses/{acct}` — a route that exists nowhere, so
 * EventBridge POSTed into a 404 and every rerouted event was dropped while the
 * deploy reported success.
 */
export function sesEventsWebhookUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

/**
 * Point the customer's SES event webhook at their self-hosted API by
 * redeploying the email Pulumi stack with a new webhook URL.
 *
 * The email stack is Pulumi, but the self-hosted control plane is SST — and
 * SST embeds its own engine rather than shelling out, so nothing else in the
 * selfhost path puts a `pulumi` binary on PATH. Install it here or the
 * automation API dies with `spawn pulumi ENOENT`.
 */
export async function rerouteEmailEvents(options: {
  metadata: ConnectionMetadata;
  accountId: string;
  region: string;
  apiUrl: string;
}): Promise<void> {
  const { metadata, accountId, region, apiUrl } = options;
  const email = metadata.services.email;
  if (!email?.webhookSecret) {
    throw new Error(
      "No email stack with a webhook secret found in this account — deploy the email stack with `wraps email init` first."
    );
  }

  const webhookUrl = sesEventsWebhookUrl(apiUrl);
  const stackConfig = buildEmailStackConfig(metadata, region, {
    webhook: {
      awsAccountNumber: accountId,
      webhookSecret: email.webhookSecret,
      webhookUrl,
    },
  });

  if (await ensurePulumiInstalled()) {
    clack.log.info("Installed the Pulumi CLI (needed by the email stack)");
  }
  await ensurePulumiWorkDir({ accountId, region });
  const emailStackName =
    email.pulumiStackName || `wraps-${accountId}-${region}`;

  const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
    {
      stackName: emailStackName,
      projectName: "wraps-email",
      program: async () => {
        const result = await deployEmailStack(stackConfig);
        return {
          roleArn: result.roleArn,
          configSetName: result.configSetName,
          tableName: result.tableName,
          region: result.region,
        };
      },
    },
    {
      workDir: getPulumiWorkDir(),
      envVars: { PULUMI_CONFIG_PASSPHRASE: "", AWS_REGION: region },
      secretsProvider: "passphrase",
    }
  );
  await stack.setConfig("aws:region", { value: region });
  await stack.refresh({ onOutput: () => {} });
  await stack.up({ onOutput: () => {} });

  // Persist the reroute target — without this, the next email stack redeploy
  // rebuilds the webhook with the default (Wraps platform) URL and silently
  // points the customer's events back at us.
  email.webhookUrl = webhookUrl;
  metadata.timestamp = new Date().toISOString();
  await saveConnectionMetadata(metadata);
}
