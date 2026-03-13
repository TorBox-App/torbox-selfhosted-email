import Image from "next/image";

export function WhyWrapsSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-24" id="why-wraps">
      {/* Grain texture — ties back to hero */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
      >
        <filter id="why-noise">
          <feTurbulence
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
            type="fractalNoise"
          />
        </filter>
        <rect filter="url(#why-noise)" height="100%" width="100%" />
      </svg>

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16 lg:gap-24">
          {/* Left column — narrative */}
          <div className="animate-fade-in-up">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Why Wraps
            </p>

            <div className="mt-6 space-y-4">
              <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
                I spent years at SendGrid watching companies pay hundreds a
                month to send emails through infrastructure they didn&rsquo;t
                own. When vendors change pricing, get acquired, or suspend your
                account&mdash;you&rsquo;re stuck.
              </p>

              <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
                Postmark charges per email. Resend charges per email. SendGrid
                charges per contact. None of them deploy to your AWS account.
                You&rsquo;re always renting.
              </p>
            </div>

            {/* Turning point */}
            <div className="my-8 h-px w-20 bg-orange-500" />

            <p
              className="text-5xl uppercase leading-[0.85] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-[5.5rem]"
              style={{ fontFamily: '"League Gothic Condensed", sans-serif' }}
            >
              So I built <span className="text-orange-500">Wraps.</span>
            </p>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-foreground/80 md:text-xl">
              Deploy to your AWS and use the platform when you need to send
              broadcasts, manage templates with a team, or create automations.
            </p>
          </div>

          {/* Right column — founder photo */}
          <div className="flex flex-col items-center animate-fade-in-up animation-delay-100">
            <Image
              alt="Jarod, founder of Wraps"
              className="rounded-full"
              height={140}
              src="/team/jarod-medium-smile.webp"
              width={140}
            />
            <p className="mt-4 font-semibold text-foreground">Jarod</p>
            <p className="text-sm text-muted-foreground">Founder, Wraps</p>
          </div>
        </div>
      </div>
    </section>
  );
}
