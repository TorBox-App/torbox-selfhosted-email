"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

const command = "npx @wraps.dev/cli email connect";

export function ExistingSesSection() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="border-y py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-orange-500 bg-orange-500/5">
            <svg
              className="h-6 w-6 text-orange-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="mb-1 font-medium text-orange-500 text-sm">
              Already using SES?
            </p>
            <h2 className="mb-1 font-semibold text-xl">
              Connect without breaking anything
            </h2>
            <p className="text-muted-foreground text-sm">
              Add tracking, analytics, and the SDK to your existing setup.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 md:items-end">
            <button
              className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 font-mono text-sm transition-colors hover:bg-muted/50"
              onClick={copyToClipboard}
              type="button"
            >
              <span className="text-muted-foreground">$</span>
              <span>{command}</span>
              {copied ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Copy className="size-4 text-muted-foreground" />
              )}
            </button>
            <Button
              asChild
              className="group cursor-pointer text-muted-foreground"
              size="sm"
              variant="link"
            >
              <a href="/docs/cli-reference#email-connect">
                Learn more
                <ArrowRight className="ml-1 size-3 transition-transform group-hover:translate-x-0.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
