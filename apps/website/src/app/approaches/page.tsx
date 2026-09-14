import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { SectionKicker } from "@/app/landing/components/section-kicker";
import { APPROACHES, APPROACHES_RUBRIC } from "@/config/approaches";

export const metadata: Metadata = {
  title: "The four ways to send application email — a rubric",
  description:
    "Run SES yourself, rent a sending API, rent a marketing platform, or self-host an open-source wrapper. What each one is good at, what it costs you, and who should pick it.",
  openGraph: {
    title: "The four ways to send application email | Wraps",
    description:
      "Run SES yourself, rent a sending API, rent a marketing platform, or self-host an open-source wrapper. What each is good at, and who should pick it.",
  },
  twitter: {
    title: "The four ways to send application email | Wraps",
    description:
      "Run SES yourself, rent a sending API, rent a marketing platform, or self-host an open-source wrapper. What each is good at, and who should pick it.",
  },
  alternates: {
    canonical: "https://wraps.dev/approaches",
  },
};

export default function ApproachesPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <section className="border-border border-b pt-20 pb-16 md:pt-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <SectionKicker>Choosing an approach</SectionKicker>
            <h1 className="max-w-[22ch] font-heading font-semibold text-[38px] text-foreground leading-[1.05] tracking-[-0.03em] md:text-[52px]">
              There are four ways to send application email.
            </h1>
            <p className="mt-6 max-w-[62ch] text-[17px] text-muted-foreground leading-[1.6]">
              {APPROACHES_RUBRIC}
            </p>
            <p className="mt-4 max-w-[62ch] text-[17px] text-muted-foreground leading-[1.6]">
              We sell one of these. We have written the other three the way
              their own users would, because a comparison that only lists other
              people's weaknesses is not worth reading, and because for a good
              share of the people who land here the answer is not us.
            </p>
          </div>
        </section>

        {/* The rubric */}
        <section className="border-border border-b py-16 md:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-14">
              {APPROACHES.map((approach, i) => (
                <article
                  className={
                    approach.isUs
                      ? "-mx-5 rounded-lg border border-brand/40 bg-brand/[0.03] px-5 py-6 md:-mx-7 md:px-7"
                      : ""
                  }
                  key={approach.id}
                >
                  <div className="mb-4 flex items-baseline gap-3">
                    <span className="font-mono text-xs text-brand">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h2 className="font-heading font-semibold text-2xl text-foreground leading-[1.15] tracking-[-0.02em] md:text-[28px]">
                        {approach.title}
                      </h2>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        {approach.examples}
                      </p>
                    </div>
                  </div>

                  <dl className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <dt className="mb-1.5 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
                        What it is good at
                      </dt>
                      <dd className="text-[14.5px] text-foreground/90 leading-[1.6]">
                        {approach.pro}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1.5 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
                        What it costs you
                      </dt>
                      <dd className="text-[14.5px] text-foreground/90 leading-[1.6]">
                        {approach.con}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-5 border-foreground border-t pt-4 text-[14.5px] text-foreground leading-[1.6]">
                    <span className="font-semibold">Pick this if: </span>
                    {approach.pickThisIf}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Where the line actually falls */}
        <section className="border-border border-b py-16 md:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <SectionKicker>The one distinction that matters</SectionKicker>
            <h2 className="max-w-[26ch] font-heading font-semibold text-[28px] text-foreground leading-[1.1] tracking-[-0.022em] md:text-4xl">
              Every one of these ships a send API. Four of the five stop there.
            </h2>
            <div className="mt-6 max-w-[62ch] space-y-4 text-base text-muted-foreground leading-[1.65]">
              <p>
                Since the middle of 2026 a wave of open-source projects has
                rebuilt a Resend-compatible API on top of your own SES, and
                given it away. That is a real thing to know about before you pay
                anyone, us included. It also settles an argument: if the API
                were the hard part, it would not have been rebuilt eight times
                by people doing it for free on weekends.
              </p>
              <p>
                The hard part is the account underneath. Amazon starts a manual
                review at a 5% bounce rate and stops your mail at 10%; for
                complaints the lines are 0.1% and 0.5%. Getting production
                access in the first place is an approval that can be refused.
                None of that is visible from a send API, because in three of
                these four approaches it is not your account to lose.
              </p>
              <p>
                That is the layer Wraps builds. If you already operate SES well,
                you do not need it, and one of the free wrappers will serve you
                better than we will.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center rounded-md bg-foreground px-4 py-2.5 font-medium text-sm text-background transition-opacity hover:opacity-90"
                href="/docs/quickstart/email"
              >
                Deploy it and look at the card
              </Link>
              <Link
                className="inline-flex items-center rounded-md border border-border px-4 py-2.5 font-medium text-sm text-foreground transition-colors hover:border-foreground"
                href="/alternatives/resend"
              >
                Compare specific vendors
              </Link>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
