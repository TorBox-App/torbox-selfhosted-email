/**
 * Regression smoke test: every `wraps/templates/*.tsx` file in the repo
 * compiles through the CLI render pipeline and produces plain-text output
 * that SES Handlebars can parse.
 *
 * This guards against the `reengagement-activate-account` class of bug
 * where `{{#if firstName}}` inside a `<Heading>` gets uppercased to
 * `{{#IF FIRSTNAME}}` by html-to-text and SES rejects the template at
 * send time with "Attribute 'IF' is not present in the rendering data."
 *
 * The test only runs when the templates directory exists. CI environments
 * without the application templates checked out will skip silently.
 */

import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderTemplateWithProxy } from "../template-render";

const TEMPLATES_DIR = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "wraps",
  "templates"
);

const UPPERCASE_HELPER_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "{{#IF}}", pattern: /\{\{#IF\b/ },
  { label: "{{/IF}}", pattern: /\{\{\/IF\}\}/ },
  { label: "{{ELSE}}", pattern: /\{\{ELSE\}\}/ },
  { label: "{{#UNLESS}}", pattern: /\{\{#UNLESS\b/ },
  { label: "{{/UNLESS}}", pattern: /\{\{\/UNLESS\}\}/ },
  { label: "{{#EACH}}", pattern: /\{\{#EACH\b/ },
  { label: "{{/EACH}}", pattern: /\{\{\/EACH\}\}/ },
  { label: "{{#WITH}}", pattern: /\{\{#WITH\b/ },
  { label: "{{/WITH}}", pattern: /\{\{\/WITH\}\}/ },
];

async function compileTemplateFromFile(filePath: string, slug: string) {
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: [filePath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node20",
    jsx: "automatic",
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);\n',
    },
  });

  const bundled = result.outputFiles[0].text;
  const tmpDir = join(
    TEMPLATES_DIR,
    "..",
    "..",
    "node_modules",
    ".wraps-compiled"
  );
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `${slug}.smoke.mjs`);
  await writeFile(tmpPath, bundled, "utf-8");

  const mod = await import(`${tmpPath}?t=${Date.now()}`);
  const Component = mod.default;
  if (typeof Component !== "function") {
    throw new Error(`Template ${slug} has no default export`);
  }

  return renderTemplateWithProxy(Component);
}

describe("wraps/templates/*.tsx plain-text smoke test", () => {
  if (!existsSync(TEMPLATES_DIR)) {
    it.skip("templates directory not present — skipping", () => {
      // no-op
    });
    return;
  }

  const templateFiles = readdirSync(TEMPLATES_DIR).filter((f) =>
    f.endsWith(".tsx")
  );

  for (const file of templateFiles) {
    const slug = file.replace(/\.tsx$/, "");
    it(`${slug}: plain text contains no uppercase Handlebars tokens`, async () => {
      const { text } = await compileTemplateFromFile(
        join(TEMPLATES_DIR, file),
        slug
      );

      for (const { label, pattern } of UPPERCASE_HELPER_PATTERNS) {
        expect(
          text,
          `${slug}: found ${label} in plain text (SES will reject this)`
        ).not.toMatch(pattern);
      }
    });
  }
});
