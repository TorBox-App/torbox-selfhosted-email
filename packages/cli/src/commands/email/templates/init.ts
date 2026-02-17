import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../../telemetry/events.js";
import { readAuthConfig } from "../../../utils/shared/config.js";
import { WrapsError } from "../../../utils/shared/errors.js";
import { isJsonMode, jsonSuccess } from "../../../utils/shared/json-output.js";
import { DeploymentProgress } from "../../../utils/shared/output.js";
import {
  scaffoldClaudeMdSection,
  scaffoldClaudeSkill,
} from "../../../utils/shared/scaffold-claude.js";
import {
  TEMPLATES_CLAUDE_MD_SECTION,
  TEMPLATES_SKILL_CONTENT,
} from "./claude-content.js";

type TemplatesInitOptions = {
  org?: string;
  noExample?: boolean;
  noClaude?: boolean;
  yes?: boolean;
  force?: boolean;
  json?: boolean;
};

export async function templatesInit(options: TemplatesInitOptions) {
  const startTime = Date.now();
  const cwd = process.cwd();
  const wrapsDir = join(cwd, "wraps");

  if (!isJsonMode()) {
    clack.intro(pc.bold("Templates as Code"));
  }

  const progress = new DeploymentProgress();

  // Check if wraps/ already exists
  if (existsSync(wrapsDir) && !options.force) {
    throw new WrapsError(
      "wraps/ directory already exists",
      "TEMPLATES_DIR_EXISTS",
      "Use --force to overwrite existing files.\n  wraps email templates init --force"
    );
  }

  // Resolve org slug
  let orgSlug = options.org;
  if (!orgSlug) {
    const config = await readAuthConfig();
    const orgs = config?.auth?.organizations;
    if (orgs?.length === 1) {
      orgSlug = orgs[0].slug;
    } else if (orgs && orgs.length > 1 && !isJsonMode()) {
      const selected = await clack.select({
        message: "Which organization?",
        options: orgs.map((o) => ({ value: o.slug, label: o.name })),
      });
      if (clack.isCancel(selected)) {
        clack.cancel("Operation cancelled.");
        process.exit(0);
      }
      orgSlug = selected as string;
    }
  }

  if (!orgSlug) {
    throw new WrapsError(
      "Could not determine organization",
      "ORG_NOT_FOUND",
      "Pass --org flag or sign in first:\n  wraps auth login\n  wraps email templates init --org my-org"
    );
  }

  // Detect project context
  let detectedDomain: string | undefined;
  let detectedRegion: string | undefined;

  try {
    const pkgPath = join(cwd, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
      // Try to detect domain from package name or homepage
      if (pkg.homepage) {
        try {
          const url = new URL(pkg.homepage);
          detectedDomain = url.hostname;
          // guardrails:allow-next-line no-swallowed-errors — invalid URL is expected
        } catch {
          // ignore invalid URL
        }
      }
    }
    // guardrails:allow-next-line no-swallowed-errors — package.json may not exist
  } catch {
    // ignore package.json read errors
  }

  // Try to detect region from wraps metadata
  try {
    const { homedir } = await import("node:os");
    const connectionsDir = join(homedir(), ".wraps", "connections");
    if (existsSync(connectionsDir)) {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(connectionsDir);
      if (files.length > 0) {
        const firstFile = files[0];
        // Extract region from filename pattern: {accountId}-{region}.json
        const match = firstFile.match(/\d+-(.+)\.json$/);
        if (match) {
          detectedRegion = match[1];
        }
      }
    }
    // guardrails:allow-next-line no-swallowed-errors — metadata may not exist
  } catch {
    // ignore metadata read errors
  }

  // Create directory structure
  progress.start("Creating wraps/ directory structure");

  await mkdir(wrapsDir, { recursive: true });
  await mkdir(join(wrapsDir, "templates"), { recursive: true });
  await mkdir(join(wrapsDir, "templates", "_components"), { recursive: true });
  await mkdir(join(wrapsDir, "workflows"), { recursive: true });
  await mkdir(join(wrapsDir, ".wraps"), { recursive: true });

  // Write wraps.config.ts
  const configContent = generateConfigFile(
    orgSlug,
    detectedDomain,
    detectedRegion
  );
  await writeFile(join(wrapsDir, "wraps.config.ts"), configContent, "utf-8");

  // Write brand.ts
  const brandContent = generateBrandFile();
  await writeFile(join(wrapsDir, "brand.ts"), brandContent, "utf-8");

  // Write example template (unless --no-example)
  if (!options.noExample) {
    await writeFile(
      join(wrapsDir, "templates", "welcome.tsx"),
      generateWelcomeTemplate(),
      "utf-8"
    );
    await writeFile(
      join(wrapsDir, "templates", "_components", "footer.tsx"),
      generateFooterComponent(),
      "utf-8"
    );
  }

  // Add .wraps/ to .gitignore
  const gitignorePath = join(wrapsDir, ".gitignore");
  await writeFile(gitignorePath, ".wraps/\n", "utf-8");

  // Also add to project root .gitignore if it exists
  const rootGitignorePath = join(cwd, ".gitignore");
  if (existsSync(rootGitignorePath)) {
    const gitignoreContent = await readFile(rootGitignorePath, "utf-8");
    if (!gitignoreContent.includes("wraps/.wraps")) {
      await writeFile(
        rootGitignorePath,
        `${gitignoreContent.trimEnd()}\n\n# Wraps CLI cache\nwraps/.wraps/\n`,
        "utf-8"
      );
    }
  }

  progress.succeed("Directory structure created");

  // Scaffold .claude/ context (unless --no-claude)
  const claudeFiles: string[] = [];
  if (!options.noClaude) {
    try {
      progress.start("Scaffolding Claude Code context");
      await scaffoldClaudeMdSection({
        projectDir: cwd,
        sectionId: "templates",
        sectionContent: TEMPLATES_CLAUDE_MD_SECTION,
      });
      claudeFiles.push(".claude/CLAUDE.md");

      await scaffoldClaudeSkill({
        projectDir: cwd,
        skillName: "wraps-templates",
        skillContent: TEMPLATES_SKILL_CONTENT,
      });
      claudeFiles.push(".claude/skills/wraps-templates/SKILL.md");

      progress.succeed("Claude Code context scaffolded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      progress.info(
        `Could not scaffold .claude/ context — template files are still ready (${msg})`
      );
    }
  }

  if (isJsonMode()) {
    jsonSuccess("email.templates.init", {
      org: orgSlug,
      dir: wrapsDir,
      files: [
        "wraps/wraps.config.ts",
        "wraps/brand.ts",
        ...(options.noExample
          ? []
          : [
              "wraps/templates/welcome.tsx",
              "wraps/templates/_components/footer.tsx",
            ]),
        ...claudeFiles,
      ],
    });
    return;
  }

  trackCommand("email:templates:init", {
    success: true,
    duration_ms: Date.now() - startTime,
  });

  // Display success
  console.log();
  clack.log.success(pc.green("Templates as Code initialized!"));
  console.log();
  console.log(`  ${pc.dim("Directory:")} ${pc.cyan("wraps/")}`);
  console.log(`  ${pc.dim("Config:")}    ${pc.cyan("wraps/wraps.config.ts")}`);
  console.log(`  ${pc.dim("Brand:")}     ${pc.cyan("wraps/brand.ts")}`);
  if (!options.noExample) {
    console.log(
      `  ${pc.dim("Example:")}   ${pc.cyan("wraps/templates/welcome.tsx")}`
    );
  }
  if (!options.noClaude && claudeFiles.length > 0) {
    console.log(
      `  ${pc.dim("AI Context:")} ${pc.cyan(".claude/skills/wraps-templates/")}`
    );
  }
  console.log();
  console.log(`${pc.bold("Next steps:")}`);
  console.log(
    `  1. Edit ${pc.cyan("wraps/wraps.config.ts")} with your settings`
  );
  console.log(`  2. Create templates in ${pc.cyan("wraps/templates/")}`);
  console.log(
    `  3. Push to SES + dashboard: ${pc.cyan("wraps email templates push")}`
  );
  console.log();
}

// ── File Generators ──

function generateConfigFile(
  org: string,
  domain?: string,
  region?: string
): string {
  const fromLine = domain
    ? `\n  from: { email: 'hello@${domain}', name: '${org}' },`
    : `\n  // from: { email: 'hello@yourapp.com', name: '${org}' },`;
  const regionLine = region
    ? `\n  region: '${region}',`
    : `\n  // region: 'us-east-1',`;

  return `import { defineConfig } from '@wraps.dev/client';

export default defineConfig({
  org: '${org}',${fromLine}${regionLine}
  templatesDir: './templates',
  brandFile: './brand.ts',
});
`;
}

function generateBrandFile(): string {
  return `import { defineBrand } from '@wraps.dev/client';

export default defineBrand({
  primaryColor: '#5046e5',
  secondaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  buttonStyle: 'rounded',
  buttonRadius: '6px',
  companyName: 'Your Company',
  companyAddress: '123 Main St, City, ST 12345',
  // logoUrl: 'https://yourapp.com/logo.png',
  // socialLinks: [
  //   { platform: 'twitter', url: 'https://twitter.com/yourcompany' },
  //   { platform: 'github', url: 'https://github.com/yourcompany' },
  // ],
});
`;
}

function generateWelcomeTemplate(): string {
  return `import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { Footer } from './_components/footer';

// ── Metadata ──

export const subject = 'Welcome to {{companyName}}, {{firstName}}!';
export const emailType = 'transactional' as const;
export const previewText = 'We\\'re glad to have you on board.';

// ── Test Data (for preview) ──

export const testData = {
  firstName: 'Jane',
  companyName: 'Acme',
  unsubscribeUrl: 'https://example.com/unsubscribe',
};

// ── Template ──

interface Props {
  firstName: string;
  companyName: string;
  unsubscribeUrl: string;
}

export default function WelcomeEmail({
  firstName,
  companyName,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={content}>
            <Heading style={heading}>
              Welcome, {firstName}!
            </Heading>
            <Text style={paragraph}>
              Thanks for signing up for {companyName}. We&apos;re excited to
              have you on board.
            </Text>
            <Text style={paragraph}>
              If you have any questions, just reply to this email — we&apos;re
              always happy to help.
            </Text>
          </Section>
          <Footer unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ──

const body = {
  backgroundColor: '#f6f9fc',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '40px 0',
  maxWidth: '580px',
};

const content = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '40px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#1f2937',
  margin: '0 0 16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#4b5563',
  margin: '0 0 12px',
};
`;
}

function generateFooterComponent(): string {
  return `import { Hr, Link, Section, Text } from '@react-email/components';

interface FooterProps {
  unsubscribeUrl: string;
}

export function Footer({ unsubscribeUrl }: FooterProps) {
  return (
    <Section style={footer}>
      <Hr style={divider} />
      <Text style={footerText}>
        {{companyName}} &bull; {{companyAddress}}
      </Text>
      <Link href={unsubscribeUrl} style={unsubscribeLink}>
        Unsubscribe
      </Link>
    </Section>
  );
}

const footer = {
  padding: '20px 40px',
  textAlign: 'center' as const,
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '0 0 20px',
};

const footerText = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '0 0 8px',
};

const unsubscribeLink = {
  fontSize: '12px',
  color: '#9ca3af',
  textDecoration: 'underline',
};
`;
}
