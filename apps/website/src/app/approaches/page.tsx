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
            <h1 className="max-w-[22ch] font-heading font-semibold text-4xl text-foreground leading-none tracking-tight md:text-5xl">
              There are four ways to send application email.
            </h1>
            <p className="mt-6 max-w-[62ch] text-lg text-muted-foreground leading-relaxed">
              {APPROACHES_RUBRIC}
            </p>
            <p className="mt-4 max-w-[62ch] text-lg text-muted-foreground leading-relaxed">
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
                      <h2 className="font-heading font-semibold text-2xl text-foreground leading-tight tracking-tight md:text-3xl">
                        {approach.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {approach.examples}
                      </p>
                    </div>
                  </div>

                  <dl className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <dt className="mb-1.5 font-mono text-2xs text-muted-foreground uppercase tracking-widest">
                        What it is good at
                      </dt>
                      <dd className="text-sm text-foreground/90 leading-relaxed">
                        {approach.pro}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1.5 font-mono text-2xs text-muted-foreground uppercase tracking-widest">
                        What it costs you
                      </dt>
                      <dd className="text-sm text-foreground/90 leading-relaxed">
                        {approach.con}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-5 border-foreground border-t pt-4 text-sm text-foreground leading-relaxed">
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
            <h2 className="max-w-[26ch] font-heading font-semibold text-3xl text-foreground leading-none tracking-tight md:text-4xl">
              Every one of these ships a send API. Four of the five stop there.
            </h2>
            <div className="mt-6 max-w-[62ch] space-y-4 text-base text-muted-foreground leading-relaxed">
              <p>
                Since the middle of 2026 a wave of open-source projects has
                rebuilt a Resend-compatible API on top of your own SES, and
                given it away. That is a real thing to know about before you pay
                anyone, us included. It also settles an argument: if the API
                were the hard part, it would not keep being rebuilt by people
                giving it away for nothing.
              </p>
              <p>
                The hard part is the account underneath. Amazon can put an
                account under review once its bounce rate passes 5% and can
                pause sending at 10%; for complaints the lines are 0.1% and
                0.5%. Getting production access in the first place is an
                approval that can be refused. None of that is visible from a
                send API, because in three of these four approaches it is not
                your account to lose.
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
