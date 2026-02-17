/**
 * Workflows Init Command
 *
 * Initialize workflow automation scaffolding with example files
 * and Claude Code context.
 *
 * Usage:
 *   wraps email workflows init [options]
 *
 * Options:
 *   --no-example  Skip creating example workflow file
 *   --no-claude   Skip scaffolding .claude/ context files
 *   --force       Overwrite existing files
 *   --yes         Skip confirmation prompts
 *   --json        Output as JSON
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../../telemetry/events.js";
import { isJsonMode, jsonSuccess } from "../../../utils/shared/json-output.js";
import { DeploymentProgress } from "../../../utils/shared/output.js";
import {
  scaffoldClaudeMdSection,
  scaffoldClaudeSkill,
} from "../../../utils/shared/scaffold-claude.js";
import {
  WORKFLOWS_CLAUDE_MD_SECTION,
  WORKFLOWS_SKILL_CONTENT,
} from "./claude-content.js";

type WorkflowsInitOptions = {
  noExample?: boolean;
  noClaude?: boolean;
  force?: boolean;
  yes?: boolean;
  json?: boolean;
};

const EXAMPLE_WORKFLOW = `import {
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
`;

export async function workflowsInit(options: WorkflowsInitOptions) {
  const startTime = Date.now();
  const cwd = process.cwd();
  const workflowsDir = join(cwd, "wraps", "workflows");

  if (!isJsonMode()) {
    clack.intro(pc.bold("Workflows as Code"));
  }

  const progress = new DeploymentProgress();

  // Check if wraps/workflows/ already has files
  if (existsSync(workflowsDir) && !options.force) {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(workflowsDir);
    const tsFiles = files.filter(
      (f) => f.endsWith(".ts") && !f.startsWith("_")
    );
    if (tsFiles.length > 0 && !options.force) {
      if (!isJsonMode()) {
        clack.log.warn(
          `${pc.cyan("wraps/workflows/")} already contains ${tsFiles.length} workflow file(s). Use ${pc.bold("--force")} to overwrite.`
        );
      }
      // Still allow claude scaffolding even if workflows dir exists
    }
  }

  // Create directory structure
  progress.start("Creating wraps/workflows/ directory");
  await mkdir(workflowsDir, { recursive: true });

  // Ensure wraps.config.ts exists with workflowsDir
  const configPath = join(cwd, "wraps", "wraps.config.ts");
  if (!existsSync(configPath)) {
    await writeFile(configPath, generateMinimalConfig(), "utf-8");
  } else {
    // Check if workflowsDir is already in config
    const configContent = await readFile(configPath, "utf-8");
    if (!configContent.includes("workflowsDir")) {
      // Append workflowsDir to existing config
      const updated = configContent.replace(
        /}\);(\s*)$/,
        `  workflowsDir: './workflows',\n});$1`
      );
      if (updated !== configContent) {
        await writeFile(configPath, updated, "utf-8");
      }
    }
  }

  // Write example workflow (unless --no-example)
  const filesCreated: string[] = [];
  if (!options.noExample) {
    const examplePath = join(workflowsDir, "welcome.ts");
    if (!existsSync(examplePath) || options.force) {
      await writeFile(examplePath, EXAMPLE_WORKFLOW, "utf-8");
      filesCreated.push("wraps/workflows/welcome.ts");
    }
  }

  progress.succeed("Workflows directory ready");

  // Scaffold .claude/ context (unless --no-claude)
  if (!options.noClaude) {
    try {
      progress.start("Scaffolding Claude Code context");
      await scaffoldClaudeMdSection({
        projectDir: cwd,
        sectionId: "workflows",
        sectionContent: WORKFLOWS_CLAUDE_MD_SECTION,
      });
      filesCreated.push(".claude/CLAUDE.md");

      await scaffoldClaudeSkill({
        projectDir: cwd,
        skillName: "wraps-workflows",
        skillContent: WORKFLOWS_SKILL_CONTENT,
      });
      filesCreated.push(".claude/skills/wraps-workflows/SKILL.md");

      progress.succeed("Claude Code context scaffolded");
    } catch {
      progress.info(
        "Could not scaffold .claude/ context — workflow files are still ready"
      );
    }
  }

  trackCommand("email:workflows:init", {
    success: true,
    duration_ms: Date.now() - startTime,
  });

  if (isJsonMode()) {
    jsonSuccess("email.workflows.init", {
      dir: "wraps/workflows",
      files: filesCreated,
    });
    return;
  }

  // Display success
  console.log();
  clack.log.success(pc.green("Workflows as Code initialized!"));
  console.log();
  console.log(`  ${pc.dim("Directory:")}  ${pc.cyan("wraps/workflows/")}`);
  if (!options.noExample) {
    console.log(
      `  ${pc.dim("Example:")}    ${pc.cyan("wraps/workflows/welcome.ts")}`
    );
  }
  if (!options.noClaude) {
    console.log(
      `  ${pc.dim("AI Context:")} ${pc.cyan(".claude/skills/wraps-workflows/")}`
    );
  }
  console.log();
  console.log(`${pc.bold("Next steps:")}`);
  console.log(
    `  1. Edit or create workflows in ${pc.cyan("wraps/workflows/")}`
  );
  console.log(
    `  2. Validate: ${pc.cyan("wraps email workflows validate")}`
  );
  console.log(`  3. Push:     ${pc.cyan("wraps email workflows push")}`);
  if (!options.noClaude) {
    console.log(
      `  4. Use Claude Code to generate workflows from descriptions`
    );
  }
  console.log();
}

function generateMinimalConfig(): string {
  return `import { defineConfig } from '@wraps.dev/email';

export default defineConfig({
  org: 'my-org',
  // from: { email: 'hello@yourapp.com', name: 'My App' },
  // region: 'us-east-1',
  templatesDir: './templates',
  workflowsDir: './workflows',
});
`;
}
