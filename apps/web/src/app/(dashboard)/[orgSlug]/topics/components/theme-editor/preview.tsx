"use client";

import { PreferenceCenterShell } from "@/components/preference-center/shell";
import type { PreviewMode, PreviewState, PreviewWidth } from "./toolbar";
import type { ThemeDraft } from "./use-theme-draft";

const SAMPLE_TOPICS = [
  {
    id: "product-updates",
    name: "Product Updates",
    description: "New features and improvements.",
  },
  {
    id: "weekly-digest",
    name: "Weekly Newsletter and Community Digest with Highlights",
    description: null,
  },
  {
    id: "marketing",
    name: "Marketing",
    description:
      "Promotional offers, discounts, and marketing communications about our products and services that you might find interesting.",
  },
  {
    id: "security-alerts",
    name: "Security Alerts",
    description: null,
  },
];

type PreviewProps = {
  theme: ThemeDraft;
  previewState: PreviewState;
  previewMode: PreviewMode;
  previewWidth: PreviewWidth;
  orgName: string;
  logo?: string | null;
  title: string;
  description: string;
};

export function Preview({
  theme,
  previewState,
  previewMode,
  previewWidth,
  orgName,
  logo,
  title,
  description,
}: PreviewProps) {
  // Forced to the toggled mode, NEVER the draft's stored colorScheme. With
  // "system" the serializer would emit `.dark [data-wraps-theme="pc-preview"]`,
  // and the DASHBOARD's own <html> carries .dark whenever the operator is in
  // dark mode — the preview would then show dark tokens regardless of the
  // toggle. Forcing the mode makes the serializer emit the chosen map under
  // the base selector, immune to the host page's .dark and independent of
  // what actually gets published (draft.colorScheme, unaffected here).
  const previewTheme: ThemeDraft = { ...theme, colorScheme: previewMode };

  return (
    <div className="rounded-xl border bg-muted/30 p-6">
      <div className="mb-4 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-muted-foreground text-xs">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span className="ml-2 font-mono">app.wraps.dev/preferences/...</span>
      </div>

      <div className="mx-auto max-h-[720px] overflow-y-auto rounded-lg border bg-background">
        <div
          className={
            previewWidth === "mobile"
              ? "mx-auto w-[390px]"
              : "mx-auto max-w-2xl"
          }
        >
          <div className="pointer-events-none">
            <PreferenceCenterShell
              description={description}
              logo={logo}
              orgName={orgName}
              scopeId="pc-preview"
              theme={previewTheme}
              title={title}
            >
              <PreviewBody state={previewState} />
            </PreferenceCenterShell>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBody({ state }: { state: PreviewState }) {
  if (state === "unsubscribed") {
    return <UnsubscribedBody />;
  }
  if (state === "pending") {
    return <DefaultBody pendingTopicId="product-updates" />;
  }
  return <DefaultBody showSuccessBanner />;
}

function UnsubscribedBody() {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <svg
          className="h-8 w-8 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </svg>
      </div>
      <h2 className="mb-2 font-semibold text-foreground text-lg">
        You're Unsubscribed
      </h2>
      <p className="text-muted-foreground text-sm">
        You won't receive any more emails.
      </p>
    </div>
  );
}

function DefaultBody({
  pendingTopicId,
  showSuccessBanner,
}: {
  pendingTopicId?: string;
  showSuccessBanner?: boolean;
}) {
  return (
    <div className="space-y-6">
      {showSuccessBanner && (
        <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4 text-success">
          <svg
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
          <span className="text-sm">Your preferences have been saved.</span>
        </div>
      )}

      <div className="space-y-1">
        <h2 className="mb-3 font-medium text-foreground text-sm">
          Email Topics
        </h2>
        <div className="divide-y divide-border rounded-xl border border-border">
          {SAMPLE_TOPICS.map((topic, index) => {
            const isPending = topic.id === pendingTopicId;
            const isChecked = index !== 1;

            return (
              <div className="p-4" key={topic.id}>
                <div className="flex cursor-default items-start gap-4">
                  <div className="relative flex h-5 items-center">
                    <input
                      checked={isChecked}
                      className={`peer h-4 w-4 cursor-default appearance-none rounded border-2 border-input ${
                        isChecked
                          ? isPending
                            ? "bg-warning"
                            : "bg-primary"
                          : ""
                      }`}
                      disabled
                      readOnly
                      type="checkbox"
                    />
                    {isChecked && (
                      <svg
                        className={`pointer-events-none absolute left-0 h-4 w-4 ${
                          isPending
                            ? "text-warning-foreground"
                            : "text-primary-foreground"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        viewBox="0 0 24 24"
                      >
                        {isPending ? (
                          <path
                            d="M12 8v4m0 4h.01"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : (
                          <path
                            d="M5 13l4 4L19 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">
                        {topic.name}
                      </span>
                      {isPending && (
                        <span className="rounded-full bg-warning/20 px-2 py-0.5 font-medium text-foreground text-xs">
                          Pending confirmation
                        </span>
                      )}
                    </div>
                    {topic.description && (
                      <div className="mt-0.5 text-muted-foreground text-sm">
                        {topic.description}
                      </div>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div className="mt-2 ml-9">
                    <button
                      className="rounded-md px-3 py-1.5 font-medium text-warning text-xs"
                      disabled
                      type="button"
                    >
                      Resend confirmation email
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="mb-3 font-medium text-foreground text-sm">
          Preferred Channel
        </h2>
        <p className="mb-3 text-muted-foreground text-xs">
          Choose how you'd prefer to be contacted.
        </p>
        <div className="divide-y divide-border rounded-xl border border-border">
          {[
            { label: "No preference", checked: false },
            { label: "Email", checked: true },
            { label: "SMS", checked: false },
          ].map((option) => (
            <div className="flex items-center gap-4 p-4" key={option.label}>
              <div className="relative flex h-5 items-center">
                <input
                  checked={option.checked}
                  className={`h-4 w-4 appearance-none rounded-full border-2 border-input ${
                    option.checked ? "bg-primary" : ""
                  }`}
                  disabled
                  readOnly
                  type="radio"
                />
                {option.checked && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  </div>
                )}
              </div>
              <span className="font-medium text-foreground text-sm">
                {option.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <button
          className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground text-sm"
          disabled
          type="button"
        >
          Save Preferences
        </button>
        <button
          className="w-full rounded-xl border border-border bg-card px-4 py-3 font-medium text-muted-foreground text-sm"
          disabled
          type="button"
        >
          Unsubscribe from All
        </button>
      </div>
    </div>
  );
}
