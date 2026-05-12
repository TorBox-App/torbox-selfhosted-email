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

const APP_HOSTNAME = "app.wraps.dev";

function isSafeRedirectUri(uri: string): boolean {
  try {
    const { hostname } = new URL(uri);
    return hostname === APP_HOSTNAME || hostname === "localhost";
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
    targetLinkUri && isSafeRedirectUri(targetLinkUri) ? targetLinkUri : "/";

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
