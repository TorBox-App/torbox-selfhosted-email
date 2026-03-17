/**
 * CodeBlockContent — XSS Prevention
 *
 * Verifies that when syntaxHighlighting=false, raw children are HTML-escaped
 * before being rendered via dangerouslySetInnerHTML.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CodeBlockContent — XSS prevention", () => {
  it("escapes HTML when syntaxHighlighting is false", () => {
    // Navigate from apps/api/src/__tests__ to apps/website/src/...
    const filePath = resolve(
      __dirname,
      "../../../..",
      "apps/website/src/components/ui/shadcn-io/code-block/server.tsx"
    );
    const source = readFileSync(filePath, "utf-8");

    // When syntaxHighlighting=false, the children should be escaped, not passed raw
    // The else branch should NOT just assign children directly to html
    const elseBlock = source.match(
      /}\s*else\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s
    );
    expect(elseBlock).not.toBeNull();

    const elseContent = elseBlock![1];
    // Must NOT do `html = children` (raw assignment)
    expect(elseContent).not.toMatch(/html\s*=\s*children\s*;/);
  });
});
