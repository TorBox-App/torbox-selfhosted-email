import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { APPROACHES } from "@/config/approaches";
import { SectionKicker } from "./section-kicker";

/*
 * Dunford's step 2: hand the reader the rubric for the whole market before
 * pitching into it. The full page at /approaches carries the fair version of
 * each one, including the two where the honest recommendation is not us.
 *
 * Content comes from src/config/approaches.ts so this strip and the page can
 * never drift apart.
 */

const others = APPROACHES.filter((a) => !a.isUs);

export function ApproachesTeaserSection() {
  return (
    <section className="border-border border-b py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionKicker>Before you pick anything</SectionKicker>
        <h2 className="max-w-[28ch] font-heading font-semibold text-[28px] text-foreground leading-[1.1] tracking-[-0.022em] md:text-4xl">
          There are four ways to send application email. One of them is us.
        </h2>

        <ul className="mt-9 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((approach, i) => (
            <li className="border-foreground border-t pt-4" key={approach.id}>
              <span className="font-mono text-[11px] text-brand">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-semibold text-[15px] text-foreground">
                {approach.label}
              </h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {approach.examples}
              </p>
              <p className="mt-2.5 text-[13.5px] text-muted-foreground leading-[1.55]">
                {approach.pickThisIf}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-9 max-w-[62ch] text-[15px] text-muted-foreground leading-[1.6]">
          Wraps is the first one with an operations layer on top. If you already
          run SES well, the free wrappers will serve you better than we will,
          and the rubric says so in as many words.
        </p>

        <Link
          className="mt-4 inline-flex items-center gap-1.5 font-medium text-sm text-foreground underline-offset-4 hover:underline"
          href="/approaches"
        >
          Read the full comparison
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
