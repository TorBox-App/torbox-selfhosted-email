/**
 * Resolve the dashboard's public base URL for links embedded in emails.
 *
 * Reads the variables each deployment shape actually sets: Vercel and the SST
 * platform config set NEXT_PUBLIC_APP_URL, the self-hosted config additionally
 * sets BETTER_AUTH_URL on the web app and APP_BASE_URL on the queue workers.
 * Callers that read those vars directly (batch-sender, workflow-step-handlers)
 * are not routed through here yet.
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
