#!/usr/bin/env node
/**
 * grade-sweep — build the daily candidate queue for the grade-sweep agent.
 *
 *   node scripts/grade-sweep.mjs [--candidates N] [--concurrency N] [--json]
 *
 * Sources startup domains from Hacker News (headless, no auth, refreshes daily),
 * runs each through mail-audit, and emits a tiered queue.
 *
 *   tier1 — on SES (spf includes amazonses.com) AND grade C or worse
 *   tier2 — grade D or worse on any provider
 *
 * Measured yield 2026-09-15 over 15 live domains: 1 on SES (6.7%), 13 graded
 * C or worse (87%). Expect single digits of tier1 per run. That is the real
 * number; do not pad the queue to hit a target count.
 *
 * Emits JSON to stdout. Sends nothing. Contacts no one.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_CLI = join(ROOT, "packages/mail-audit/dist/cli.js");

const HN = "https://hn.algolia.com/api/v1";

// Hosts that are never a company's own sending domain.
const SKIP_HOSTS = new Set([
  "github.com",
  "gitlab.com",
  "raw.githubusercontent.com",
  "youtube.com",
  "youtu.be",
  "x.com",
  "twitter.com",
  "medium.com",
  "substack.com",
  "notion.site",
  "notion.so",
  "docs.google.com",
  "arxiv.org",
  "reddit.com",
  "news.ycombinator.com",
  "linkedin.com",
  "producthunt.com",
  "npmjs.com",
  "pypi.org",
  "crates.io",
  "vercel.app",
  "netlify.app",
  "herokuapp.com",
  "apple.com",
  "google.com",
  "microsoft.com",
  "amazon.com",
]);

const SKIP_SUFFIXES = [
  ".github.io",
  ".pages.dev",
  ".vercel.app",
  ".netlify.app",
  ".workers.dev",
];

function args() {
  const a = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = a.indexOf(flag);
    return i === -1 ? fallback : Number(a[i + 1]);
  };
  return {
    candidates: get("--candidates", 120),
    concurrency: get("--concurrency", 8),
    json: a.includes("--json"),
  };
}

function hostOf(url) {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (!h || SKIP_HOSTS.has(h)) return null;
    if (SKIP_SUFFIXES.some((s) => h.endsWith(s))) return null;
    // Strip a leading app./blog./docs. so the audit hits the org's root domain.
    const root = h.replace(/^(app|apps|blog|docs|engine|api|www2)\./, "");
    return SKIP_HOSTS.has(root) ? null : root;
  } catch {
    return null;
  }
}

async function hnStories(query, tags, pages) {
  const out = [];
  for (let p = 0; p < pages; p++) {
    const url = `${HN}/search_by_date?tags=${tags}&query=${encodeURIComponent(query)}&hitsPerPage=100&page=${p}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const body = await res.json();
    for (const hit of body.hits ?? []) {
      const host = hit.url ? hostOf(hit.url) : null;
      if (host)
        out.push({
          domain: host,
          why: `HN: ${(hit.title ?? "").slice(0, 70)}`,
          at: hit.created_at,
        });
    }
    if ((body.hits ?? []).length < 100) break;
  }
  return out;
}

/** Candidate domains from sources that work unattended. Quote every short query. */
async function sourceCandidates(limit) {
  const batches = await Promise.all([
    hnStories('"Show HN"', "story", 2),
    hnStories('"Launch HN"', "story", 1),
    hnStories('"aws ses"', "story", 1),
  ]);

  const seen = new Map();
  for (const item of batches.flat()) {
    if (!seen.has(item.domain)) seen.set(item.domain, item);
  }
  return [...seen.values()].slice(0, limit);
}

async function audit(domain) {
  try {
    const { stdout } = await exec(
      process.execPath,
      [
        AUDIT_CLI,
        domain,
        "--json",
        "--skip-blacklists",
        "--skip-tls",
        "--timeout",
        "8000",
      ],
      { timeout: 25_000, maxBuffer: 8 * 1024 * 1024 }
    );
    return JSON.parse(stdout);
  } catch (err) {
    // mail-audit exits non-zero by grade; the JSON is still on stdout.
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

// Deductions that describe a limit of the audit rather than a defect on their
// side. Never mailable: the recipient cannot act on them and they read as us
// not having done the work.
const NOT_ACTIONABLE = [/not verifiable/i, /send a test email/i, /unable to /i];

/** The two worst findings, worst-first, in the recipient's language. */
function worstFindings(report) {
  const deductions = (report?.score?.deductions ?? []).filter((d) => {
    const text = d.reason ?? d.message ?? d.label ?? "";
    return !NOT_ACTIONABLE.some((p) => p.test(text));
  });
  return [...deductions]
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 2)
    .map((d) => ({
      points: d.points,
      label: d.reason ?? d.message ?? d.label ?? "unspecified",
      check: d.check ?? d.category ?? null,
    }));
}

function classify(report) {
  const spf = report?.spf ?? {};
  const haystack = `${(spf.includes ?? []).join(" ")} ${spf.record ?? ""}`;
  const onSes = haystack.includes("amazonses");
  const grade = report?.score?.grade ?? "?";
  const bad = ["C", "D", "F"].includes(grade);
  const worse = ["D", "F"].includes(grade);

  if (onSes && bad) return "tier1";
  if (worse) return "tier2";
  return null;
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  const { candidates: want, concurrency, json } = args();

  if (!existsSync(AUDIT_CLI)) {
    console.error("mail-audit not built. Run: pnpm --filter mail-audit build");
    process.exit(1);
  }

  const candidates = await sourceCandidates(want);
  const reports = await mapLimit(candidates, concurrency, async (c) => {
    const report = await audit(c.domain);
    if (!report) return null;
    return {
      domain: c.domain,
      why: c.why,
      grade: report.score?.grade ?? "?",
      score: report.score?.score ?? null,
      onSes:
        `${(report.spf?.includes ?? []).join(" ")} ${report.spf?.record ?? ""}`.includes(
          "amazonses"
        ),
      spf: report.spf?.record ?? null,
      dmarc: report.dmarc?.record ?? null,
      findings: worstFindings(report),
      tier: classify(report),
    };
  });

  const audited = reports.filter(Boolean);
  const out = {
    sweptAt: new Date().toISOString(),
    candidates: candidates.length,
    audited: audited.length,
    tier1: audited.filter((r) => r.tier === "tier1"),
    tier2: audited.filter((r) => r.tier === "tier2"),
  };

  if (json) {
    process.stdout.write(JSON.stringify(out, null, 2));
    return;
  }

  console.log(`swept ${out.audited}/${out.candidates} candidates`);
  console.log(`tier1 (on SES, grade <= C): ${out.tier1.length}`);
  for (const r of out.tier1)
    console.log(
      `  ${r.domain.padEnd(28)} ${r.grade}  ${r.findings.map((f) => f.label).join(" | ")}`
    );
  console.log(`tier2 (grade <= D, any provider): ${out.tier2.length}`);
  for (const r of out.tier2.slice(0, 15))
    console.log(`  ${r.domain.padEnd(28)} ${r.grade}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
