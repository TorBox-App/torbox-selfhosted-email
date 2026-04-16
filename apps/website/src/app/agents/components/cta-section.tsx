"use client";

import { Button } from "@wraps/ui/components/ui/button";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { trackEvent } from "@/utils/analytics";

export function AgentsCtaSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="mb-6 font-medium text-2xl tracking-tight sm:text-3xl">
          Your agent. Your AWS.{" "}
          <span className="text-muted-foreground">One command.</span>
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            asChild
            className="bg-orange-500 text-white hover:bg-orange-600"
            size="lg"
          >
            <Link
              href="/docs/quickstart/email/agents"
              onClick={() =>
                trackEvent("cta_click", {
                  location: "agents_cta",
                  cta_text: "Read the agent quickstart",
                })
              }
            >
              Read the agent quickstart
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/docs/guides/context7">
              <BookOpen className="size-4" />
              Wire up Context7
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
