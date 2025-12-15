"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExistingSesSection() {
  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-3 font-semibold text-xl">Already using SES?</h2>
          <p className="mb-6 text-muted-foreground">
            Connect Wraps to your existing setup. We add tracking, analytics,
            and the SDK without modifying your current configuration.
          </p>
          <div className="mb-6 inline-block rounded-lg border bg-muted/50 px-4 py-3">
            <code className="font-mono text-sm">
              npx @wraps.dev/cli email connect
            </code>
          </div>
          <div>
            <Button asChild className="cursor-pointer" variant="link">
              <a href="/docs/cli-reference#email-connect">
                Learn more about connect
                <ArrowRight className="ml-1 size-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
