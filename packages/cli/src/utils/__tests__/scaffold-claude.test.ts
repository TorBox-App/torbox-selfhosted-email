/**
 * scaffold-claude utility tests
 *
 * Tests the marker-based CLAUDE.md section management and skill file scaffolding.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:path", () => ({
  join: (...args: string[]) => args.join("/"),
}));

import {
  scaffoldClaudeMdSection,
  scaffoldClaudeSkill,
} from "../shared/scaffold-claude.js";

describe("scaffoldClaudeMdSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  it("creates .claude/CLAUDE.md with header when file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await scaffoldClaudeMdSection({
      projectDir: "/project",
      sectionId: "workflows",
      sectionContent: "## Workflows\n\nWorkflow info here.",
    });

    expect(mkdir).toHaveBeenCalledWith("/project/.claude", { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      "/project/.claude/CLAUDE.md",
      expect.stringContaining("# Wraps"),
      "utf-8"
    );
    expect(writeFile).toHaveBeenCalledWith(
      "/project/.claude/CLAUDE.md",
      expect.stringContaining("<!-- wraps:workflows-start -->"),
      "utf-8"
    );
    expect(writeFile).toHaveBeenCalledWith(
      "/project/.claude/CLAUDE.md",
      expect.stringContaining("<!-- wraps:workflows-end -->"),
      "utf-8"
    );
    expect(writeFile).toHaveBeenCalledWith(
      "/project/.claude/CLAUDE.md",
      expect.stringContaining("Workflow info here."),
      "utf-8"
    );
  });

  it("appends section to existing CLAUDE.md without markers", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue("# My Project\n\nExisting content.");

    await scaffoldClaudeMdSection({
      projectDir: "/project",
      sectionId: "templates",
      sectionContent: "## Templates\n\nTemplate info.",
    });

    const written = vi.mocked(writeFile).mock.calls[0][1] as string;
    // Preserves existing content
    expect(written).toContain("# My Project");
    expect(written).toContain("Existing content.");
    // Adds new section
    expect(written).toContain("<!-- wraps:templates-start -->");
    expect(written).toContain("Template info.");
    expect(written).toContain("<!-- wraps:templates-end -->");
  });

  it("replaces existing section with same sectionId (idempotent)", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const existing = [
      "# My Project",
      "",
      "<!-- wraps:workflows-start -->",
      "Old workflow content",
      "<!-- wraps:workflows-end -->",
      "",
      "Other stuff",
    ].join("\n");
    vi.mocked(readFile).mockResolvedValue(existing);

    await scaffoldClaudeMdSection({
      projectDir: "/project",
      sectionId: "workflows",
      sectionContent: "New workflow content",
    });

    const written = vi.mocked(writeFile).mock.calls[0][1] as string;
    // Replaces old content
    expect(written).not.toContain("Old workflow content");
    expect(written).toContain("New workflow content");
    // Preserves surrounding content
    expect(written).toContain("# My Project");
    expect(written).toContain("Other stuff");
    // Only one pair of markers
    expect(written.match(/wraps:workflows-start/g)).toHaveLength(1);
    expect(written.match(/wraps:workflows-end/g)).toHaveLength(1);
  });

  it("preserves other sections when updating one", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const existing = [
      "# Wraps",
      "",
      "<!-- wraps:templates-start -->",
      "Template content",
      "<!-- wraps:templates-end -->",
      "",
      "<!-- wraps:workflows-start -->",
      "Old workflow content",
      "<!-- wraps:workflows-end -->",
    ].join("\n");
    vi.mocked(readFile).mockResolvedValue(existing);

    await scaffoldClaudeMdSection({
      projectDir: "/project",
      sectionId: "workflows",
      sectionContent: "Updated workflow content",
    });

    const written = vi.mocked(writeFile).mock.calls[0][1] as string;
    // Templates section untouched
    expect(written).toContain("<!-- wraps:templates-start -->");
    expect(written).toContain("Template content");
    expect(written).toContain("<!-- wraps:templates-end -->");
    // Workflows section updated
    expect(written).toContain("Updated workflow content");
    expect(written).not.toContain("Old workflow content");
  });

  it("trims section content", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await scaffoldClaudeMdSection({
      projectDir: "/project",
      sectionId: "test",
      sectionContent: "\n\n  Content with whitespace  \n\n",
    });

    const written = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(written).toContain("Content with whitespace");
    // Should not have leading/trailing newlines inside markers
    expect(written).toContain(
      "<!-- wraps:test-start -->\nContent with whitespace\n<!-- wraps:test-end -->"
    );
  });
});

describe("scaffoldClaudeSkill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  it("creates skill directory and writes SKILL.md", async () => {
    await scaffoldClaudeSkill({
      projectDir: "/project",
      skillName: "wraps-workflows",
      skillContent: "# Skill Content\n\nHello.",
    });

    expect(mkdir).toHaveBeenCalledWith(
      "/project/.claude/skills/wraps-workflows",
      { recursive: true }
    );
    expect(writeFile).toHaveBeenCalledWith(
      "/project/.claude/skills/wraps-workflows/SKILL.md",
      expect.stringContaining("# Skill Content"),
      "utf-8"
    );
  });

  it("always overwrites existing skill file", async () => {
    await scaffoldClaudeSkill({
      projectDir: "/project",
      skillName: "wraps-templates",
      skillContent: "New content",
    });

    // writeFile is always called (no existsSync check)
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith(
      "/project/.claude/skills/wraps-templates/SKILL.md",
      "New content\n",
      "utf-8"
    );
  });

  it("trims content and adds trailing newline", async () => {
    await scaffoldClaudeSkill({
      projectDir: "/project",
      skillName: "test-skill",
      skillContent: "\n\n  Content  \n\n",
    });

    expect(writeFile).toHaveBeenCalledWith(
      "/project/.claude/skills/test-skill/SKILL.md",
      "Content\n",
      "utf-8"
    );
  });
});
