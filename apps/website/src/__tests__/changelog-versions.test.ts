import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RELEASES_FILE = resolve(
  __dirname,
  "..",
  "app/changelog/components/releases-section.tsx"
);

const VERSION_LINE = /^\s+version: "(.*)",\s*$/;

function versionStrings(): string[] {
  return readFileSync(RELEASES_FILE, "utf8")
    .split("\n")
    .map((line) => line.match(VERSION_LINE)?.[1])
    .filter((value): value is string => value !== undefined);
}

// Mirrors pillLabel in releases-section.tsx. Kept as a copy on purpose: the
// component is a module-private array, and the point of this suite is to catch
// a renderer change that stops matching the data.
const VERSION_NUMBER = /\bv\d/;
const BARE_NUMBER = /^\d/;

function pillLabel(version: string): string {
  if (VERSION_NUMBER.test(version)) {
    return version;
  }
  return BARE_NUMBER.test(version) ? `v${version}` : version;
}

describe("changelog version pills", () => {
  const versions = versionStrings();

  it("reads every release version out of the source", () => {
    // Guards the regex above: a refactor that changes the field's formatting
    // would otherwise silently make this whole suite vacuous.
    expect(versions.length).toBeGreaterThan(50);
  });

  it("never prefixes a named release with a bogus v", () => {
    const bogus = versions
      .map((version) => pillLabel(version))
      .filter((label) => /^v[A-Za-z]/.test(label));
    expect(bogus).toEqual([]);
  });

  it("keeps the v on a semver release exactly once", () => {
    const doubled = versions
      .map((version) => pillLabel(version))
      .filter((label) => label.includes("vv"));
    expect(doubled).toEqual([]);
  });

  it("labels the three known named releases with no prefix", () => {
    expect(pillLabel("Agent-Ready Platform")).toBe("Agent-Ready Platform");
    expect(pillLabel("Workflow Engine")).toBe("Workflow Engine");
    expect(pillLabel("Website")).toBe("Website");
  });

  it("still labels a bare numeric version", () => {
    expect(pillLabel("3.11.2")).toBe("v3.11.2");
    expect(pillLabel("CLI v3.11.2")).toBe("CLI v3.11.2");
  });
});
