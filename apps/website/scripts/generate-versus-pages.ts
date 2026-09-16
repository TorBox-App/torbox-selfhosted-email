/**
 * Regenerates everything downstream of `src/config/versus.ts`:
 *
 *   1. `src/app/versus/<slug>/page.tsx` — a 12-line route shim per page
 *   2. `public/llms.txt` — one bullet per route, inside a delimited block
 *   3. `src/config/search-intent.ts` — one entry per route, same idea
 *
 * All three or none. Five separate call sites discover routes by globbing
 * `**\/page.tsx` — the sitemap, the page-dates manifest, and three tests — and
 * two more enforce that every route appears in llms.txt and in the search
 * intent map. Generating only part of this leaves the suite red.
 *
 * ## Why shims and not a [slug] dynamic route
 *
 * A dynamic route contributes ONE glob hit no matter how many pages it serves,
 * so all five of those call sites would silently stop seeing these pages: no
 * sitemap entries, no lastmod dates, no coverage enforcement. Generated
 * boilerplate is ugly; losing the guardrails is worse. /ses/errors/* already
 * ships twelve pages this way.
 *
 *   pnpm --filter wraps-website versus:generate
 *
 * Idempotent: run it twice and `git diff` is empty.
 */

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { VENDORS } from "../src/config/alternatives";
import {
  VERSUS_HUB_SEARCH_INTENT,
  VERSUS_PAGES,
  type VersusPage,
} from "../src/config/versus";

const websiteRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(websiteRoot, "..", "..");
const versusAppDir = join(websiteRoot, "src/app/versus");
const llmsFile = join(websiteRoot, "public/llms.txt");
const searchIntentFile = join(websiteRoot, "src/config/search-intent.ts");

const LLMS_BEGIN = "<!-- BEGIN GENERATED VERSUS -->";
const LLMS_END = "<!-- END GENERATED VERSUS -->";
const INTENT_BEGIN = "  // BEGIN GENERATED VERSUS INTENT";
const INTENT_END = "  // END GENERATED VERSUS INTENT";

function shimFor(page: VersusPage): string {
  return `import {
  VersusArticle,
  versusMetadata,
} from "@/components/versus-article";
import { versusPageBySlug } from "@/config/versus";

const page = versusPageBySlug("${page.slug}");

export const metadata = versusMetadata(page);

export default function Page() {
  return <VersusArticle page={page} />;
}
`;
}

/** Route shims: one directory per configured slug, and nothing else. */
function writeShims(): string[] {
  mkdirSync(versusAppDir, { recursive: true });
  const configured = new Set(VERSUS_PAGES.map((page) => page.slug));

  // A slug that was renamed leaves an orphan directory behind, which the test
  // catches but which is easier to just not create.
  for (const entry of readdirSync(versusAppDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !configured.has(entry.name)) {
      rmSync(join(versusAppDir, entry.name), { recursive: true, force: true });
    }
  }

  const written: string[] = [];
  for (const page of VERSUS_PAGES) {
    const dir = join(versusAppDir, page.slug);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "page.tsx");
    writeFileSync(file, shimFor(page));
    written.push(file);
  }
  return written;
}

type Block = { file: string; begin: string; end: string };

/**
 * Rewrites the delimited region of a file in place. Both target files are
 * appended to by other work in the same tree, so we replace only what sits
 * between the markers and never reformat, reorder or reflow the rest.
 */
function replaceBlock(block: Block, body: string): void {
  const source = readFileSync(block.file, "utf8");
  const start = source.indexOf(block.begin);
  const finish = source.indexOf(block.end);
  if (start === -1 || finish === -1) {
    throw new Error(
      `${block.file} is missing the generated block markers. Expected "${block.begin}" and "${block.end}".`
    );
  }
  writeFileSync(
    block.file,
    `${source.slice(0, start + block.begin.length)}\n${body}\n${source.slice(finish)}`
  );
}

/**
 * llms.txt bullets. agent-surface.test.ts requires every page.tsx route to
 * appear here as a URL that ends where the route ends, with no exceptions
 * list, so a missing bullet is a red suite rather than a quiet gap.
 */
function writeLlmsTxt(): void {
  const bullets = [
    "- [All head-to-head comparisons](https://wraps.dev/versus): Two other vendors compared directly, with published prices and no pitch",
    ...VERSUS_PAGES.map((page) => {
      const title = `${VENDORS[page.a].name} vs ${VENDORS[page.b].name}`;
      return `- [${title}](https://wraps.dev/versus/${page.slug}): ${page.description}`;
    }),
  ].join("\n");

  replaceBlock({ file: llmsFile, begin: LLMS_BEGIN, end: LLMS_END }, bullets);
}

/** Matches the two-space indentation of the SEARCH_INTENT array literal. */
function intentEntry(route: string, intent: typeof VERSUS_HUB_SEARCH_INTENT) {
  const secondary = intent.secondaryQueries
    .map((query) => `      ${JSON.stringify(query)},`)
    .join("\n");
  return `  {
    route: ${JSON.stringify(route)},
    primaryQuery: ${JSON.stringify(intent.primaryQuery)},
    secondaryQueries: [
${secondary}
    ],
    audience: "stranger-with-problem",
    rationale:
      ${JSON.stringify(intent.rationale)},
  },`;
}

function writeSearchIntent(): void {
  const entries = [
    intentEntry("/versus", VERSUS_HUB_SEARCH_INTENT),
    ...VERSUS_PAGES.map((page) =>
      intentEntry(`/versus/${page.slug}`, page.search)
    ),
  ].join("\n");

  replaceBlock(
    { file: searchIntentFile, begin: INTENT_BEGIN, end: INTENT_END },
    entries
  );
}

/**
 * Hand-emitted TypeScript will not match biome's line breaking, and an
 * unformatted generated file reds `pnpm check`. Format what we wrote rather
 * than trying to predict the formatter — the same approach the page-dates
 * generator takes, minus the guesswork.
 */
function format(files: string[]): void {
  execFileSync(
    join(repoRoot, "node_modules/.bin/biome"),
    ["format", "--write", ...files],
    { cwd: repoRoot, stdio: "inherit" }
  );
}

const shims = writeShims();
writeLlmsTxt();
writeSearchIntent();
format([...shims, searchIntentFile]);

process.stdout.write(
  `versus: wrote ${shims.length} shims, ${VERSUS_PAGES.length + 1} llms.txt bullets, ${VERSUS_PAGES.length + 1} search-intent entries\n`
);
