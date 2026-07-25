/**
 * The deployment's own public URLs.
 *
 * A self-hosted deployment must advertise ITS endpoints, never the platform's:
 * the CLI reads `.well-known` to start the device flow, customers paste the SES
 * webhook endpoint into AWS, and generated API clients read the OpenAPI
 * `servers` list. Every one of those pointed at wraps.dev when it was
 * hardcoded, sending the customer's own traffic — including their API keys — to
 * a server that has never heard of them.
 *
 * Values arrive from .env.selfhost via infra/selfhost.config.ts, where a pasted
 * trailing slash is easy, so normalize once here: `${base}/api/auth/...` would
 * otherwise emit a double slash, which routes differently.
 */

const PLATFORM_API_URL = "https://api.wraps.dev";
const PLATFORM_APP_URL = "https://app.wraps.dev";

// SST injects "" before the first deploy pass has URLs to bake in, so treat an
// empty value as unset rather than building a bare path.
const resolve = (configured: string | undefined, fallback: string) =>
  (configured || fallback).replace(/\/+$/, "");

/** This API's own public base URL. */
export function resolveApiUrl(): string {
  return resolve(process.env.WRAPS_API_URL, PLATFORM_API_URL);
}

/** The dashboard's public base URL, which serves the better-auth endpoints. */
export function resolveAppUrl(): string {
  return resolve(process.env.NEXT_PUBLIC_APP_URL, PLATFORM_APP_URL);
}
