/**
 * TypeScript Workflow Parser
 *
 * Parses .ts workflow files using esbuild, extracts workflow definitions,
 * and prepares them for push to the API.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { WorkflowDefinition } from "./workflow-transform.js";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ParsedWorkflow = {
  /** Kebab-case identifier derived from filename (e.g., "onboarding" from onboarding.ts) */
  slug: string;
  /** Full path to the workflow file */
  filePath: string;
  /** Original TypeScript source code */
  source: string;
  /** SHA256 hash of source for change detection */
  sourceHash: string;
  /** Parsed workflow definition object */
  definition: WorkflowDefinition;
  /** Relative path from wraps/ directory (e.g., "workflows/onboarding.ts") */
  cliProjectPath: string;
};

export type ParseError = {
  slug: string;
  filePath: string;
  error: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discover all workflow .ts files in the workflows directory.
 *
 * @param dir - Path to the workflows directory
 * @param filter - Optional filter to match a specific workflow by slug
 * @returns Array of workflow file names (e.g., ["onboarding.ts", "abandoned-cart.ts"])
 */
export async function discoverWorkflows(
  dir: string,
  filter?: string
): Promise<string[]> {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = await readdir(dir);
  const workflows = entries.filter(
    (f) =>
      // Include .ts files only (not .tsx for workflows)
      f.endsWith(".ts") &&
      // Exclude private/helper files starting with _
      !f.startsWith("_") &&
      // Exclude type definition files
      !f.endsWith(".d.ts")
  );

  if (filter) {
    const slug = filter.replace(/\.ts$/, "");
    return workflows.filter((f) => f.replace(/\.ts$/, "") === slug);
  }

  return workflows;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a single workflow TypeScript file.
 *
 * Uses esbuild to bundle the file (handling imports), then dynamically imports
 * the result to extract the workflow definition.
 *
 * @param filePath - Full path to the workflow .ts file
 * @param wrapsDir - Path to the wraps/ directory
 * @returns ParsedWorkflow with the extracted definition
 */
export async function parseWorkflowTs(
  filePath: string,
  wrapsDir: string
): Promise<ParsedWorkflow> {
  const { build } = await import("esbuild");

  const source = await readFile(filePath, "utf-8");
  const sourceHash = createHash("sha256").update(source).digest("hex");
  const slug = basename(filePath, ".ts");

  // Create shim for @wraps.dev/client (workflow helpers)
  // These are identity functions - they just return their input
  const shimDir = join(wrapsDir, ".wraps", "_shims");
  await mkdir(shimDir, { recursive: true });

  // Client shim - workflow definitions and step helpers
  const clientShimContent = `
// Identity functions for workflow definitions
export const defineWorkflow = (def) => def;

// Step helper functions - they just create step definition objects
export const sendEmail = (id, config) => ({
  id,
  type: 'send_email',
  name: config.name ?? \`Send email: \${config.template || 'custom'}\`,
  config: { type: 'send_email', ...config },
});

export const sendSms = (id, config) => ({
  id,
  type: 'send_sms',
  name: config.name ?? \`Send SMS: \${config.template || 'custom'}\`,
  config: { type: 'send_sms', ...config },
});

export const delay = (id, duration) => {
  const { name, ...durationConfig } = duration;
  const normalized = normalizeDuration(durationConfig);
  return {
    id,
    type: 'delay',
    name: name ?? \`Wait \${normalized.amount} \${normalized.unit}\`,
    config: { type: 'delay', ...normalized },
  };
};

export const condition = (id, config) => {
  const { branches, name, ...conditionConfig } = config;
  return {
    id,
    type: 'condition',
    name: name ?? \`Check: \${config.field} \${config.operator}\`,
    config: { type: 'condition', ...conditionConfig },
    branches,
  };
};

export const waitForEvent = (id, config) => {
  const { name, timeout, ...eventConfig } = config;
  return {
    id,
    type: 'wait_for_event',
    name: name ?? \`Wait for: \${config.eventName}\`,
    config: {
      type: 'wait_for_event',
      eventName: eventConfig.eventName,
      timeoutSeconds: durationToSeconds(timeout),
    },
  };
};

export const waitForEmailEngagement = (id, config) => {
  const { name, timeout, emailStepId, engagementType } = config;
  return {
    id,
    type: 'wait_for_email_engagement',
    name: name ?? \`Wait for email \${engagementType}: \${emailStepId}\`,
    config: {
      type: 'wait_for_email_engagement',
      timeoutSeconds: durationToSeconds(timeout),
    },
  };
};

export const exit = (id, config) => {
  const { name, ...exitConfig } = config ?? {};
  return {
    id,
    type: 'exit',
    name: name ?? 'Exit',
    config: { type: 'exit', ...exitConfig },
  };
};

export const updateContact = (id, config) => {
  const { name, ...updateConfig } = config;
  return {
    id,
    type: 'update_contact',
    name: name ?? 'Update contact',
    config: { type: 'update_contact', ...updateConfig },
  };
};

export const subscribeTopic = (id, config) => {
  const { name, ...topicConfig } = config;
  return {
    id,
    type: 'subscribe_topic',
    name: name ?? \`Subscribe to topic: \${config.topicId}\`,
    config: { type: 'subscribe_topic', ...topicConfig },
  };
};

export const unsubscribeTopic = (id, config) => {
  const { name, ...topicConfig } = config;
  return {
    id,
    type: 'unsubscribe_topic',
    name: name ?? \`Unsubscribe from topic: \${config.topicId}\`,
    config: { type: 'unsubscribe_topic', ...topicConfig },
  };
};

export const webhook = (id, config) => {
  const { name, ...webhookConfig } = config;
  return {
    id,
    type: 'webhook',
    name: name ?? \`Webhook: \${config.url}\`,
    config: { type: 'webhook', method: 'POST', ...webhookConfig },
  };
};

/**
 * cascade(id, config) — expand a cross-channel cascade into primitive steps.
 *
 * For each email channel (except the last), we emit:
 *   send_email → wait_for_email_engagement → condition (engaged?)
 * with the condition's "yes" branch containing an exit node and the "no"
 * branch falling through to the next channel.
 *
 * Non-email channels (SMS) emit only a send step.
 *
 * Every generated step carries cascadeGroupId = id so the execution
 * engine can scope engagement queries to the correct group.
 */
export const cascade = (id, config) => {
  const channels = config.channels || [];
  const steps = [];

  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const isLast = i === channels.length - 1;

    if (channel.type === 'email') {
      // Send email step
      steps.push({
        id: id + '-send-' + i,
        type: 'send_email',
        name: 'Cascade: send ' + (channel.template || 'email'),
        config: { type: 'send_email', templateId: channel.template },
        cascadeGroupId: id,
      });

      // If not last channel, add wait + condition
      if (!isLast && channel.waitFor) {
        const waitSeconds = durationToSeconds(channel.waitFor) || 259200;
        const waitId = id + '-wait-' + i;
        const condId = id + '-cond-' + i;
        const exitId = id + '-exit-' + i;

        // Wait for engagement step
        steps.push({
          id: waitId,
          type: 'wait_for_email_engagement',
          name: 'Cascade: wait for ' + (channel.engagement || 'opened'),
          config: { type: 'wait_for_email_engagement', timeoutSeconds: waitSeconds },
          cascadeGroupId: id,
        });

        // Condition step: check engagement.status
        steps.push({
          id: condId,
          type: 'condition',
          name: 'Cascade: email engaged?',
          config: {
            type: 'condition',
            field: 'engagement.status',
            operator: 'equals',
            value: 'true',
          },
          cascadeGroupId: id,
          branches: {
            yes: [{
              id: exitId,
              type: 'exit',
              name: 'Exit',
              config: { type: 'exit', reason: 'Engaged via email' },
              cascadeGroupId: id,
            }],
          },
        });
      }
    } else if (channel.type === 'sms') {
      // Send SMS step
      steps.push({
        id: id + '-send-' + i,
        type: 'send_sms',
        name: 'Cascade: send ' + (channel.template || 'sms'),
        config: { type: 'send_sms', template: channel.template, body: channel.body },
        cascadeGroupId: id,
      });
    }
  }

  return steps;
};

// Internal helpers
function normalizeDuration(duration) {
  if (duration.days !== undefined) {
    return { amount: duration.days, unit: 'days' };
  }
  if (duration.hours !== undefined) {
    return { amount: duration.hours, unit: 'hours' };
  }
  if (duration.minutes !== undefined) {
    return { amount: duration.minutes, unit: 'minutes' };
  }
  return { amount: 1, unit: 'hours' };
}

function durationToSeconds(duration) {
  if (!duration) return undefined;
  let seconds = 0;
  if (duration.days) seconds += duration.days * 24 * 60 * 60;
  if (duration.hours) seconds += duration.hours * 60 * 60;
  if (duration.minutes) seconds += duration.minutes * 60;
  return seconds > 0 ? seconds : undefined;
}
`;

  await writeFile(
    join(shimDir, "wraps-client-shim.mjs"),
    clientShimContent,
    "utf-8"
  );

  // Bundle the workflow file with esbuild
  const result = await build({
    entryPoints: [filePath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node24",
    alias: {
      "@wraps.dev/client": join(shimDir, "wraps-client-shim.mjs"),
    },
  });

  const bundledCode = result.outputFiles[0].text;

  // Write to temp file for dynamic import
  const tmpDir = join(wrapsDir, ".wraps", "_workflows");
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `${slug}.mjs`);
  await writeFile(tmpPath, bundledCode, "utf-8");

  // Dynamic import to get the workflow definition
  // Add cache-busting query param so Node reimports on file change
  const mod = await import(`${tmpPath}?t=${Date.now()}`);
  const definition = mod.default as WorkflowDefinition;

  if (!definition || typeof definition !== "object") {
    throw new Error(
      "Workflow must have a default export (workflow definition from defineWorkflow())"
    );
  }

  if (!definition.name) {
    throw new Error("Workflow definition must have a 'name' property");
  }

  if (!definition.trigger) {
    throw new Error("Workflow definition must have a 'trigger' property");
  }

  if (!Array.isArray(definition.steps)) {
    throw new Error("Workflow definition must have a 'steps' array");
  }

  return {
    slug,
    filePath,
    source,
    sourceHash,
    definition,
    cliProjectPath: `workflows/${slug}.ts`,
  };
}

/**
 * Parse all workflows in a directory.
 *
 * @param workflowsDir - Path to the workflows directory
 * @param wrapsDir - Path to the wraps/ directory
 * @param filter - Optional filter to parse a specific workflow by slug
 * @returns Object with parsed workflows and any parse errors
 */
export async function parseAllWorkflows(
  workflowsDir: string,
  wrapsDir: string,
  filter?: string
): Promise<{
  workflows: ParsedWorkflow[];
  errors: ParseError[];
}> {
  const files = await discoverWorkflows(workflowsDir, filter);
  const workflows: ParsedWorkflow[] = [];
  const errors: ParseError[] = [];

  for (const file of files) {
    const filePath = join(workflowsDir, file);
    const slug = file.replace(/\.ts$/, "");

    try {
      const parsed = await parseWorkflowTs(filePath, wrapsDir);
      workflows.push(parsed);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push({ slug, filePath, error: errMsg });
    }
  }

  return { workflows, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute SHA256 hash of content.
 */
export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
