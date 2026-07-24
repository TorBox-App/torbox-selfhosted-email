import { rm } from "node:fs/promises";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import mri from "mri";
import pc from "picocolors";
import { validateAWSCredentials } from "../../packages/cli/src/utils/shared/aws.js";
import {
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../packages/cli/src/utils/shared/metadata.js";
import { REPO_ROOT, runSubprocess } from "./subprocess.js";

const ENV_PATH = join(REPO_ROOT, ".env.selfhost");
const SST_DIR = join(REPO_ROOT, "infra");
const SST_CONFIG = "selfhost.config.ts";

export type DestroyOptions = {
  region?: string;
  yes?: boolean;
  force?: boolean;
};

export async function destroy(options: DestroyOptions = {}): Promise<void> {
  clack.intro(pc.bold("Wraps Self-Hosted Destroy"));

  const identity = await validateAWSCredentials();
  const region =
    options.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1";

  if (!(options.yes || options.force)) {
    const confirmed = await clack.confirm({
      message: pc.red(
        `Destroy self-hosted deployment in ${pc.cyan(identity.accountId)} / ${pc.cyan(region)}? This will remove all AWS resources.`
      ),
      initialValue: false,
    });
    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Destruction cancelled.");
      process.exit(0);
    }
  }

  clack.log.step("Removing infrastructure (this may take a few minutes)...");
  await runSubprocess(
    "sst",
    ["remove", "--config", SST_CONFIG, "--stage", "production"],
    undefined,
    SST_DIR
  );

  // Clean up .env.selfhost
  try {
    await rm(ENV_PATH);
    clack.log.info("Removed .env.selfhost");
  } catch {
    // File may not exist — that's fine
  }

  // Clear selfhost metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);
  if (metadata?.services?.selfhost) {
    metadata.services.selfhost = undefined;
    metadata.timestamp = new Date().toISOString();
    await saveConnectionMetadata(metadata);
    clack.log.info("Cleared selfhost metadata");
  }

  clack.outro(pc.green("Self-hosted deployment destroyed."));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = mri(process.argv.slice(2), {
    string: ["region"],
    boolean: ["yes", "force"],
    alias: { y: "yes", f: "force" },
  });
  destroy({ region: flags.region, yes: flags.yes, force: flags.force }).catch(
    (err) => {
      clack.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  );
}
