import { HeroAnimatedCTA } from "./hero-cta";
import { HeroTerminal } from "./hero-terminal";
import { SectionKicker } from "./section-kicker";

// The rate used to sit in this row. It moved to the pricing section on
// purpose: price is the third value theme, and against the free open-source
// SES wrappers it is an argument we lose. See ops/sops/positioning.md.
const proofStats: { n: string; k: string }[] = [
  { n: "~2 min", k: "typical first deploy" },
  { n: "5% / 0.1%", k: "the AWS bounce and complaint lines we watch" },
  { n: "0", k: "credentials we store" },
];

// Static content - server rendered, visible immediately
export function HeroSection() {
  return (
    <section className="relative border-border border-b pt-20 pb-16 md:pt-24 lg:pt-28">
      {/* Background Pattern: extends past section to blend into principles */}
      {/*<div className="absolute inset-0 -bottom-80">
        <DotPattern
          className="opacity-100 dark:opacity-65"
          fadeStyle="ellipse"
          size="md"
        />
      </div>*/}

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* Left column: copy */}
          <div className="flex flex-col items-start">
            <SectionKicker>
              The open-source operations layer for Amazon SES
            </SectionKicker>

            <h1 className="max-w-[21ch] text-left font-heading font-semibold text-[40px] text-foreground leading-[1.04] tracking-[-0.03em] md:text-[52px] lg:text-[62px]">
              Run Amazon SES without becoming its operator.
            </h1>

            <p className="mt-5 max-w-[48ch] text-left text-[17px] text-muted-foreground leading-[1.55] md:text-[19px]">
              SES is the cheapest way to send email, and most teams still do not
              use it — production access is an approval you can be refused, and
              bounce handling becomes your job on day one. Wraps deploys the
              whole SES surface into your AWS account in one command. Send from
              your app or your agent, and we watch the account against the rates{" "}
              <strong className="text-foreground/90">
                AWS suspends people for
              </strong>
              .
            </p>

            <div className="mt-8 mb-10">
              <HeroAnimatedCTA />
            </div>

            {/* Proof stats */}
            <dl className="grid w-full grid-cols-1 border-border border-t sm:grid-cols-3">
              {proofStats.map((stat, i) => (
                <div
                  className={`py-4 sm:px-5 sm:first:pl-0 ${i > 0 ? "border-border border-t sm:border-t-0 sm:border-l" : ""}`}
                  key={stat.k}
                >
                  <dt className="font-mono font-semibold text-[20px] text-foreground tracking-[-0.01em]">
                    {stat.n}
                  </dt>
                  <dd className="mt-0.5 text-pretty text-[12.5px] text-muted-foreground">
                    {stat.k}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right column: terminal */}
          <div className="w-full lg:justify-self-end">
            <HeroTerminal />
          </div>
        </div>
      </div>
    </section>
  );
}
