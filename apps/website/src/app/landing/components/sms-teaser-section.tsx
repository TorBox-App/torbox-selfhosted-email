"use client";

import { ArrowRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SmsTeaserSection() {
  return (
    <section className="border-y py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-orange-500 bg-orange-500/5">
            <MessageSquare className="h-6 w-6 text-orange-500" />
          </div>
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-center gap-2 md:justify-start">
              <p className="font-medium text-orange-500 text-sm">Coming Soon</p>
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 font-medium text-orange-600 text-[10px] dark:text-orange-400">
                SMS
              </span>
            </div>
            <h2 className="mb-1 font-semibold text-xl">
              AWS SMS, simplified.
            </h2>
            <p className="text-muted-foreground text-sm">
              Self-hosted SMS infrastructure with toll-free first strategy, TypeScript SDK, and AWS pricing.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 md:items-end">
            <Button
              asChild
              className="cursor-pointer bg-orange-500 hover:bg-orange-600"
            >
              <a href="/sms">
                Join Waitlist
                <ArrowRight className="ml-1 size-4" />
              </a>
            </Button>
            <p className="text-muted-foreground text-xs">
              Be the first to know when we launch
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
