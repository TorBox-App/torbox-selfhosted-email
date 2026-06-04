import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import type { SelfhostDestroyOptions } from "../../types/index.js";
import { validateAWSCredentials } from "../../utils/shared/aws.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import {
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import { withLockRetry } from "../../utils/shared/pulumi.js";
import {
  DEFAULT_PULUMI_TIMEOUT_MS,
  withTimeout,
} from "../../utils/shared/timeout.js";

export async function selfhostDestroy(
  options: SelfhostDestroyOptions
): Promise<void> {
  clack.intro(pc.bold("Wraps Self-Hosted Destroy"));

  const progress = new DeploymentProgress();

  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  const region =
    options.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1";

  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.selfhost) {
    clack.log.error("No self-hosted deployment found.");
    clack.log.info(`Run ${pc.cyan("wraps selfhost deploy")} first.`);
    process.exit(1);
  }

  const selfhostService = metadata.services.selfhost;

  if (!selfhostService.pulumiStackName) {
    clack.log.error("This deployment was created with pnpm selfhost:deploy.");
    clack.log.info(`Run ${pc.cyan("pnpm selfhost:destroy")} instead.`);
    process.exit(1);
  }

  const stackName = selfhostService.pulumiStackName;

  if (!(options.yes || options.force)) {
    const confirmed = await clack.confirm({
      message: pc.red(
        `Destroy self-hosted deployment in ${pc.cyan(identity.accountId)} / ${pc.cyan(region)}?`
      ),
      initialValue: false,
    });
    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Destruction cancelled.");
      process.exit(0);
    }
  }

  await progress.execute(
    "Destroying self-hosted infrastructure (this may take 2-3 minutes)",
    async () => {
      await ensurePulumiWorkDir({ accountId: identity.accountId, region });
      const stack = await pulumi.automation.LocalWorkspace.selectStack({
        stackName,
        workDir: getPulumiWorkDir(),
      });
      await stack.refresh({ onOutput: () => {} });
      await withLockRetry(
        () =>
          withTimeout(
            stack.destroy({ onOutput: () => {} }),
            DEFAULT_PULUMI_TIMEOUT_MS,
            "Pulumi destroy"
          ),
        { accountId: identity.accountId, region, autoConfirm: options.force }
      );
      await stack.workspace.removeStack(stackName);
    }
  );

  metadata.services.selfhost = undefined;
  metadata.timestamp = new Date().toISOString();
  await saveConnectionMetadata(metadata);

  clack.outro(pc.green("Self-hosted deployment destroyed."));
}
