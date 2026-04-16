import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "..", "..");
const read = (relativePath: string) =>
  readFileSync(resolve(webRoot, relativePath), "utf8");

describe("Chunk 1 — Homepage", () => {
  it("hero subcopy names the agent buyer while preserving ownership framing", () => {
    const source = read("src/app/landing/components/hero-section.tsx");
    expect(source).toContain("your agent");
    expect(source).toContain("$0.10 per 1,000 emails");
    expect(source).toMatch(/your AWS\s+account/);
  });

  it("principles-section exports 5 entries including a 'Built for Agents Too' card with the Bot icon", () => {
    const source = read("src/app/landing/components/principles-section.tsx");
    expect(source).toContain("Built for Agents Too");
    expect(source).toMatch(/import[^;]*\bBot\b[^;]*from "lucide-react"/);
    expect(source).toMatch(/icon:\s*Bot/);
    expect(source).toContain("lg:grid-cols-5");
  });
});

describe("Chunk 2 — /agents marketing page", () => {
  it("page module exports metadata with agent-facing title and the /agents canonical URL", async () => {
    const mod = await import("@/app/agents/page");
    expect(mod.metadata).toBeDefined();
    expect(typeof mod.metadata.title).toBe("string");
    expect(String(mod.metadata.title).toLowerCase()).toContain("agent");
    expect(mod.metadata.alternates?.canonical).toBe("https://wraps.dev/agents");
  });

  it("page metadata.openGraph.images[0] points to /agents-og.webp at 1200×630", async () => {
    const mod = await import("@/app/agents/page");
    const images = mod.metadata.openGraph?.images;
    const first = Array.isArray(images) ? images[0] : images;
    expect(first).toBeTruthy();
    expect((first as { url?: string }).url).toBe("/agents-og.webp");
    expect((first as { width?: number }).width).toBe(1200);
    expect((first as { height?: number }).height).toBe(630);
  });

  it("page default export is a React component function", async () => {
    const mod = await import("@/app/agents/page");
    expect(typeof mod.default).toBe("function");
  });

  it("trust-section mentions 'transactional' and does not claim cold outreach as a capability", () => {
    const source = read("src/app/agents/components/trust-section.tsx");
    expect(source.toLowerCase()).toContain("transactional");
    expect(source).not.toMatch(/send cold outreach/i);
    expect(source).not.toMatch(/cold outreach from/i);
  });

  it("recipe-section references the shipped @wraps.dev/email SDK and does not reference unshipped packages", () => {
    const source = read("src/app/agents/components/recipe-section.tsx");
    expect(source).toContain("@wraps.dev/email");
    expect(source).not.toContain("@wraps.dev/mcp");
  });

  it("/agents OG image asset exists at public/agents-og.webp", () => {
    const assetPath = resolve(webRoot, "public/agents-og.webp");
    expect(existsSync(assetPath)).toBe(true);
  });
});

describe("Chunk 3 — Docs agent quickstart", () => {
  it("/docs/quickstart/email/agents page exports metadata with the correct canonical URL", async () => {
    const mod = await import("@/app/docs/quickstart/email/agents/page");
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.alternates?.canonical).toBe(
      "https://wraps.dev/docs/quickstart/email/agents"
    );
    expect(typeof mod.default).toBe("function");
  });
});

describe("Chunk 4 — llms.txt", () => {
  it("references the agent quickstart and Context7 guide for AI crawlers", () => {
    const contents = read("public/llms.txt");
    expect(contents).toContain("/docs/quickstart/email/agents");
    expect(contents).toContain("/docs/guides/context7");
    expect(contents).toContain("/agents");
  });
});

describe("Chunk 5 — Agent-forward differentiation", () => {
  it("hero uses ToolCallTrace (animated right-column), not the generic CodeBlock scaffold", () => {
    const source = read("src/app/agents/components/hero-section.tsx");
    expect(source).toContain("ToolCallTrace");
    expect(source).not.toMatch(
      /from "@\/components\/ui\/shadcn-io\/code-block"/
    );
  });

  it("hero surfaces a mono tool-signature as a visual anchor (agent-forward treatment)", () => {
    const source = read("src/app/agents/components/hero-section.tsx");
    expect(source).toMatch(/font-mono/);
    expect(source).toMatch(/wraps\.emails\.send/);
  });

  it("ToolCallTrace component exists, is a client component, and references the wraps send call", () => {
    const source = read("src/app/agents/components/tool-call-trace.tsx");
    expect(source).toMatch(/^"use client";/);
    expect(source).toContain("wraps.emails.send");
  });

  it("AgentPromptSection renders at least one natural-language prompt for agents", () => {
    const source = read("src/app/agents/components/agent-prompt-section.tsx");
    expect(source).toMatch(/Ask (Claude Code|your agent|Cursor)/i);
    expect(source.toLowerCase()).toContain("deploy wraps");
  });

  it("/agents page renders AgentPromptSection", () => {
    const source = read("src/app/agents/page.tsx");
    expect(source).toContain("AgentsPromptSection");
  });
});

describe("Chunk 6 — Internal discovery links to /agents", () => {
  it("landing navbar Products mega-menu includes an Agents entry linking to /agents", () => {
    const source = read("src/app/landing/components/navbar.tsx");
    expect(source).toMatch(
      /name:\s*"Agents",\s*href:\s*"\/agents",\s*description:/
    );
  });

  it("homepage 'Built for Agents Too' principle card links to /agents", () => {
    const source = read("src/app/landing/components/principles-section.tsx");
    expect(source).toMatch(/from "next\/link"/);
    expect(source).toContain('"/agents"');
    // Ensure the href is tied to the Agents principle — not some unrelated link.
    // href and the "Built for Agents Too" title should sit inside the same object literal.
    expect(source).toMatch(
      /Built for Agents Too[\s\S]{0,400}href:\s*"\/agents"|href:\s*"\/agents"[\s\S]{0,400}Built for Agents Too/
    );
  });
});
