"use client";

import { ArrowRight, BookOpen, Inbox, Terminal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Snippet,
  SnippetCopyButton,
  SnippetHeader,
  SnippetTabsContent,
  SnippetTabsList,
  SnippetTabsTrigger,
} from "@/components/ui/shadcn-io/snippet";

const installCommand = "npx @wraps.dev/cli email inbound init";

export function CtaSection() {
  return (
    <section className="bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
            <Inbox className="size-4 text-cyan-500" />
            <span className="font-medium text-cyan-600 text-sm dark:text-cyan-400">
              Ready to receive?
            </span>
          </div>
          <h2 className="mb-4 font-bold text-3xl sm:text-4xl">
            Start receiving emails in minutes
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            One command deploys inbound email infrastructure to your AWS
            account. Configure MX records and start processing emails.
          </p>
        </div>

        {/* Install command */}
        <div className="mx-auto mb-8 max-w-md">
          <Snippet
            className="border-cyan-500/30 bg-[#0a0a0a] shadow-[0_0_15px_rgba(6,182,212,0.15)]"
            defaultValue="cli"
          >
            <SnippetHeader className="border-cyan-500/20 bg-[#0a0a0a]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5 pl-1">
                  <div className="size-2.5 rounded-full bg-red-500/80" />
                  <div className="size-2.5 rounded-full bg-yellow-500/80" />
                  <div className="size-2.5 rounded-full bg-green-500/80" />
                </div>
                <SnippetTabsList className="bg-transparent">
                  <SnippetTabsTrigger
                    className="text-cyan-400/70 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400"
                    value="cli"
                  >
                    CLI
                  </SnippetTabsTrigger>
                </SnippetTabsList>
              </div>
              <SnippetCopyButton
                className="text-cyan-400/70 opacity-100 hover:bg-cyan-500/10 hover:text-cyan-400"
                value={installCommand}
              />
            </SnippetHeader>
            <SnippetTabsContent
              className="bg-[#0a0a0a] text-left font-mono text-cyan-400"
              value="cli"
            >
              <span className="inline-flex items-center gap-2">
                <Terminal className="size-4 text-cyan-600" />
                {installCommand}
              </span>
            </SnippetTabsContent>
          </Snippet>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <Button
            asChild
            className="gap-2 bg-cyan-500 hover:bg-cyan-600"
            size="lg"
          >
            <Link href="/docs/quickstart/email/inbound">
              Get Started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild className="gap-2" size="lg" variant="outline">
            <Link href="/docs/cli-reference/email">
              <BookOpen className="size-4" />
              View Documentation
            </Link>
          </Button>
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-muted-foreground text-sm">
          <span>No credit card required</span>
          <span className="hidden sm:inline">•</span>
          <span>AWS pricing only</span>
          <span className="hidden sm:inline">•</span>
          <span>Full ownership</span>
        </div>
      </div>
    </section>
  );
}
