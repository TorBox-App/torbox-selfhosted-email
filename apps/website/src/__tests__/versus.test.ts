import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { VENDORS } from "@/config/alternatives";
import { VERSUS_PAGES, versusPageBySlug } from "@/config/versus";
import { AGENT_CONTENT_PATHS } from "@/lib/agent-content-paths";

const webRoot = resolve(__dirname, "..", "..");
const versusAppDir = resolve(webRoot, "src/app/versus");
const configFile = resolve(webRoot, "src/config/versus.ts");

/** A price written as prose instead of read from the vendor record. */
const DOLLAR_LITERAL = /\$\d/;

const cases = VERSUS_PAGES.map((page) => [page.slug, page] as const);

describe("every versus page is a real, alphabetical pair of two other vendors", () => {
  it.each(cases)(
    "%s: slug matches its two vendor ids, in order",
    (slug, page) => {
      expect(slug).toBe(`${page.a}-vs-${page.b}`);
      expect(VENDORS[page.a]).toBeDefined();
      expect(VENDORS[page.b]).toBeDefined();
      // Alphabetical so the URL for a pair is decidable without looking it up,
      // and so nobody can ship both orderings of the same comparison.
      expect([page.a, page.b].toSorted()).toEqual([page.a, page.b]);
    }
  );

  it.each(cases)(
    "%s: is not about us — Wraps is never a party",
    (_slug, page) => {
      // The entire value of this format is that it is a neutral referee. A page
      // where we are one of the two contestants is /compare, not /versus.
      expect(VENDORS[page.a].isUs).toBeUndefined();
      expect(VENDORS[page.b].isUs).toBeUndefined();
    }
  );

  it("has no duplicate pair, in either order", () => {
    const seen = new Set<string>();
    for (const page of VERSUS_PAGES) {
      const key = [page.a, page.b].toSorted().join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(VERSUS_PAGES.length);
  });

  it("resolves every configured slug and throws on one that is not configured", () => {
    for (const page of VERSUS_PAGES) {
      expect(versusPageBySlug(page.slug)).toBe(page);
    }
    expect(() => versusPageBySlug("resend-vs-resend")).toThrow(
      /No versus page configured/
    );
  });
});

describe("every versus page carries enough substance to be worth publishing", () => {
  it.each(cases)(
    "%s: has the required blocks at the required depth",
    (_slug, page) => {
      expect(page.dimensions.length).toBeGreaterThanOrEqual(4);
      expect(page.pickA.length).toBeGreaterThanOrEqual(3);
      expect(page.pickB.length).toBeGreaterThanOrEqual(3);
      expect(page.faqs.length).toBeGreaterThanOrEqual(4);
    }
  );

  it.each(cases)("%s: writes real prose, not stubs", (_slug, page) => {
    expect(page.intro.length).toBeGreaterThan(300);
    for (const dimension of page.dimensions) {
      expect(dimension.a.length).toBeGreaterThan(200);
      expect(dimension.b.length).toBeGreaterThan(200);
    }
    for (const faq of page.faqs) {
      expect(faq.answer.length).toBeGreaterThan(150);
    }
  });

  it.each(cases)(
    "%s: gives no two dimensions the same heading",
    (_slug, page) => {
      const headings = page.dimensions.map((dimension) => dimension.heading);
      expect(new Set(headings).size).toBe(headings.length);
    }
  );

  it.each(cases)(
    "%s: clears the house minimum of roughly 1,800 words",
    (_slug, page) => {
      // /alternatives/resend is ~2,700 words and /compare/resend-vs-wraps
      // ~3,500. Below about 1,800 a comparison page is not competitive for
      // the query it targets and should not have been written.
      expect(wordCount(pageProse(page))).toBeGreaterThanOrEqual(1800);
    }
  );
});

describe("the deepened sections are either absent or real", () => {
  // The depth pass lands ~10 pages at a time, so these fields are optional
  // while it is mid-flight. Optional must not mean unchecked: a page that
  // carries one of them carries a written one, at the shape the renderer
  // expects. The final run of the pass makes all six required and raises the
  // word floor, at which point "absent" stops being a legal state.

  it.each(cases)(
    "%s: brings all four pros/cons arrays or none of them",
    (_slug, page) => {
      const present = [page.prosA, page.consA, page.prosB, page.consB].filter(
        Boolean
      ).length;
      expect([0, 4]).toContain(present);
    }
  );

  it.each(cases)(
    "%s: writes three or four of each, not stubs",
    (_slug, page) => {
      for (const list of [page.prosA, page.consA, page.prosB, page.consB]) {
        if (!list) {
          continue;
        }
        expect(list.length).toBeGreaterThanOrEqual(3);
        expect(list.length).toBeLessThanOrEqual(4);
        expect(new Set(list).size).toBe(list.length);
        for (const item of list) {
          expect(item.length).toBeGreaterThan(40);
          expect(item.length).toBeLessThan(400);
        }
      }
    }
  );

  it.each(cases)(
    "%s: gives the migration checklist real steps when it has one",
    (_slug, page) => {
      if (!page.migrationChecklist) {
        return;
      }
      expect(page.migrationChecklist.length).toBeGreaterThanOrEqual(5);
      expect(page.migrationChecklist.length).toBeLessThanOrEqual(9);
      expect(new Set(page.migrationChecklist).size).toBe(
        page.migrationChecklist.length
      );
      for (const step of page.migrationChecklist) {
        // A step short enough to fit in a tweet is a heading, not a step.
        expect(step.length).toBeGreaterThan(80);
        expect(step.length).toBeLessThan(600);
      }
    }
  );

  it.each(cases)(
    "%s: asks buying questions that are questions",
    (_slug, page) => {
      if (!page.buyingQuestions) {
        return;
      }
      expect(page.buyingQuestions.length).toBeGreaterThanOrEqual(5);
      expect(page.buyingQuestions.length).toBeLessThanOrEqual(8);
      expect(new Set(page.buyingQuestions).size).toBe(
        page.buyingQuestions.length
      );
      for (const question of page.buyingQuestions) {
        expect(question.length).toBeGreaterThan(40);
        expect(question.length).toBeLessThan(500);
        expect(question).toContain("?");
      }
    }
  );

  it("keeps no deepened line identical across two pages", () => {
    // A pros bullet or a checklist step that appears verbatim on a sibling is
    // the templating failure this whole pass is meant to avoid, and it is
    // cheaper to catch here than in the shingle guard, which only notices once
    // enough of them accumulate.
    const lines = VERSUS_PAGES.flatMap((page) => [
      ...(page.prosA ?? []),
      ...(page.consA ?? []),
      ...(page.prosB ?? []),
      ...(page.consB ?? []),
      ...(page.migrationChecklist ?? []),
      ...(page.buyingQuestions ?? []),
    ]);
    const seen = new Set<string>();
    const duplicated = lines.filter((line) => {
      if (seen.has(line)) {
        return true;
      }
      seen.add(line);
      return false;
    });
    expect(duplicated).toEqual([]);
  });
});

describe("prices are read from the vendor records, never restated", () => {
  it("writes no price literal into the config", () => {
    // A price written here is a price that will be wrong after the next
    // repricing, silently, on a page nobody re-reads. VENDORS is the one
    // place a number lives, and PRICES_VERIFIED dates it.
    const source = readFileSync(configFile, "utf8");
    const offending = source
      .split("\n")
      .map((line, index) => [index + 1, line] as const)
      .filter(([, line]) => DOLLAR_LITERAL.test(line));
    expect(offending).toEqual([]);
  });

  it("writes no price literal into any generated page shim", () => {
    const shims = globSync("*/page.tsx", { cwd: versusAppDir });
    const offending = shims.filter((file) =>
      DOLLAR_LITERAL.test(readFileSync(resolve(versusAppDir, file), "utf8"))
    );
    expect(offending).toEqual([]);
  });
});

describe("the Wraps mention stays the exception", () => {
  it("puts thirdOption on fewer than 40% of pages", () => {
    // 276 identical "and Wraps is also an option" blocks would be both a
    // similarity-guard failure and the thing that makes these pages
    // worthless. The note earns its place per pair or it is omitted.
    const withThird = VERSUS_PAGES.filter((page) => page.thirdOption).length;
    expect(withThird / VERSUS_PAGES.length).toBeLessThan(0.4);
  });

  it("keeps every thirdOption specific to its own page", () => {
    const notes = VERSUS_PAGES.map((page) => page.thirdOption).filter(Boolean);
    expect(new Set(notes).size).toBe(notes.length);
  });

  it("names the cost of the Wraps answer wherever it is raised", () => {
    // Same posture as /alternatives, where our own watch-out is deliberately
    // the longest on the page. A third-option note that only says the good
    // part is an advert, and an advert on a referee page is why readers stop
    // trusting the format.
    for (const page of VERSUS_PAGES) {
      if (!page.thirdOption) {
        continue;
      }
      expect(page.thirdOption).toMatch(/AWS account/i);
      expect(page.thirdOption).toMatch(/production access/i);
    }
  });
});

describe("the routes on disk are exactly the configured pages", () => {
  it("has one generated shim per configured slug and no others", () => {
    const onDisk = globSync("*/page.tsx", { cwd: versusAppDir })
      .map((file) => file.replace("/page.tsx", ""))
      .sort();
    const configured = VERSUS_PAGES.map((page) => page.slug).sort();
    expect(onDisk).toEqual(configured);
  });

  it("keeps /versus out of the edge path list", () => {
    // AGENT_CONTENT_PATHS is imported by middleware, which runs on the edge.
    // These pages are served as derived markdown by /api/md instead, so a
    // hand-authored twin here would grow the edge bundle for no benefit.
    const leaked = AGENT_CONTENT_PATHS.filter((path) =>
      path.startsWith("/versus")
    );
    expect(leaked).toEqual([]);
  });
});

describe("the pages do not read as near-duplicates of each other", () => {
  // The guard that decides whether this format is viable here at all.
  //
  // Measured the way a search engine would: overlapping 8-word shingles over
  // the prose a crawler actually sees, which is the per-pair copy plus the
  // shared vendor blocks the renderer pulls from VENDORS.
  //
  // The thresholds are deliberately tighter than /alternatives (0.55 / 0.28)
  // because this corpus is far larger and grows O(n^2) in pairs. If a batch
  // cannot pass at these numbers the content is too templated. Raising a
  // threshold to make a batch pass defeats the only mechanism standing
  // between this cluster and a pile of near-duplicate pages.
  const SHINGLE = 8;
  const MAX_SHARED_PER_PAGE = 0.45;
  const MAX_MEAN_PAIRWISE = 0.22;

  function shingles(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const out = new Set<string>();
    for (let i = 0; i + SHINGLE <= words.length; i++) {
      out.add(words.slice(i, i + SHINGLE).join(" "));
    }
    return out;
  }

  const rendered = new Map(
    VERSUS_PAGES.map((page) => [page.slug, shingles(pageProse(page))])
  );

  it.each(VERSUS_PAGES.map((page) => page.slug))(
    "%s: most of its text is unique to it",
    (slug) => {
      const mine = rendered.get(slug) as Set<string>;
      const others = new Set(
        [...rendered.entries()]
          .filter(([other]) => other !== slug)
          .flatMap(([, set]) => [...set])
      );
      const shared = [...mine].filter((s) => others.has(s)).length;
      expect(shared / mine.size).toBeLessThan(MAX_SHARED_PER_PAGE);
    }
  );

  it("keeps mean pairwise similarity well below the near-duplicate range", () => {
    const slugs = [...rendered.keys()];
    const scores: number[] = [];
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        const a = rendered.get(slugs[i]) as Set<string>;
        const b = rendered.get(slugs[j]) as Set<string>;
        const intersection = [...a].filter((s) => b.has(s)).length;
        scores.push(intersection / (a.size + b.size - intersection));
      }
    }
    const mean = scores.reduce((sum, n) => sum + n, 0) / scores.length;
    expect(mean).toBeLessThan(MAX_MEAN_PAIRWISE);
  });
});

/**
 * Everything a crawler reads on the page, in the order the article renders it:
 * the per-pair copy plus the two vendor records the renderer pulls in.
 *
 * Deliberately built here rather than in a lib/versus-markdown.ts twin. These
 * pages are served as markdown by deriving from their own HTML render, so a
 * second renderer would be a copy of the page that nothing ships and that
 * could silently disagree with it — the opposite of what this guard is for.
 */
function pageProse(page: {
  a: string;
  b: string;
  title: string;
  description: string;
  intro: string;
  dimensions: readonly { heading: string; a: string; b: string }[];
  pickA: readonly string[];
  pickB: readonly string[];
  prosA?: readonly string[];
  consA?: readonly string[];
  prosB?: readonly string[];
  consB?: readonly string[];
  migrationChecklist?: readonly string[];
  buyingQuestions?: readonly string[];
  thirdOption?: string;
  faqs: readonly { question: string; answer: string }[];
}): string {
  const vendorA = VENDORS[page.a as keyof typeof VENDORS];
  const vendorB = VENDORS[page.b as keyof typeof VENDORS];
  return [
    page.title,
    page.description,
    page.intro,
    vendorA.category,
    vendorA.pricing,
    vendorA.bestFor,
    vendorA.watchOut,
    vendorB.category,
    vendorB.pricing,
    vendorB.bestFor,
    vendorB.watchOut,
    ...page.dimensions.flatMap((d) => [d.heading, d.a, d.b]),
    ...page.pickA,
    ...page.pickB,
    ...(page.prosA ?? []),
    ...(page.consA ?? []),
    ...(page.prosB ?? []),
    ...(page.consB ?? []),
    ...(page.migrationChecklist ?? []),
    ...(page.buyingQuestions ?? []),
    page.thirdOption ?? "",
    ...page.faqs.flatMap((faq) => [faq.question, faq.answer]),
  ].join("\n\n");
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
