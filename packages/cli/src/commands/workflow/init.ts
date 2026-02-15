import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";

const EXAMPLE_CASCADE_WORKFLOW = `import {
  defineWorkflow,
  sendEmail,
  delay,
  cascade,
  exit,
} from '@wraps.dev/client';

/**
 * Cart Recovery Cascade
 *
 * Tries email first, waits 2 hours for engagement,
 * then falls back to SMS if the email wasn't opened.
 */
export default defineWorkflow({
  name: 'Cart Recovery Cascade',
  trigger: {
    type: 'event',
    eventName: 'cart.abandoned',
  },

  steps: [
    // Wait 30 minutes before starting recovery
    delay('initial-wait', { minutes: 30 }),

    // Cross-channel cascade: email → SMS
    ...cascade('recover-cart', {
      channels: [
        {
          type: 'email',
          template: 'cart-recovery',
          waitFor: { hours: 2 },
          engagement: 'opened',
        },
        {
          type: 'sms',
          template: 'cart-sms-reminder',
        },
      ],
    }),

    // If we get here, all channels were tried
    exit('cascade-complete'),
  ],
});
`;

const EXAMPLE_WELCOME_WORKFLOW = `import {
  defineWorkflow,
  sendEmail,
  delay,
  condition,
  exit,
} from '@wraps.dev/client';

/**
 * Welcome Sequence
 *
 * Onboard new users with a welcome email,
 * then check if they activated before sending tips.
 */
export default defineWorkflow({
  name: 'Welcome Sequence',
  trigger: {
    type: 'contact_created',
  },

  steps: [
    sendEmail('welcome', { template: 'welcome-email' }),
    delay('wait-1-day', { days: 1 }),
    condition('check-activated', {
      field: 'contact.hasActivated',
      operator: 'equals',
      value: true,
      branches: {
        yes: [exit('already-active')],
        no: [
          sendEmail('tips', { template: 'getting-started-tips' }),
        ],
      },
    }),
  ],
});
`;

const EXAMPLE_CONFIG = `import { defineConfig } from '@wraps.dev/email';

export default defineConfig({
  org: 'your-org-slug',
  from: { email: 'hello@yourdomain.com', name: 'Your App' },
  region: 'us-east-1',
  templatesDir: './templates',
  workflowsDir: './workflows',
});
`;

export type WorkflowInitOptions = {
  yes?: boolean;
};

export async function workflowInit(options: WorkflowInitOptions = {}) {
  clack.intro(pc.bgCyan(pc.black(" wraps workflow init ")));

  const wrapsDir = join(process.cwd(), "wraps");
  const workflowsDir = join(wrapsDir, "workflows");
  const configPath = join(wrapsDir, "wraps.config.ts");

  // Check if directory already exists
  if (existsSync(workflowsDir)) {
    clack.log.info(
      `Workflows directory already exists at ${pc.cyan("wraps/workflows/")}`
    );

    const files =
      existsSync(join(workflowsDir, "cart-recovery.ts")) ||
      existsSync(join(workflowsDir, "welcome-sequence.ts"));

    if (files && !options.yes) {
      const shouldContinue = await clack.confirm({
        message: "Example files may already exist. Overwrite them?",
        initialValue: false,
      });

      if (clack.isCancel(shouldContinue) || !shouldContinue) {
        clack.log.info("Skipping file creation.");
        showNextSteps();
        clack.outro("Done!");
        return;
      }
    }
  }

  try {
    const s = clack.spinner();

    // Create directory
    s.start("Creating workflows directory...");
    mkdirSync(workflowsDir, { recursive: true });
    s.stop("Created wraps/workflows/");

    // Write example files
    s.start("Scaffolding example workflows...");

    writeFileSync(
      join(workflowsDir, "cart-recovery.ts"),
      EXAMPLE_CASCADE_WORKFLOW,
      "utf-8"
    );

    writeFileSync(
      join(workflowsDir, "welcome-sequence.ts"),
      EXAMPLE_WELCOME_WORKFLOW,
      "utf-8"
    );

    s.stop("Created 2 example workflows");

    // Create wraps.config.ts if it doesn't exist
    if (!existsSync(configPath)) {
      writeFileSync(configPath, EXAMPLE_CONFIG, "utf-8");
      clack.log.info(`Created ${pc.cyan("wraps/wraps.config.ts")}`);
    }

    // Show what was created
    clack.log.success(
      `${pc.bold("Workflows scaffolded!")} Created:\n` +
        `  ${pc.cyan("wraps/wraps.config.ts")}               — Project config\n` +
        `  ${pc.cyan("wraps/workflows/cart-recovery.ts")}    — Cross-channel cascade example\n` +
        `  ${pc.cyan("wraps/workflows/welcome-sequence.ts")} — Welcome series example`
    );

    showNextSteps();
    clack.outro(pc.green("Happy orchestrating!"));
  } catch (error) {
    clack.log.error(
      `Failed to scaffold workflows: ${error instanceof Error ? error.message : String(error)}`
    );
    clack.outro(pc.red("Scaffolding failed."));
    process.exitCode = 1;
  }
}

function showNextSteps() {
  clack.log.info(
    `${pc.bold("Next steps:")}\n\n` +
      `  1. Edit ${pc.cyan("wraps/wraps.config.ts")} with your org slug and domain\n` +
      `  2. Edit your workflows in ${pc.cyan("wraps/workflows/")}\n` +
      `  3. Validate: ${pc.cyan("wraps email workflows validate")}\n` +
      `  4. Push:     ${pc.cyan("wraps email workflows push")}\n\n` +
      `  ${pc.dim("Docs:")} ${pc.underline("https://wraps.dev/docs/guides/orchestration")}`
  );
}
