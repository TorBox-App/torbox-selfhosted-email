import { toSafeRedirectPath } from "@/lib/utils";

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// Mirrors the post-auth target each form computes on the client, so an
// already-authenticated visitor is bounced before any HTML is sent
export function resolveRedirect(params: SearchParams) {
  if (first(params.mode) !== "signup") {
    return toSafeRedirectPath(first(params.redirect), "/");
  }

  const redirectTo = toSafeRedirectPath(first(params.redirect), "");
  if (
    redirectTo.startsWith("/invitations/") ||
    redirectTo.startsWith("/device")
  ) {
    return redirectTo;
  }

  const onboarding = new URLSearchParams();
  const plan = first(params.plan);
  if (plan) {
    onboarding.set("plan", plan);
  }
  onboarding.set("interval", first(params.interval) || "monthly");
  return `/onboarding?${onboarding.toString()}`;
}
