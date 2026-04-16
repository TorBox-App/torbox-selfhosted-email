import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "..", "..");
const read = (relativePath: string) =>
  readFileSync(resolve(webRoot, relativePath), "utf8");

describe("Chunk 3 — Docs nav + quickstart hub", () => {
  it("docs-nav Email Quickstart children include /docs/quickstart/email/agents", () => {
    const source = read("src/components/docs-nav.tsx");
    expect(source).toContain('"/docs/quickstart/email/agents"');
    expect(source).toMatch(
      /title:\s*"Agents",\s*href:\s*"\/docs\/quickstart\/email\/agents"/
    );
  });

  it("quickstart hub cliGuides array includes an Agents entry linking to the quickstart", () => {
    const source = read("src/app/docs/quickstart/page-content.tsx");
    expect(source).toContain('"/docs/quickstart/email/agents"');
    expect(source).toMatch(/title:\s*"Agents"/);
  });
});
