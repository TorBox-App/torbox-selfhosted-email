import { describe, expect, it } from "vitest";
import {
  buildJourneys,
  renderMarkdown,
  summarize,
  toObjects,
} from "../signup-journeys.mjs";

function pageview(overrides) {
  return {
    person_id: "p1",
    timestamp: "2026-09-20T00:00:00.000Z",
    event: "$pageview",
    host: "wraps.dev",
    pathname: "/",
    referring_domain: null,
    utm_source: null,
    session_id: "s1",
    prev_pathname: null,
    prev_duration: null,
    prev_scroll: null,
    href: null,
    el_text: null,
    location: null,
    ...overrides,
  };
}

function signup(overrides) {
  return {
    person_id: "p1",
    signed_up_at: "2026-09-20T01:00:00.000Z",
    email: "ada@example.com",
    method: "email",
    cookie_referrer: null,
    cookie_landing: null,
    utm_source: null,
    ...overrides,
  };
}

describe("toObjects", () => {
  it("maps columns to keys", () => {
    const response = {
      columns: ["a", "b"],
      results: [
        [1, 2],
        [3, 4],
      ],
    };

    expect(toObjects(response)).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
  });

  it("throws on a response without columns", () => {
    expect(() => toObjects({ results: [] })).toThrow(
      "PostHog response missing columns/results"
    );
  });
});

describe("buildJourneys — internal signups", () => {
  it("drops an internal signup", () => {
    const journeys = buildJourneys([signup({ email: "jarod@wraps.dev" })], []);

    expect(journeys).toHaveLength(0);
  });
});

describe("buildJourneys — pre-signup window", () => {
  it("ignores events at or after signed_up_at", () => {
    const signedUpAt = "2026-09-20T00:00:00.000Z";
    const events = [
      pageview({
        timestamp: "2026-09-20T00:00:01.000Z",
        pathname: "/late",
      }),
    ];

    const [journey] = buildJourneys(
      [signup({ signed_up_at: signedUpAt })],
      events
    );

    expect(journey.trail).toEqual([]);
    expect(journey.noData).toBe(true);
  });
});

describe("buildJourneys — duration stitching", () => {
  it("stitches duration from the next pageview in the same session", () => {
    const events = [
      pageview({
        timestamp: "2026-09-20T00:00:00.000Z",
        pathname: "/",
        session_id: "s1",
      }),
      pageview({
        timestamp: "2026-09-20T00:01:40.000Z",
        pathname: "/tools/ses-calculator",
        session_id: "s1",
        prev_pathname: "/",
        prev_duration: 99.7,
        prev_scroll: 0.82,
      }),
    ];

    const [journey] = buildJourneys([signup({})], events);

    expect(journey.trail[0]).toMatchObject({
      pathname: "/",
      seconds: 100,
      scroll: 0.82,
    });
  });

  it("does not stitch the same event across a different session", () => {
    const events = [
      pageview({
        timestamp: "2026-09-20T00:00:00.000Z",
        pathname: "/",
        session_id: "s1",
      }),
      pageview({
        timestamp: "2026-09-20T00:01:40.000Z",
        pathname: "/tools/ses-calculator",
        session_id: "s2",
        prev_pathname: "/",
        prev_duration: 99.7,
        prev_scroll: 0.82,
      }),
    ];

    const [journey] = buildJourneys([signup({})], events);

    expect(journey.trail[0]).toMatchObject({
      pathname: "/",
      seconds: null,
      scroll: null,
    });
  });
});

describe("buildJourneys — likelyRead", () => {
  it("includes long-dwell or deep-scroll wraps.dev pages, excludes shallow visits and app.wraps.dev", () => {
    const events = [
      pageview({
        timestamp: "2026-09-20T00:00:00.000Z",
        pathname: "/long",
        session_id: "s1",
      }),
      pageview({
        timestamp: "2026-09-20T00:00:45.000Z",
        pathname: "/deep-scroll",
        session_id: "s1",
        prev_pathname: "/long",
        prev_duration: 45,
        prev_scroll: 0.1,
      }),
      pageview({
        timestamp: "2026-09-20T00:00:50.000Z",
        pathname: "/shallow",
        session_id: "s1",
        prev_pathname: "/deep-scroll",
        prev_duration: 5,
        prev_scroll: 0.9,
      }),
      pageview({
        timestamp: "2026-09-20T00:00:55.000Z",
        host: "app.wraps.dev",
        pathname: "/auth",
        session_id: "s1",
        prev_pathname: "/shallow",
        prev_duration: 5,
        prev_scroll: 0.1,
      }),
      pageview({
        timestamp: "2026-09-20T00:01:00.000Z",
        host: "app.wraps.dev",
        pathname: "/onboarding",
        session_id: "s1",
        prev_pathname: "/auth",
        prev_duration: 999,
        prev_scroll: 1,
      }),
    ];

    const [journey] = buildJourneys([signup({})], events);

    expect(journey.likelyRead).toEqual(["/long", "/deep-scroll"]);
  });
});

describe("buildJourneys — signup click", () => {
  it("prefers the autocapture and merges the nearby cta_click's location", () => {
    const events = [
      pageview({
        timestamp: "2026-09-20T00:59:00.000Z",
        event: "$autocapture",
        pathname: "/pricing",
        href: "https://app.wraps.dev/auth?mode=signup&plan=free",
        el_text: "Get Started",
      }),
      pageview({
        timestamp: "2026-09-20T00:59:01.000Z",
        event: "cta_click",
        pathname: "/pricing",
        location: "hero",
      }),
    ];

    const [journey] = buildJourneys([signup({})], events);

    expect(journey.signupClick).toMatchObject({
      text: "Get Started",
      location: "hero",
    });
  });

  it("does not treat a sign-in autocapture as a signup click", () => {
    const events = [
      pageview({
        timestamp: "2026-09-20T00:59:00.000Z",
        event: "$autocapture",
        pathname: "/pricing",
        href: "https://app.wraps.dev/auth?mode=signin",
        el_text: "Sign In",
      }),
    ];

    const [journey] = buildJourneys([signup({})], events);

    expect(journey.signupClick).toBeNull();
  });
});

describe("buildJourneys — noData", () => {
  it("flags a signup with no pre-signup pageviews", () => {
    const [journey] = buildJourneys([signup({})], []);

    expect(journey.noData).toBe(true);
    expect(journey.firstTouch).toBeNull();
    expect(journey.daysToSignup).toBeNull();
  });
});

describe("summarize", () => {
  it("computes signupShare, visitorShare and lift, excluding pages seen by only one journey", () => {
    const journeys = [
      {
        noData: false,
        firstTouch: { referringDomain: "google" },
        signupClick: null,
        trail: [
          { host: "wraps.dev", pathname: "/tools/ses-calculator" },
          { host: "wraps.dev", pathname: "/pricing" },
        ],
      },
      {
        noData: false,
        firstTouch: { referringDomain: "google" },
        signupClick: null,
        trail: [{ host: "wraps.dev", pathname: "/tools/ses-calculator" }],
      },
    ];
    const pathVisitors = [
      { pathname: "/tools/ses-calculator", visitors: 10 },
      { pathname: "/pricing", visitors: 3 },
    ];

    const summary = summarize(journeys, pathVisitors, 100);

    expect(
      summary.pages.find((p) => p.pathname === "/tools/ses-calculator")
    ).toMatchObject({ signupShare: 1, visitorShare: 0.1, lift: 10 });
    expect(
      summary.pages.find((p) => p.pathname === "/pricing")
    ).toBeUndefined();
  });
});

describe("renderMarkdown", () => {
  it("renders the header and the arrow-joined trail for a journey", () => {
    const summary = {
      signups: 1,
      withData: 1,
      sources: [],
      clicks: [],
      pages: [],
    };
    const journeys = [
      {
        email: "ada@example.com",
        method: "email",
        signedUpAt: "2026-09-20T01:00:00.000Z",
        firstTouch: {
          host: "wraps.dev",
          pathname: "/",
          referringDomain: "google",
          utmSource: null,
        },
        cookie: {
          referrer: "https://www.google.com/",
          landingPage: "/",
          utmSource: null,
        },
        daysToSignup: 1.2,
        sessions: 1,
        trail: [
          { host: "wraps.dev", pathname: "/", seconds: 30, scroll: 0.4 },
          { host: "wraps.dev", pathname: "/pricing", seconds: 60, scroll: 0.9 },
        ],
        likelyRead: ["/pricing"],
        signupClick: {
          pathname: "/pricing",
          text: "Get Started",
          href: "https://app.wraps.dev/auth?mode=signup",
          location: null,
        },
        noData: false,
      },
    ];

    const output = renderMarkdown({ days: 30, journeys, summary });

    expect(output).toContain("# Signup journeys — last 30 days");
    expect(output).toContain(
      "/ (30s, 40% scroll) → /pricing (60s, 90% scroll)"
    );
  });
});
