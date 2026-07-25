import { auth } from "@wraps/auth";
import { db, ssoProvider } from "@wraps/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type SsoInitiateApi = {
  signInSSO(opts: {
    body: { providerId: string; callbackURL: string; loginHint?: string };
  }): Promise<{ url: string; redirect: boolean } | null>;
};

/**
 * Hostnames an IdP-initiated `target_link_uri` may point at.
 *
 * Hardcoding app.wraps.dev made a self-hosted deployment reject its own
 * callback and silently fall back to "/" — while the SSO settings page told the
 * customer to paste that very URI into their IdP. Derive it from the
 * deployment's own URL instead.
 *
 * Both remaining entries are development conveniences, and both are closed in
 * production for the same reason: they let something other than the
 * deployment's own configuration decide where a real SSO session may land.
 *
 * - The request's own host reflects whatever reached the app — harmless behind
 *   a proxy that pins Host, an open redirect behind one that forwards an
 *   attacker-supplied X-Forwarded-Host.
 * - localhost is a redirect to whatever listener is running on the victim's
 *   machine.
 *
 * Closing the host fallback in production costs nothing real: selfhost.config.ts
 * sets BETTER_AUTH_URL on the web app, so the unconfigured state only exists on
 * a first deploy pass whose database has no migrations yet — nobody can have
 * configured an IdP against it. An unconfigured production deployment
 * degrades to callbackURL "/", the same as an unparseable URI.
 */
function allowedRedirectHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  for (const candidate of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
  ]) {
    if (!candidate) {
      continue;
    }
    try {
      hosts.add(new URL(candidate).hostname);
    } catch {
      // Ignore an unparseable configured value; the others still apply.
    }
  }

  if (process.env.NODE_ENV === "production") {
    return hosts;
  }

  if (hosts.size === 0) {
    try {
      hosts.add(new URL(req.url).hostname);
    } catch {
      // Nothing to allow — every target_link_uri falls back to "/".
    }
  }
  hosts.add("localhost");
  return hosts;
}

function isSafeRedirectUri(uri: string, req: Request): boolean {
  try {
    return allowedRedirectHosts(req).has(new URL(uri).hostname);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const iss = searchParams.get("iss");
  const targetLinkUri = searchParams.get("target_link_uri");
  const loginHint = searchParams.get("login_hint");

  if (!iss) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const provider = await db.query.ssoProvider.findFirst({
    where: eq(ssoProvider.issuer, iss),
  });

  if (!provider?.domainVerified) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const callbackURL =
    targetLinkUri && isSafeRedirectUri(targetLinkUri, req)
      ? targetLinkUri
      : "/";

  try {
    const result = await (auth.api as unknown as SsoInitiateApi).signInSSO({
      body: {
        providerId: provider.providerId,
        callbackURL,
        ...(loginHint ? { loginHint } : {}),
      },
    });

    if (result?.url) {
      return NextResponse.redirect(result.url);
    }
  } catch (error) {
    logger.error({ err: error, iss }, "SSO initiate failed");
  }

  return NextResponse.redirect(new URL("/sign-in", req.url));
}
