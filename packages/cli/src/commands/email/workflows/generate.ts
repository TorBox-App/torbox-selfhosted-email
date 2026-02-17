/**
 * Workflows Generate Command
 *
 * Generate workflow files from built-in templates or AI descriptions.
 *
 * Usage:
 *   wraps email workflows generate [description] [options]
 *
 * Options:
 *   --template <name>  Use a built-in template (welcome, cart-recovery, trial-conversion, re-engagement, onboarding)
 *   --name <slug>      Output file slug (default: derived from template or description)
 *   --dry-run          Show generated code without writing
 *   --yes              Skip confirmation prompts
 *   --force            Overwrite existing file
 *   --json             Output as JSON
 *   --token            API token
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cancel, confirm, intro, isCancel, log } from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../../telemetry/events.js";
import { transformWorkflow } from "../../../utils/email/workflow-transform.js";
import { parseWorkflowTs } from "../../../utils/email/workflow-ts.js";
import { validateTransformedWorkflow } from "../../../utils/email/workflow-validator.js";
import {
  getApiBaseUrl,
  resolveTokenAsync,
} from "../../../utils/shared/config.js";
import { errors } from "../../../utils/shared/errors.js";
import {
  isJsonMode,
  jsonError,
  jsonSuccess,
} from "../../../utils/shared/json-output.js";
import { DeploymentProgress } from "../../../utils/shared/output.js";

type WorkflowsGenerateOptions = {
  description?: string;
  template?: string;
  name?: string;
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  json?: boolean;
  token?: string;
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

  // Determine mode: template vs LLM
  if (options.template) {
    generateFromTemplate(options);
  } else if (options.description) {
    await generateFromDescription(options);
  } else {
    showUsage();
    return;
  }

  trackCommand("email:workflows:generate", {
    success: true,
    duration_ms: Date.now() - startTime,
    mode: options.template ? "template" : "llm",
  });
}

// ── Usage ──

function showUsage() {
  if (isJsonMode()) {
    jsonError("email.workflows.generate", {
      code: "MISSING_INPUT",
      message:
        "Provide a --template name or a description as a positional argument",
    });
    return;
  }

  log.error("Provide a description or use --template to generate a workflow.");
  console.log();
  console.log(`  ${pc.bold("Template mode:")}`);
  console.log(
    `    ${pc.cyan("wraps email workflows generate --template welcome")}`
  );
  console.log();
  console.log(`  ${pc.bold("AI mode:")}`);
  console.log(
    `    ${pc.cyan('wraps email workflows generate "Welcome series: send welcome on signup, wait 1 day, check activation"')}`
  );
  console.log();
  console.log(
    `  ${pc.bold("Available templates:")} ${TEMPLATE_NAMES.join(", ")}`
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

// ── LLM Mode ──

async function generateFromDescription(options: WorkflowsGenerateOptions) {
  const description = options.description ?? "";
  const slug = options.name || slugify(description);

  if (!checkFileExists(slug, options.force)) {
    return;
  }

  if (!isJsonMode()) {
    intro(pc.bold("Generate Workflow"));
  }

  const progress = new DeploymentProgress();

  // Auth
  const token = await resolveTokenAsync({ token: options.token });
  if (!token) {
    throw errors.notAuthenticated();
  }

  // Call API
  const code = await callGenerateApi(description, slug, token, progress);
  if (!code) {
    return;
  }

  // Dry run: show code and exit
  if (options.dryRun) {
    showDryRun(slug, code);
    return;
  }

  // Show preview and confirm unless --yes
  if (!(options.yes || isJsonMode())) {
    const shouldWrite = await showPreviewAndConfirm(slug, code);
    if (!shouldWrite) {
      return;
    }
  }

  // Write file
  writeWorkflowFile(slug, code);

  // Auto-validate (best effort — show warnings but keep the file)
  const workflowsDir = join(process.cwd(), "wraps", "workflows");
  const filePath = join(workflowsDir, `${slug}.ts`);
  await autoValidate(filePath, join(process.cwd(), "wraps"), slug, progress);

  if (isJsonMode()) {
    jsonSuccess("email.workflows.generate", {
      mode: "llm",
      slug,
      path: `wraps/workflows/${slug}.ts`,
    });
  } else {
    log.success(`Created ${pc.cyan(`wraps/workflows/${slug}.ts`)}`);
    showNextSteps(slug, true);
  }
}

// ── Helpers ──

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function checkFileExists(slug: string, force?: boolean): boolean {
  const filePath = join(process.cwd(), "wraps", "workflows", `${slug}.ts`);
  if (existsSync(filePath) && !force) {
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
    return false;
  }
  return true;
}

async function callGenerateApi(
  description: string,
  slug: string,
  token: string,
  progress: DeploymentProgress
): Promise<string | null> {
  progress.start("Generating workflow from description");

  const apiBase = getApiBaseUrl();
  const resp = await fetch(`${apiBase}/v1/workflows/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ description, slug }),
  });

  if (!resp.ok) {
    progress.fail("Generation failed");

    if (resp.status === 429) {
      throw errors.aiUsageLimitReached();
    }

    const body = await resp.text();
    let message: string;
    try {
      const parsed = JSON.parse(body);
      message = parsed.error || parsed.message || body;
    } catch {
      message = body;
    }
    throw errors.workflowGenerationFailed(message);
  }

  const data = (await resp.json()) as { code: string; slug: string };
  progress.succeed("Workflow generated");
  return data.code;
}

function showDryRun(slug: string, code: string) {
  if (isJsonMode()) {
    jsonSuccess("email.workflows.generate", {
      mode: "llm",
      dryRun: true,
      slug,
      code,
    });
  } else {
    console.log();
    log.info(pc.bold("Dry run — no file written"));
    console.log();
    console.log(pc.dim("─".repeat(60)));
    console.log(code);
    console.log(pc.dim("─".repeat(60)));
    console.log();
  }
}

async function showPreviewAndConfirm(
  slug: string,
  code: string
): Promise<boolean> {
  console.log();
  console.log(pc.dim("─".repeat(60)));
  console.log(code);
  console.log(pc.dim("─".repeat(60)));
  console.log();

  const confirmed = await confirm({
    message: `Write to ${pc.cyan(`wraps/workflows/${slug}.ts`)}?`,
    initialValue: true,
  });

  if (isCancel(confirmed) || !confirmed) {
    cancel("Generation cancelled.");
    return false;
  }
  return true;
}

function writeWorkflowFile(slug: string, code: string) {
  const workflowsDir = join(process.cwd(), "wraps", "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  writeFileSync(join(workflowsDir, `${slug}.ts`), code, "utf-8");
}

function showNextSteps(slug: string, isLlm = false) {
  console.log();
  console.log(`  ${pc.bold("Next steps:")}`);
  if (isLlm) {
    console.log(
      `    1. Review the generated workflow in ${pc.cyan(`wraps/workflows/${slug}.ts`)}`
    );
  } else {
    console.log(
      `    1. Edit template references in ${pc.cyan(`wraps/workflows/${slug}.ts`)}`
    );
  }
  console.log(
    `    2. Validate: ${pc.cyan(`wraps email workflows validate --workflow ${slug}`)}`
  );
  console.log(`    3. Push:     ${pc.cyan("wraps email workflows push")}`);
  console.log();
}

async function autoValidate(
  filePath: string,
  wrapsDir: string,
  slug: string,
  progress: DeploymentProgress
): Promise<void> {
  try {
    progress.start(`Validating ${pc.cyan(slug)}`);
    const parsed = await parseWorkflowTs(filePath, wrapsDir);
    const transformed = transformWorkflow(parsed.definition);
    const result = validateTransformedWorkflow(transformed);

    const errs = result.errors.filter((e) => e.severity === "error");
    const warnings = result.errors.filter((e) => e.severity === "warning");

    if (errs.length === 0 && warnings.length === 0) {
      progress.succeed(`${pc.cyan(slug)} is valid`);
    } else if (errs.length === 0) {
      progress.succeed(
        `${pc.cyan(slug)} is valid with ${warnings.length} warning(s)`
      );
    } else {
      progress.fail(
        `${pc.cyan(slug)} has ${errs.length} validation error(s) — review and fix manually`
      );
    }
  } catch {
    progress.info(
      `Could not auto-validate ${pc.cyan(slug)} — run ${pc.cyan("wraps email workflows validate")} manually`
    );
  }
}
