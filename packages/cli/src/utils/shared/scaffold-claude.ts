/**
 * Scaffold .claude/ context files for Claude Code integration.
 *
 * Provides two utilities:
 * - scaffoldClaudeMdSection: Appends/updates marker-delimited sections in .claude/CLAUDE.md
 * - scaffoldClaudeSkill: Writes .claude/skills/{name}/SKILL.md
 *
 * Both are idempotent — safe to call on every `init` run.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CLAUDE_MD_HEADER = `# Wraps

This project uses [Wraps](https://wraps.dev) for email infrastructure.
`;

/**
 * Append or update a marker-delimited section in .claude/CLAUDE.md.
 *
 * Uses `<!-- wraps:{sectionId}-start -->` / `<!-- wraps:{sectionId}-end -->` markers
 * so multiple sections (templates, workflows) can coexist without duplicating.
 */
export async function scaffoldClaudeMdSection({
  projectDir,
  sectionId,
  sectionContent,
}: {
  projectDir: string;
  sectionId: string;
  sectionContent: string;
}): Promise<void> {
  const claudeDir = join(projectDir, ".claude");
  const claudeMdPath = join(claudeDir, "CLAUDE.md");

  await mkdir(claudeDir, { recursive: true });

  const startMarker = `<!-- wraps:${sectionId}-start -->`;
  const endMarker = `<!-- wraps:${sectionId}-end -->`;
  const wrappedContent = `${startMarker}\n${sectionContent.trim()}\n${endMarker}`;

  if (!existsSync(claudeMdPath)) {
    await writeFile(
      claudeMdPath,
      `${CLAUDE_MD_HEADER}\n${wrappedContent}\n`,
      "utf-8"
    );
    return;
  }

  let existing = await readFile(claudeMdPath, "utf-8");

  // Replace existing section or append
  const markerRegex = new RegExp(
    `${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`,
    "g"
  );

  if (markerRegex.test(existing)) {
    existing = existing.replace(markerRegex, wrappedContent);
    await writeFile(claudeMdPath, existing, "utf-8");
  } else {
    await writeFile(
      claudeMdPath,
      `${existing.trimEnd()}\n\n${wrappedContent}\n`,
      "utf-8"
    );
  }
}

/**
 * Write (or overwrite) a Claude skill file at .claude/skills/{skillName}/SKILL.md.
 *
 * Always overwrites — skills track the current CLI version's DSL.
 */
export async function scaffoldClaudeSkill({
  projectDir,
  skillName,
  skillContent,
}: {
  projectDir: string;
  skillName: string;
  skillContent: string;
}): Promise<void> {
  const skillDir = join(projectDir, ".claude", "skills", skillName);
  const skillPath = join(skillDir, "SKILL.md");

  await mkdir(skillDir, { recursive: true });
  await writeFile(skillPath, `${skillContent.trim()}\n`, "utf-8");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
