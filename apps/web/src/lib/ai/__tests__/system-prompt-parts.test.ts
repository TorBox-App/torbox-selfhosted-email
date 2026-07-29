import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildSystemPromptParts } from "../system-prompt";

const BRAND_KIT = {
  primaryColor: "#111",
  secondaryColor: "#222",
  backgroundColor: "#fff",
  textColor: "#000",
  fontFamily: "Inter",
  companyName: "Acme",
  logoUrl: "https://example.com/logo.png",
};

const VARIABLES = [{ name: "firstName", label: "First name", type: "string" }];

describe("buildSystemPromptParts", () => {
  it("concatenates back to the exact pre-split prompt", () => {
    // The split must not change a single byte of what the model sees —
    // reordering a prompt changes generations.
    for (const options of [
      {},
      { brandKit: BRAND_KIT },
      { availableVariables: VARIABLES },
      { existingContent: '{"type":"doc"}' },
      {
        brandKit: BRAND_KIT,
        availableVariables: VARIABLES,
        existingContent: '{"type":"doc"}',
      },
    ]) {
      const { stable, dynamic } = buildSystemPromptParts(options);
      expect(`${stable}\n\n${dynamic}`).toBe(buildSystemPrompt(options));
    }
  });

  it("keeps the stable half unchanged when the edited template changes", () => {
    // This is the whole point: the cache prefix has to survive the thing that
    // varies most between requests.
    const a = buildSystemPromptParts({ existingContent: "AAA" });
    const b = buildSystemPromptParts({ existingContent: "BBB" });
    expect(a.stable).toBe(b.stable);
    expect(a.dynamic).not.toBe(b.dynamic);
  });

  it("puts the current template in the dynamic half, not the cached one", () => {
    const { stable, dynamic } = buildSystemPromptParts({
      existingContent: "UNIQUE_TEMPLATE_MARKER",
    });
    expect(stable).not.toContain("UNIQUE_TEMPLATE_MARKER");
    expect(dynamic).toContain("UNIQUE_TEMPLATE_MARKER");
  });

  it("is large enough to be worth caching", () => {
    // Anthropic will not cache a prefix under 1024 tokens for Sonnet. This
    // guards against someone trimming the spec below the threshold and
    // silently disabling caching.
    const { stable } = buildSystemPromptParts({});
    expect(stable.length / 4).toBeGreaterThan(1024);
  });

  it("carries the brand kit in the stable half, which is org-stable", () => {
    // Brand kit changes rarely, so keeping it cached is what gives a single
    // org repeated cache hits within a session.
    const { stable } = buildSystemPromptParts({ brandKit: BRAND_KIT });
    expect(stable).toContain("Acme");
  });
});
