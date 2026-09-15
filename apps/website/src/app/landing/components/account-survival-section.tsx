import type * as React from "react";
import { SectionKicker } from "./section-kicker";

/*
 * A faithful still of the dashboard's account survival card.
 *
 * The numbers below are AWS's, not ours: SES starts a manual review at a 5%
 * bounce rate and pauses sending at 10%; the complaint lines are 0.1% and
 * 0.5%. They mirror SES_THRESHOLDS in apps/api/src/lib/ses-health.ts, which is
 * the source of truth and what the hourly sweep classifies with. If AWS moves
 * a line, it moves there first.
 *
 * The rates themselves are an example, and the caption says so. The point of
 * the figure is the two tick marks, not the reading — a 4.1% bounce rate means
 * nothing on its own and everything next to "AWS reviews at 5%".
 */

const SCALE_HEADROOM = 1.25;

/** Lays a rate out against its review and pause lines, as the dashboard does. */
function geometry(value: number, review: number, pause: number) {
  const scaleMax = pause * SCALE_HEADROOM;
  const pct = (n: number) => Math.min(100, Math.max(0, (n / scaleMax) * 100));

  let level: "ok" | "review" | "pause" = "ok";
  if (value >= pause) {
    level = "pause";
  } else if (value >= review) {
    level = "review";
  }

  return {
    valuePct: pct(value),
    reviewPct: pct(review),
    pausePct: pct(pause),
    level,
  } as const;
}

type Level = ReturnType<typeof geometry>["level"];

const FILL: Record<Level, string> = {
  ok: "bg-foreground",
  review: "bg-warning",
  pause: "bg-destructive",
};

const TEXT: Record<Level, string> = {
  ok: "text-foreground",
  review: "text-warning",
  pause: "text-destructive",
};

function Meter({
  label,
  display,
  value,
  review,
  pause,
  note,
}: {
  label: string;
  display: string;
  value: number;
  review: number;
  pause: number;
  note: string;
}) {
  const { valuePct, reviewPct, pausePct, level } = geometry(
    value,
    review,
    pause
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`font-mono font-semibold text-2xl tabular-nums tracking-tight ${TEXT[level]}`}
      >
        {display}
      </p>
      <div className="relative h-1.5 w-full rounded-full bg-muted">
        <div
          className={`h-full w-(--value) rounded-full ${FILL[level]}`}
          style={{ "--value": `${valuePct}%` } as React.CSSProperties}
        />
        {/* AWS's two lines. These are the component. */}
        <span
          aria-hidden="true"
          className="absolute top-[-3px] left-(--review) h-[12px] w-px bg-muted-foreground/60"
          style={{ "--review": `${reviewPct}%` } as React.CSSProperties}
        />
        <span
          aria-hidden="true"
          className="absolute top-[-3px] left-(--pause) h-[12px] w-px bg-muted-foreground"
          style={{ "--pause": `${pausePct}%` } as React.CSSProperties}
        />
      </div>
      <p className="text-2xs text-muted-foreground leading-normal">{note}</p>
    </div>
  );
}

const QUOTA_SENT = 38_200;
const QUOTA_MAX = 50_000;
const QUOTA_WARN_RATIO = 0.8;

function QuotaMeter() {
  const ratio = QUOTA_SENT / QUOTA_MAX;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">24h quota</p>
      <p className="font-mono font-semibold text-2xl text-foreground tabular-nums tracking-tight">
        {QUOTA_SENT.toLocaleString("en-US")}
        <span className="ml-1 font-normal text-sm text-muted-foreground">
          / {QUOTA_MAX.toLocaleString("en-US")}
        </span>
      </p>
      <div className="relative h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-full w-(--ratio) rounded-full bg-foreground"
          style={{ "--ratio": `${ratio * 100}%` } as React.CSSProperties}
        />
        <span
          aria-hidden="true"
          className="absolute top-[-3px] left-(--warn) h-[12px] w-px bg-muted-foreground"
          style={
            { "--warn": `${QUOTA_WARN_RATIO * 100}%` } as React.CSSProperties
          }
        />
      </div>
      <p className="text-2xs text-muted-foreground leading-normal">
        Warns at 80% of the send quota AWS grants the account.
      </p>
    </div>
  );
}

export function AccountSurvivalSection() {
  return (
    <section className="border-border border-b py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div>
            <SectionKicker>The control plane</SectionKicker>
            <h2 className="max-w-[20ch] font-heading font-semibold text-3xl text-foreground leading-none tracking-tight md:text-4xl">
              Staying on top of it, without opening the AWS console.
            </h2>
            <p className="mt-5 max-w-[48ch] text-base text-muted-foreground leading-relaxed">
              Most teams pick a hosted API because they do not want to deal with
              any of this. Fair. So we made dealing with it the easy part:
              Amazon can put an account under review once its bounce rate passes
              5% and pause sending at 10%, and the console will not draw your
              rates against those lines — the control plane does, swept hourly,
              with owners and admins notified when one is crossed.
            </p>
            <p className="mt-4 max-w-[48ch] text-base text-muted-foreground leading-relaxed">
              Same surface for the rest of the daily job: suppression you can
              browse and clear, deliverability and blacklist audits, and a
              per-message event log. Bounces and complaints are suppressed on
              the way in, so the rates have a floor under them and not only a
              gauge over them.
            </p>
          </div>

          {/* The card */}
          <figure className="m-0 lg:justify-self-end lg:pt-10">
            <div className="rounded-lg border border-border bg-background p-6 md:p-7">
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <h3 className="mr-auto font-semibold text-base text-foreground">
                  Account survival
                </h3>
                <span className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-2xs text-warning uppercase tracking-widest">
                  Under review
                </span>
              </div>

              <div className="grid gap-7 sm:grid-cols-3">
                <Meter
                  display="4.1%"
                  label="Bounce rate"
                  note="AWS reviews at 5%, pauses at 10%."
                  pause={10}
                  review={5}
                  value={4.1}
                />
                <Meter
                  display="0.12%"
                  label="Complaint rate"
                  note="Over AWS's 0.1% review line."
                  pause={0.5}
                  review={0.1}
                  value={0.12}
                />
                <QuotaMeter />
              </div>
            </div>
            <figcaption className="mt-3 text-xs text-muted-foreground leading-normal">
              The dashboard's account survival card. Rates shown are an example;
              the thresholds are AWS's own.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
