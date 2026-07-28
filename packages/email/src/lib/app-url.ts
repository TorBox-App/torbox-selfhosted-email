/**
 * Resolve the dashboard's public base URL for links embedded in emails.
 *
 * Reads the variables each deployment shape actually sets: Vercel and the SST
 * platform config set NEXT_PUBLIC_APP_URL, the self-hosted config additionally
 * sets BETTER_AUTH_URL on the web app and APP_BASE_URL on the queue workers.
 *
 * Every recipient-facing caller is routed through here. Three non-recipient
 * callers still read NEXT_PUBLIC_APP_URL directly, each deliberately:
 * stripe-webhooks.ts builds a billing link on a path self-host never reaches
 * (no Stripe); organization-settings-sso.tsx's constant is inlined at build
 * time, so it needs the build environment to be right rather than a runtime
 * resolver; event-limit.ts's upgrade URL becomes unreachable on a licensed
 * self-host once the license-key work lands, at which point delete it rather
 * than resolve it.
 *
 * Not to be confused with the resolveAppUrl in apps/api/src/lib/urls.ts, which
 * DOES fall back to the platform on purpose — it advertises service-discovery
 * endpoints, where a platform default is the right answer for a platform
 * deployment. Do not unify the two. Its sibling for the API half of an
 * unsubscribe link is resolveApiBaseUrl in @wraps/unsubscribe-token.
 *
 * Deliberately has no default. A hardcoded fallback to the Wraps platform sent
 * self-hosted customers' recipients to app.wraps.dev, where their token means
 * nothing — failing the send is the lesser harm, and it names the fix.
 */
export function resolveAppUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.APP_BASE_URL;

  if (!configured) {
    throw new Error(
      "Cannot build an email link: none of NEXT_PUBLIC_APP_URL, BETTER_AUTH_URL or APP_BASE_URL is set. Set the dashboard's public URL in the environment (apps/web/.env.local for local development)."
    );
  }

  return configured.replace(/\/+$/, "");
}
