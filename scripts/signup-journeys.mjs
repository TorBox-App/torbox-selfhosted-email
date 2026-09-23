#!/usr/bin/env node
// signup-journeys.mjs — every recent signup's pre-signup PostHog journey,
// plus a rollup of which sources, pages and CTAs precede signups.
//
// Usage:
//   pnpm analytics:signup-journeys [--days=N] [--json]
//   node scripts/signup-journeys.mjs [--days=N] [--json]
//
//   --days=N   Look back N days (1-365). Default 30.
//   --json     Print { days, summary, journeys } as JSON instead of Markdown.
//
// Requires POSTHOG_ADMIN_KEY (see ~/.localrc; `source ~/.localrc` first —
// shells do not auto-source it).
//
// The output prints customer email addresses. It is for local reading only —
// do not paste it into public channels or commit it.

export const INTERNAL_EMAIL = /(@wraps\.dev$|stewartjarod|jarod)/i;

const MAX_TRAIL_LENGTH = 40;
const CLICK_PAIR_WINDOW_MS = 2000;
const MS_PER_DAY = 86_400_000;

function parseTime(value) {
  return typeof value === "number" ? value : Date.parse(value);
}

/** Map a PostHog query response ({ columns, results }) to an array of row objects. */
export function toObjects(response) {
  if (
    !(
      response &&
      Array.isArray(response.columns) &&
      Array.isArray(response.results)
    )
  ) {
    throw new Error("PostHog response missing columns/results");
  }

  return response.results.map((row) =>
    Object.fromEntries(response.columns.map((col, i) => [col, row[i]]))
  );
}

/**
 * Build one journey per non-internal signup: the pre-signup PostHog trail,
 * the first touch, the attribution cookie recorded at signup, and the CTA
 * click (if any) that led to signup.
 */
export function buildJourneys(signups, events) {
  const eventsByPerson = new Map();
  for (const event of events) {
    const existing = eventsByPerson.get(event.person_id);
    if (existing) {
      existing.push(event);
    } else {
      eventsByPerson.set(event.person_id, [event]);
    }
  }

  const journeys = [];

  for (const signup of signups) {
    if (INTERNAL_EMAIL.test(signup.email ?? "")) {
      continue;
    }

    const signedUpMs = parseTime(signup.signed_up_at);
    const personEvents = (eventsByPerson.get(signup.person_id) ?? [])
      .filter((event) => parseTime(event.timestamp) < signedUpMs)
      .sort((a, b) => parseTime(a.timestamp) - parseTime(b.timestamp));

    const pageviews = personEvents.filter(
      (event) => event.event === "$pageview"
    );
    const noData = pageviews.length === 0;

    const firstTouch = noData
      ? null
      : {
          host: pageviews[0].host,
          pathname: pageviews[0].pathname,
          referringDomain: pageviews[0].referring_domain,
          utmSource: pageviews[0].utm_source,
        };

    const daysToSignup = noData
      ? null
      : Math.round(
          ((signedUpMs - parseTime(pageviews[0].timestamp)) / MS_PER_DAY) * 10
        ) / 10;

    const sessions = new Set(
      pageviews.map((event) => event.session_id).filter((id) => id != null)
    ).size;

    // Duration stitching: each pageview's dwell time is reported by the
    // *next* pageview or pageleave in the same session, as
    // prev_duration/prev_scroll about the page it just left. Consume each
    // candidate at most once so two pageviews of the same pathname don't
    // both claim the same later event.
    const stitchCandidates = personEvents.filter(
      (event) => event.event === "$pageview" || event.event === "$pageleave"
    );
    const usedForStitch = new Set();

    const trail = pageviews.slice(0, MAX_TRAIL_LENGTH).map((pageview) => {
      const pageviewMs = parseTime(pageview.timestamp);
      let seconds = null;
      let scroll = null;

      for (const candidate of stitchCandidates) {
        if (usedForStitch.has(candidate)) {
          continue;
        }
        if (parseTime(candidate.timestamp) <= pageviewMs) {
          continue;
        }
        if (candidate.session_id !== pageview.session_id) {
          continue;
        }
        if (candidate.prev_pathname !== pageview.pathname) {
          continue;
        }
        usedForStitch.add(candidate);
        seconds =
          candidate.prev_duration == null
            ? null
            : Math.round(candidate.prev_duration);
        scroll =
          candidate.prev_scroll == null
            ? null
            : Math.round(candidate.prev_scroll * 100) / 100;
        break;
      }

      return {
        host: pageview.host,
        pathname: pageview.pathname,
        seconds,
        scroll,
      };
    });

    const likelyReadSeen = new Set();
    const likelyRead = [];
    for (const entry of trail) {
      if (entry.host !== "wraps.dev") {
        continue;
      }
      if (!((entry.seconds ?? 0) >= 30 || (entry.scroll ?? 0) >= 0.5)) {
        continue;
      }
      if (likelyReadSeen.has(entry.pathname)) {
        continue;
      }
      likelyReadSeen.add(entry.pathname);
      likelyRead.push(entry.pathname);
    }

    // A signup click is either an autocapture on the app's signup link, or a
    // custom cta_click. When both fire together (the autocapture on the link
    // itself, plus a cta_click naming which page section it was in), prefer
    // the autocapture but carry the cta_click's location onto it.
    const clickCandidates = personEvents.filter(
      (event) =>
        (event.event === "$autocapture" &&
          typeof event.href === "string" &&
          event.href.includes("/auth") &&
          event.href.includes("mode=signup")) ||
        event.event === "cta_click"
    );

    let signupClick = null;
    if (clickCandidates.length > 0) {
      let primary = clickCandidates.at(-1);
      if (clickCandidates.length >= 2) {
        const secondLast = clickCandidates.at(-2);
        const gapMs = Math.abs(
          parseTime(primary.timestamp) - parseTime(secondLast.timestamp)
        );
        if (gapMs <= CLICK_PAIR_WINDOW_MS) {
          const autocapture = [primary, secondLast].find(
            (c) => c.event === "$autocapture"
          );
          const ctaClick = [primary, secondLast].find(
            (c) => c.event === "cta_click"
          );
          if (autocapture && ctaClick) {
            primary = { ...autocapture, location: ctaClick.location };
          }
        }
      }
      signupClick = {
        pathname: primary.pathname,
        text: primary.el_text ?? null,
        href: primary.href ?? null,
        location: primary.location ?? null,
      };
    }

    journeys.push({
      email: signup.email,
      method: signup.method,
      signedUpAt: signup.signed_up_at,
      firstTouch,
      cookie: {
        referrer: signup.cookie_referrer ?? null,
        landingPage: signup.cookie_landing ?? null,
        utmSource: signup.utm_source ?? null,
      },
      daysToSignup,
      sessions,
      trail,
      likelyRead,
      signupClick,
      noData,
    });
  }

  return journeys;
}

/** Roll journeys up into source, CTA and page-lift tables. */
export function summarize(journeys, pathVisitors, totalVisitors) {
  const withDataJourneys = journeys.filter((journey) => !journey.noData);
  const withData = withDataJourneys.length;

  const sourceCounts = new Map();
  for (const journey of journeys) {
    const key = journey.firstTouch?.referringDomain ?? "(no data)";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const sources = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const clickCounts = new Map();
  for (const journey of journeys) {
    if (!journey.signupClick) {
      continue;
    }
    const key = `${journey.signupClick.pathname} · ${
      journey.signupClick.text ?? journey.signupClick.location
    }`;
    clickCounts.set(key, (clickCounts.get(key) ?? 0) + 1);
  }
  const clicks = [...clickCounts.entries()]
    .map(([click, count]) => ({ click, count }))
    .sort((a, b) => b.count - a.count);

  const pageJourneyCounts = new Map();
  for (const journey of withDataJourneys) {
    const seenPathnames = new Set();
    for (const entry of journey.trail) {
      if (entry.host !== "wraps.dev") {
        continue;
      }
      if (seenPathnames.has(entry.pathname)) {
        continue;
      }
      seenPathnames.add(entry.pathname);
      pageJourneyCounts.set(
        entry.pathname,
        (pageJourneyCounts.get(entry.pathname) ?? 0) + 1
      );
    }
  }
  const visitorsByPath = new Map(
    pathVisitors.map((p) => [p.pathname, p.visitors])
  );
  const pages = [...pageJourneyCounts.entries()]
    .map(([pathname, signups]) => {
      const signupShare = withData > 0 ? signups / withData : 0;
      const visitors = visitorsByPath.get(pathname) ?? 0;
      const visitorShare = totalVisitors > 0 ? visitors / totalVisitors : 0;
      const lift = visitorShare > 0 ? signupShare / visitorShare : null;
      return { pathname, signups, signupShare, visitorShare, lift };
    })
    .filter((page) => page.signups >= 2)
    .sort((a, b) => b.signupShare - a.signupShare)
    .slice(0, 15);

  return { signups: journeys.length, withData, sources, clicks, pages };
}

function formatTrailEntry(entry) {
  const seconds = entry.seconds == null ? "?" : entry.seconds;
  const scroll = entry.scroll == null ? "?" : Math.round(entry.scroll * 100);
  return `${entry.pathname} (${seconds}s, ${scroll}% scroll)`;
}

/** Render the report as Markdown for stdout. */
export function renderMarkdown({ days, journeys, summary }) {
  const lines = [`# Signup journeys — last ${days} days`, ""];

  lines.push(
    `Signups: ${summary.signups} (${summary.withData} with browsing data)`
  );
  lines.push("");

  lines.push("## Sources");
  if (summary.sources.length === 0) {
    lines.push("(none)");
  } else {
    lines.push("| Source | Signups |");
    lines.push("|---|---|");
    for (const { source, count } of summary.sources) {
      lines.push(`| ${source} | ${count} |`);
    }
  }
  lines.push("");

  lines.push("## Signup-click CTAs");
  if (summary.clicks.length === 0) {
    lines.push("(none)");
  } else {
    lines.push("| CTA | Signups |");
    lines.push("|---|---|");
    for (const { click, count } of summary.clicks) {
      lines.push(`| ${click} | ${count} |`);
    }
  }
  lines.push("");

  lines.push("## Pages that precede signup");
  if (summary.pages.length === 0) {
    lines.push("(none)");
  } else {
    lines.push("| Page | Signup share | Visitor share | Lift |");
    lines.push("|---|---|---|---|");
    for (const page of summary.pages) {
      const lift = page.lift === null ? "—" : page.lift.toFixed(1);
      lines.push(
        `| ${page.pathname} | ${(page.signupShare * 100).toFixed(0)}% | ${(
          page.visitorShare * 100
        ).toFixed(0)}% | ${lift} |`
      );
    }
  }
  lines.push("");

  lines.push("## Signups");
  for (const journey of journeys) {
    lines.push("");
    lines.push(
      `### ${journey.email} — ${journey.signedUpAt} (${journey.method})`
    );

    if (journey.noData) {
      lines.push(
        "no pre-signup browsing recorded (ad blocker, or went straight to OAuth)"
      );
      continue;
    }

    lines.push(
      `First touch: ${
        journey.firstTouch
          ? `${journey.firstTouch.referringDomain ?? "direct"} → ${
              journey.firstTouch.pathname
            }`
          : "(none)"
      }`
    );
    lines.push(
      `Cookie: referrer=${journey.cookie.referrer ?? "(none)"} landing=${
        journey.cookie.landingPage ?? "(none)"
      }`
    );
    lines.push(`Days to signup: ${journey.daysToSignup ?? "(unknown)"}`);
    lines.push(`Sessions: ${journey.sessions}`);
    lines.push(
      `Signup click: ${
        journey.signupClick
          ? (journey.signupClick.text ??
            journey.signupClick.location ??
            journey.signupClick.pathname)
          : "(none)"
      }`
    );
    lines.push(
      `Likely read: ${
        journey.likelyRead.length ? journey.likelyRead.join(", ") : "(none)"
      }`
    );
    lines.push(`Trail: ${journey.trail.map(formatTrailEntry).join(" → ")}`);
  }

  return lines.join("\n");
}

function parseArgs(argv) {
  let days = 30;
  let json = false;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg.startsWith("--days=")) {
      const value = Number(arg.slice("--days=".length));
      if (!Number.isInteger(value) || value < 1 || value > 365) {
        printUsage();
        process.exit(2);
      }
      days = value;
    }
  }

  return { days, json };
}

function printUsage() {
  console.error(
    "Usage: node scripts/signup-journeys.mjs [--days=N] [--json]  (N is an integer 1-365, default 30)"
  );
}

async function hogql(sql) {
  const projectId = process.env.POSTHOG_PROJECT_ID || "252161";
  const host = process.env.POSTHOG_API_HOST || "https://us.posthog.com";

  let response;
  try {
    response = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.POSTHOG_ADMIN_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
    });
  } catch (error) {
    console.error(`PostHog unreachable: ${error.message}`);
    process.exit(1);
  }

  if (response.status === 401) {
    console.error("PostHog rejected the API key (401)");
    process.exit(1);
  }
  if (response.status === 403) {
    console.error(`API key lacks query:read on project ${projectId} (403)`);
    process.exit(1);
  }
  if (response.status === 429) {
    console.error("PostHog rate-limited the query (429); retry in a minute");
    process.exit(1);
  }
  if (!response.ok) {
    let detail;
    try {
      const body = await response.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    console.error(`PostHog query failed (${response.status}): ${detail}`);
    process.exit(1);
  }

  const body = await response.json();
  if (body.error) {
    console.error(`HogQL error: ${body.error}`);
    process.exit(1);
  }

  return toObjects(body);
}

const PERSON_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const EVENTS_CHUNK_SIZE = 100;

export async function run() {
  const { days, json } = parseArgs(process.argv.slice(2));

  if (!process.env.POSTHOG_ADMIN_KEY) {
    console.error("POSTHOG_ADMIN_KEY is not set. Run: source ~/.localrc");
    process.exit(2);
  }

  const signups = await hogql(`
    SELECT person_id, min(timestamp) AS signed_up_at, any(properties.email) AS email,
           any(properties.method) AS method, any(properties.referrer) AS cookie_referrer,
           any(properties.landing_page) AS cookie_landing, any(properties.utm_source) AS utm_source
    FROM events
    WHERE event = 'user_signed_up' AND properties.$lib = 'posthog-node'
      AND timestamp > now() - INTERVAL ${days} DAY
    GROUP BY person_id ORDER BY signed_up_at DESC LIMIT 1000
  `);

  const validPersonIds = signups
    .map((s) => s.person_id)
    .filter((id) => PERSON_ID_PATTERN.test(id));

  const events = [];
  for (let i = 0; i < validPersonIds.length; i += EVENTS_CHUNK_SIZE) {
    const chunk = validPersonIds.slice(i, i + EVENTS_CHUNK_SIZE);
    const idList = chunk.map((id) => `'${id}'`).join(", ");
    const rows = await hogql(`
      SELECT person_id, timestamp, event, properties.$host AS host, properties.$pathname AS pathname,
             properties.$referring_domain AS referring_domain, properties.utm_source AS utm_source,
             properties.$session_id AS session_id, properties.$prev_pageview_pathname AS prev_pathname,
             properties.$prev_pageview_duration AS prev_duration,
             properties.$prev_pageview_max_scroll_percentage AS prev_scroll,
             elements_chain_href AS href, properties.$el_text AS el_text, properties.location AS location
      FROM events
      WHERE person_id IN (${idList})
        AND timestamp > now() - INTERVAL ${days + 90} DAY
        AND properties.$host NOT LIKE '%localhost%'
        AND (event IN ('$pageview', '$pageleave', 'cta_click')
             OR (event = '$autocapture' AND elements_chain_href LIKE '%app.wraps.dev/auth%'))
      ORDER BY timestamp LIMIT 50000
    `);
    events.push(...rows);
  }

  const pathVisitors = await hogql(`
    SELECT properties.$pathname AS pathname, count(DISTINCT person_id) AS visitors
    FROM events WHERE event = '$pageview' AND properties.$host = 'wraps.dev'
      AND timestamp > now() - INTERVAL ${days} DAY
    GROUP BY pathname ORDER BY visitors DESC LIMIT 2000
  `);

  const totalVisitorsRows = await hogql(`
    SELECT count(DISTINCT person_id) AS total
    FROM events WHERE event = '$pageview' AND properties.$host = 'wraps.dev'
      AND timestamp > now() - INTERVAL ${days} DAY
    LIMIT 1
  `);
  const totalVisitors = Number(totalVisitorsRows[0]?.total ?? 0);

  const journeys = buildJourneys(signups, events);
  const summary = summarize(journeys, pathVisitors, totalVisitors);

  if (json) {
    console.log(JSON.stringify({ days, summary, journeys }, null, 2));
  } else {
    console.log(renderMarkdown({ days, journeys, summary }));
  }
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop())
) {
  run();
}
