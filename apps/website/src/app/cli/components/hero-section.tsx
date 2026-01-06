"use client";

import { ArrowRight, Terminal } from "lucide-react";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Snippet,
  SnippetCopyButton,
  SnippetHeader,
  SnippetTabsContent,
  SnippetTabsList,
  SnippetTabsTrigger,
} from "@/components/ui/shadcn-io/snippet";
import { WordRotate } from "@/components/ui/word-rotate";

const installCommands = {
  npm: "npm install -g @wraps.dev/cli",
  pnpm: "pnpm add -g @wraps.dev/cli",
  yarn: "yarn global add @wraps.dev/cli",
  bun: "bun add -g @wraps.dev/cli",
};

export function CliHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 flex justify-center">
            <Badge
              className="border-green-500/30 bg-green-500/10 px-4 py-2 text-green-600 dark:text-green-400"
              variant="outline"
            >
              <Terminal className="mr-2 size-4" />
              Free Forever
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            <span className="flex flex-col items-center justify-center sm:flex-row sm:gap-3">
              <span>Deploy AWS</span>
              <WordRotate
                className="text-green-500"
                duration={3000}
                words={["Email", "SMS"]}
              />
            </span>
            <span className="text-pretty">in one command.</span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            The Wraps CLI deploys production-ready email infrastructure to your
            AWS account. Domain verification, event tracking, local console —
            all included.
          </p>

          {/* Install command */}
          <div className="mx-auto mb-10 max-w-md">
            <Snippet
              className="border-green-500/30 bg-[#0a0a0a] shadow-[0_0_15px_rgba(34,197,94,0.15)]"
              defaultValue="npm"
            >
              <SnippetHeader className="border-green-500/20 bg-[#0a0a0a]">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 pl-1">
                    <div className="size-2.5 rounded-full bg-red-500/80" />
                    <div className="size-2.5 rounded-full bg-yellow-500/80" />
                    <div className="size-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <SnippetTabsList className="bg-transparent">
                    <SnippetTabsTrigger
                      className="text-green-400/70 data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400"
                      value="npm"
                    >
                      npm
                    </SnippetTabsTrigger>
                    <SnippetTabsTrigger
                      className="text-green-400/70 data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400"
                      value="pnpm"
                    >
                      pnpm
                    </SnippetTabsTrigger>
                    <SnippetTabsTrigger
                      className="text-green-400/70 data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400"
                      value="yarn"
                    >
                      yarn
                    </SnippetTabsTrigger>
                    <SnippetTabsTrigger
                      className="text-green-400/70 data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400"
                      value="bun"
                    >
                      bun
                    </SnippetTabsTrigger>
                  </SnippetTabsList>
                </div>
                <SnippetCopyButton
                  className="opacity-100 text-green-400/70 hover:bg-green-500/10 hover:text-green-400"
                  value={installCommands.npm}
                />
              </SnippetHeader>
              {Object.entries(installCommands).map(([key, command]) => (
                <SnippetTabsContent
                  className="bg-[#0a0a0a] font-mono text-green-400 text-left"
                  key={key}
                  value={key}
                >
                  <span className="inline-flex items-center gap-2">
                    <Terminal className="size-4 text-green-600" />
                    {command}
                  </span>
                </SnippetTabsContent>
              ))}
            </Snippet>
          </div>

          {/* CTAs */}
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <a href="/docs/quickstart/email">
                Get Started
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">See All Features</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
