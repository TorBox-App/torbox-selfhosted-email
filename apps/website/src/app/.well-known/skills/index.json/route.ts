import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fm;
}

export async function GET() {
  const skillsDir = join(process.cwd(), "public", ".well-known", "skills");
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = join(skillsDir, entry.name, "SKILL.md");
    try {
      const content = await readFile(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      skills.push({
        name: fm.name || entry.name,
        description: fm.description || "",
        files: ["SKILL.md"],
      });
    } catch {}
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ skills });
}
