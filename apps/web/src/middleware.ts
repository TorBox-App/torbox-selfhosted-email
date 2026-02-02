import { type NextRequest, NextResponse } from "next/server";

const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const COOKIE_NAME = "wraps_attribution";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Check if any attribution params are present
  const hasUtm = UTM_PARAMS.some((p) => searchParams.has(p));
  const hasRef = searchParams.has("ref");

  if (!hasUtm && !hasRef) {
    return NextResponse.next();
  }

  // First-touch: don't overwrite existing attribution
  if (request.cookies.has(COOKIE_NAME)) {
    return NextResponse.next();
  }

  const attribution: Record<string, string> = {};

  for (const param of UTM_PARAMS) {
    const value = searchParams.get(param);
    if (value) {
      attribution[param] = value;
    }
  }

  const ref = searchParams.get("ref");
  if (ref) {
    attribution.ref = ref;
  }

  const referrer = request.headers.get("referer");
  if (referrer) {
    attribution.referrer = referrer;
  }

  attribution.landing_page = request.nextUrl.pathname;
  attribution.timestamp = new Date().toISOString();

  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, JSON.stringify(attribution), {
    maxAge: COOKIE_MAX_AGE,
    secure: true,
    sameSite: "lax",
    path: "/",
    // NOT httpOnly — needs client-side read for PostHog
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next (static files, image optimization)
     * - static assets (favicon, images, etc.)
     */
    "/((?!api|_next|.*\\..*).*)",
  ],
};
