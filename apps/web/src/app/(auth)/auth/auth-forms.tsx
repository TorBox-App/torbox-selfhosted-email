"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { toast } from "sonner";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

const authModes = ["signin", "signup"] as const;

// Codes arriving via `?error=` on redirects from better-auth
// (onAPIError.errorURL points here). The SSO callback forwards its codes raw
// — including ones with spaces — while better-auth's own /error endpoint
// sends sanitized ones like UNKNOWN.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "account not linked":
    "Sign-in succeeded at your identity provider, but the account couldn't be linked to your existing Wraps account. Ask your organization admin to verify the SSO domain in Settings → SSO & SCIM, then try again.",
  "unable to link account":
    "Sign-in succeeded at your identity provider, but linking it to your Wraps account failed. Please try again or contact your administrator.",
  "signup disabled":
    "Sign-ups via SSO are disabled for this organization. Ask your administrator to invite or provision your account first.",
  invalid_provider:
    "Your identity provider returned an unexpected response. Check the SSO provider configuration in Settings → SSO & SCIM.",
  discovery_failed:
    "Your identity provider's OIDC configuration could not be fetched. Check the issuer URL in Settings → SSO & SCIM.",
  invalid_state:
    "The sign-in attempt expired or was tampered with. Please try again.",
  access_denied: "Sign-in was cancelled at your identity provider.",
};

function AuthErrorToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const description = searchParams.get("error_description");

  useEffect(() => {
    if (!error) {
      return;
    }
    const message =
      AUTH_ERROR_MESSAGES[error] ??
      `Sign-in failed${error === "UNKNOWN" ? "" : ` (${error})`}. Please try again.`;
    toast.error(message, {
      description: description ?? undefined,
      duration: 10_000,
    });
    // Strip the params so a refresh or in-page navigation doesn't re-toast.
    const params = new URLSearchParams(searchParams);
    params.delete("error");
    params.delete("error_description");
    router.replace(params.size > 0 ? `/auth?${params}` : "/auth");
  }, [error, description, searchParams, router]);

  return null;
}

export default function AuthForms() {
  const [mode, setMode] = useQueryState(
    "mode",
    parseAsStringLiteral(authModes).withDefault("signin")
  );

  return (
    <>
      <AuthErrorToast />
      {mode === "signin" ? (
        <SignInForm onSwitchToSignUp={() => setMode("signup")} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setMode("signin")} />
      )}
    </>
  );
}
