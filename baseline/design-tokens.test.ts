import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

// Every Tailwind surface carries its own theme CSS. The semantic tokens below
// must exist in all of them, in both colour schemes, or `pnpm lint:design`
// reports a class as "undeclared" on one surface and fine on another.
const THEME_FILES = [
  "packages/ui/src/styles/globals.css",
  "apps/web/src/app/globals.css",
  "apps/website/src/app/globals.css",
  "packages/console/src/styles/globals.css",
];

const SEMANTIC_TOKENS = [
  "brand",
  "brand-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
];

/** Returns the body of the first `<selector> {` block, honouring nested braces. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    return "";
  }
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") {
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        return css.slice(start, i);
      }
    }
  }
  return css.slice(start);
}

describe("design tokens are declared on every Tailwind surface", () => {
  for (const file of THEME_FILES) {
    const css = readFileSync(resolve(ROOT, file), "utf-8");
    const root = block(css, ":root");
    const dark = block(css, ".dark");
    const theme = block(css, "@theme inline");

    for (const token of SEMANTIC_TOKENS) {
      test(`${file} declares --${token} in :root, .dark and @theme inline`, () => {
        expect(root).toMatch(new RegExp(`--${token}:`));
        expect(dark).toMatch(new RegExp(`--${token}:`));
        expect(theme).toContain(`--color-${token}: var(--${token})`);
      });
    }
  }
});

describe("design lint policy", () => {
  test(".oxlintrc.json registers @shadcn/lint", () => {
    const config = JSON.parse(
      readFileSync(resolve(ROOT, ".oxlintrc.json"), "utf-8")
    );
    expect(config.jsPlugins).toContain("@shadcn/lint");
  });
});
