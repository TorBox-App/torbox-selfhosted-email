import { HeroAnimatedCTA } from "./hero-cta";
import { HeroTerminal } from "./hero-terminal";
import { SectionKicker } from "./section-kicker";

const proofStats: { n: string; k: string }[] = [
  { n: "~38s", k: "median first deploy" },
  { n: "$0.10", k: "per 1k emails, at AWS cost" },
  { n: "0", k: "credentials we store" },
];

// Static content - server rendered, visible immediately
export function HeroSection() {
  return (
    <section className="relative border-border border-b pt-20 pb-16 md:pt-24 lg:pt-28">
      {/* Background Pattern — extends past section to blend into principles */}
      {/*<div className="absolute inset-0 -bottom-80">
        <DotPattern
          className="opacity-100 dark:opacity-65"
          fadeStyle="ellipse"
          size="md"
        />
      </div>*/}

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* Left column — copy */}
          <div className="flex flex-col items-start">
            <SectionKicker>Open-source email infrastructure</SectionKicker>

            <h1 className="max-w-[15ch] text-left font-heading font-semibold text-[40px] text-foreground leading-[1.04] tracking-[-0.03em] md:text-[52px] lg:text-[62px]">
              Email infrastructure, deployed to your own AWS.
            </h1>

            <p className="mt-5 max-w-[46ch] text-left text-[17px] text-muted-foreground leading-[1.55] md:text-[19px]">
              Wraps provisions SES, DynamoDB, and Lambda into your AWS account
              with one command. Send from your app or your agent, and pay AWS
              directly at{" "}
              <strong className="text-foreground/90">
                $0.10 per 1,000 emails
              </strong>
              .
            </p>

            <div className="mt-8 mb-10">
              <HeroAnimatedCTA />
            </div>

            {/* Proof stats */}
            <dl className="flex flex-wrap border-border border-t">
              {proofStats.map((stat, i) => (
                <div
                  className={`py-4 pr-6 ${i < proofStats.length - 1 ? "mr-6 border-border border-r" : ""}`}
                  key={stat.k}
                >
                  <dt className="font-mono font-semibold text-[20px] text-foreground tracking-[-0.01em]">
                    {stat.n}
                  </dt>
                  <dd className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {stat.k}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right column — terminal */}
          <div className="w-full lg:justify-self-end">
            <HeroTerminal />
          </div>
        </div>
      </div>
    </section>
  );
}
