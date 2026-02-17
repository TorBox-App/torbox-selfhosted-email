/**
 * Workflows Generate Command
 *
 * Generate workflow files from built-in templates.
 *
 * Usage:
 *   wraps email workflows generate --template <name> [options]
 *
 * Options:
 *   --template <name>  Use a built-in template (welcome, cart-recovery, trial-conversion, re-engagement, onboarding)
 *   --name <slug>      Output file slug (default: derived from template name)
 *   --force            Overwrite existing file
 *   --json             Output as JSON
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { intro, log } from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../../telemetry/events.js";
import {
  isJsonMode,
  jsonError,
  jsonSuccess,
} from "../../../utils/shared/json-output.js";

type WorkflowsGenerateOptions = {
  template?: string;
  name?: string;
  force?: boolean;
  json?: boolean;
};

// ── Built-in Templates ──

const TEMPLATES: Record<string, string> = {
  welcome: `import {
  defineWorkflow,
  sendEmail,
  delay,
  condition,
  exit,
} from '@wraps.dev/client';

/**
 * Welcome Sequence
 *
 * Send a welcome email when a contact is created,
 * wait 1 day, then check if they activated.
 * If not, send a follow-up with tips.
 */
export default defineWorkflow({
  name: 'Welcome Sequence',
  trigger: {
    type: 'contact_created',
  },

  steps: [
    sendEmail('send-welcome', { template: 'welcome-email' }),
    delay('wait-1-day', { days: 1 }),
    condition('check-activated', {
      field: 'contact.hasActivated',
      operator: 'equals',
      value: true,
      branches: {
        yes: [exit('already-active')],
        no: [
          sendEmail('send-tips', { template: 'getting-started-tips' }),
        ],
      },
    }),
  ],
});
`,

  "cart-recovery": `import {
  defineWorkflow,
  sendEmail,
  sendSms,
  delay,
  cascade,
  exit,
} from '@wraps.dev/client';

/**
 * Cart Recovery Cascade
 *
 * When a cart is abandoned, wait 30 minutes, then try
 * email first. If not opened after 2 hours, fall back to SMS.
 */
export default defineWorkflow({
  name: 'Cart Recovery Cascade',
  trigger: {
    type: 'event',
    eventName: 'cart.abandoned',
  },

  steps: [
    delay('initial-wait', { minutes: 30 }),

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

    exit('cascade-complete'),
  ],
});
`,

  "trial-conversion": `import {
  defineWorkflow,
  sendEmail,
  delay,
  condition,
  exit,
} from '@wraps.dev/client';

/**
 * Trial Conversion
 *
 * Remind users 3 days before their trial ends.
 * If they haven't upgraded after 1 day, send a final nudge.
 */
export default defineWorkflow({
  name: 'Trial Conversion',
  trigger: {
    type: 'event',
    eventName: 'trial.ending',
  },

  steps: [
    sendEmail('send-reminder', { template: 'trial-ending-reminder' }),
    delay('wait-1-day', { days: 1 }),
    condition('check-upgraded', {
      field: 'contact.plan',
      operator: 'not_equals',
      value: 'free',
      branches: {
        yes: [exit('already-upgraded')],
        no: [
          sendEmail('send-upgrade-nudge', { template: 'upgrade-offer' }),
        ],
      },
    }),
  ],
});
`,

  "re-engagement": `import {
  defineWorkflow,
  sendEmail,
  delay,
  condition,
  exit,
} from '@wraps.dev/client';

/**
 * Re-engagement Campaign
 *
 * Win back inactive users with a personalized email.
 * Wait 3 days for engagement, then send a final offer.
 */
export default defineWorkflow({
  name: 'Re-engagement Campaign',
  trigger: {
    type: 'event',
    eventName: 'contact.inactive',
  },

  steps: [
    sendEmail('send-win-back', { template: 'we-miss-you' }),
    delay('wait-3-days', { days: 3 }),
    condition('check-engaged', {
      field: 'contact.lastActiveAt',
      operator: 'is_set',
      value: true,
      branches: {
        yes: [exit('re-engaged')],
        no: [
          sendEmail('send-final-offer', { template: 'final-offer' }),
        ],
      },
    }),
  ],
});
`,

  onboarding: `import {
  defineWorkflow,
  sendEmail,
  delay,
  condition,
  exit,
} from '@wraps.dev/client';

/**
 * Multi-step Onboarding
 *
 * Guide new users through setup with a series of emails.
 * Check progress at each step and skip ahead if they're done.
 */
export default defineWorkflow({
  name: 'Onboarding Sequence',
  trigger: {
    type: 'contact_created',
  },

  steps: [
    sendEmail('send-welcome', { template: 'onboarding-welcome' }),
    delay('wait-1-day', { days: 1 }),

    condition('check-profile-complete', {
      field: 'contact.profileComplete',
      operator: 'equals',
      value: true,
      branches: {
        yes: [
          sendEmail('send-next-steps', { template: 'onboarding-next-steps' }),
        ],
        no: [
          sendEmail('send-profile-reminder', { template: 'complete-your-profile' }),
          delay('wait-2-days', { days: 2 }),
          sendEmail('send-next-steps-delayed', { template: 'onboarding-next-steps' }),
        ],
      },
    }),

    delay('wait-3-days', { days: 3 }),

    condition('check-first-action', {
      field: 'contact.hasCompletedFirstAction',
      operator: 'equals',
      value: true,
      branches: {
        yes: [exit('onboarding-complete')],
        no: [
          sendEmail('send-help', { template: 'need-help' }),
        ],
      },
    }),
  ],
});
`,
};

const TEMPLATE_NAMES = Object.keys(TEMPLATES);

// ── Main Command ──

export async function workflowsGenerate(options: WorkflowsGenerateOptions) {
  const startTime = Date.now();

  if (options.template) {
    generateFromTemplate(options);
  } else {
    showUsage();
    return;
  }

  trackCommand("email:workflows:generate", {
    success: true,
    duration_ms: Date.now() - startTime,
    mode: "template",
  });
}

// ── Usage ──

function showUsage() {
  if (isJsonMode()) {
    jsonError("email.workflows.generate", {
      code: "MISSING_INPUT",
      message: "Provide a --template name to generate a workflow",
    });
    return;
  }

  log.error("Provide a --template to generate a workflow.");
  console.log();
  console.log(`  ${pc.bold("Usage:")}`);
  console.log(
    `    ${pc.cyan("wraps email workflows generate --template welcome")}`
  );
  console.log();
  console.log(
    `  ${pc.bold("Available templates:")} ${TEMPLATE_NAMES.join(", ")}`
  );
  console.log();
  console.log(`  ${pc.bold("Want a custom workflow?")}`);
  console.log(
    "    Describe what you need to your AI coding assistant (Claude Code, Cursor, etc.)"
  );
  console.log(
    `    and it will generate a workflow file using the ${pc.cyan("@wraps.dev/client")} DSL.`
  );
  console.log();
}

// ── Template Mode ──

function generateFromTemplate(options: WorkflowsGenerateOptions) {
  const templateName = options.template ?? "";
  const templateCode = TEMPLATES[templateName];

  if (!templateCode) {
    if (isJsonMode()) {
      jsonError("email.workflows.generate", {
        code: "UNKNOWN_TEMPLATE",
        message: `Unknown template: ${templateName}. Available: ${TEMPLATE_NAMES.join(", ")}`,
      });
    } else {
      log.error(`Unknown template: ${pc.red(templateName)}`);
      console.log(
        `\n  Available templates: ${TEMPLATE_NAMES.map((t) => pc.cyan(t)).join(", ")}\n`
      );
    }
    return;
  }

  const slug = options.name || templateName;
  const cwd = process.cwd();
  const workflowsDir = join(cwd, "wraps", "workflows");
  const filePath = join(workflowsDir, `${slug}.ts`);

  // Check for existing file
  if (existsSync(filePath) && !options.force) {
    if (isJsonMode()) {
      jsonError("email.workflows.generate", {
        code: "FILE_EXISTS",
        message: `wraps/workflows/${slug}.ts already exists. Use --force to overwrite.`,
      });
    } else {
      log.error(
        `${pc.cyan(`wraps/workflows/${slug}.ts`)} already exists. Use ${pc.bold("--force")} to overwrite.`
      );
    }
    return;
  }

  // Write file
  mkdirSync(workflowsDir, { recursive: true });
  writeFileSync(filePath, templateCode, "utf-8");

  if (isJsonMode()) {
    jsonSuccess("email.workflows.generate", {
      mode: "template",
      template: templateName,
      slug,
      path: `wraps/workflows/${slug}.ts`,
    });
  } else {
    intro(pc.bold("Generate Workflow"));

    log.success(
      `Created ${pc.cyan(`wraps/workflows/${slug}.ts`)} from ${pc.bold(templateName)} template`
    );
    showNextSteps(slug);
  }
}

function showNextSteps(slug: string) {
  console.log();
  console.log(`  ${pc.bold("Next steps:")}`);
  console.log(
    `    1. Edit template references in ${pc.cyan(`wraps/workflows/${slug}.ts`)}`
  );
  console.log(
    `    2. Validate: ${pc.cyan(`wraps email workflows validate --workflow ${slug}`)}`
  );
  console.log(`    3. Push:     ${pc.cyan("wraps email workflows push")}`);
  console.log();
}
