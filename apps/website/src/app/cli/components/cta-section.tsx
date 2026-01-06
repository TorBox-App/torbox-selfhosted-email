"use client";

import { ArrowRight, Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className="p-1 text-green-600 transition-colors hover:text-green-400"
      onClick={handleCopy}
      type="button"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

const command = "npx @wraps.dev/cli email init";

export function CliCtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-foreground px-8 py-16 text-center text-background">
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            Ready to deploy?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-background/70">
            Get started in under 2 minutes. The CLI is free forever — you only
            pay AWS for what you use.
          </p>

          {/* Install command */}
          <div className="mx-auto mb-8 max-w-md">
            <div className="flex items-center justify-between overflow-hidden rounded-xl border border-green-500/30 bg-[#0a0a0a] px-4 py-3">
              <code className="flex items-center gap-2 font-mono text-green-400 text-sm">
                <Terminal className="size-4 text-green-600" />
                {command}
              </code>
              <CopyButton value={command} />
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="bg-green-500 text-white hover:bg-green-600"
              size="lg"
            >
              <a href="/docs/quickstart/email">
                Read the Quickstart
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
            <Button
              asChild
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              size="lg"
              variant="outline"
            >
              <a href="/platform">Explore the Platform</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
