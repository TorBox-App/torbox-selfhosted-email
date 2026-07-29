import type { PreferenceCenterTheme } from "@wraps/db";
import type { ReactNode } from "react";
import { getPreferenceFont } from "@/lib/preference-theme/fonts";
import { themeToScopedCss } from "@/lib/preference-theme/serialize";

const SCOPE_ID_PATTERN = /^[a-z0-9-]+$/;

type PreferenceCenterShellProps = {
  theme: PreferenceCenterTheme;
  scopeId?: string;
  orgName?: string | null;
  logo?: string | null;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
};

/**
 * Pure presentational, server-safe chrome for the public preference center.
 * No "use client", no data fetching, no server actions — this seam lets
 * plan 154's dashboard editor render the real chrome for a live preview
 * without an iframe (next.config.ts sets X-Frame-Options: DENY, which blocks
 * even same-origin framing).
 */
export function PreferenceCenterShell({
  theme,
  scopeId = "pc",
  orgName,
  logo,
  title,
  description,
  children,
}: PreferenceCenterShellProps) {
  if (!SCOPE_ID_PATTERN.test(scopeId)) {
    throw new Error(`Invalid preference center scope id: ${scopeId}`);
  }

  const bodyFont = getPreferenceFont(theme.fonts.body);
  const headingFont = getPreferenceFont(theme.fonts.heading);
  const css = themeToScopedCss(theme, `[data-wraps-theme="${scopeId}"]`);

  return (
    <>
      {/* React 19 renders string children of <style> correctly — no need
          for the "dangerous HTML" escape hatch here. themeToScopedCss
          re-validates every value against the token grammar (rejects
          <, >, {, }, ;, @) before this string is ever built, so it is
          safe regardless of storage. */}
      <style>{css}</style>
      <div
        className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
        data-wraps-theme={scopeId}
        style={bodyFont ? { fontFamily: bodyFont.fontFamily } : undefined}
      >
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            {logo ? (
              <img
                alt={orgName || "Company logo"}
                className="mx-auto mb-6 h-12 w-auto"
                src={logo}
              />
            ) : orgName ? (
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-semibold text-lg text-primary-foreground">
                {orgName.charAt(0).toUpperCase()}
              </div>
            ) : null}

            <h1
              className="mb-2 font-semibold text-2xl text-foreground tracking-tight"
              style={
                headingFont ? { fontFamily: headingFont.fontFamily } : undefined
              }
            >
              {title}
            </h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>

          <div className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
            {children}
          </div>

          <p className="mt-6 text-center text-muted-foreground text-xs">
            You can update your preferences anytime using the link in our
            emails.
          </p>
        </div>
      </div>
    </>
  );
}
