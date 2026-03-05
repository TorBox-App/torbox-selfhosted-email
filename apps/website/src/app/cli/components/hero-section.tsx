"use client";

import { Terminal } from "lucide-react";
import { AsciinemaPlayer } from "@/components/asciinema-player";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";
import {
  Snippet,
  SnippetCopyButton,
  SnippetHeader,
  SnippetTabsContent,
  SnippetTabsList,
  SnippetTabsTrigger,
} from "@/components/ui/shadcn-io/snippet";
import { WordRotate } from "@/components/ui/word-rotate";
import { assetUrl } from "@/lib/utils";

const installCommands = {
  curl: "curl -fsSL https://get.wraps.dev | sh",
  npm: "npm install -g @wraps.dev/cli",
  pnpm: "pnpm add -g @wraps.dev/cli",
  yarn: "yarn global add @wraps.dev/cli",
  bun: "bun add -g @wraps.dev/cli",
};

export function CliHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-28">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column - Text content */}
          <div>
            {/* Badge */}
            <div className="mb-6">
              <Badge
                className="border-green-500/30 bg-green-500/10 px-4 py-2 text-green-600 dark:text-green-400"
                variant="outline"
              >
                <Terminal className="mr-2 size-4" />
                Free Forever
              </Badge>
            </div>

            {/* Main Headline */}
            <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-5xl">
              <span className="flex flex-row flex-wrap items-center gap-2">
                <span>Deploy</span>
                <WordRotate
                  className="text-green-500"
                  duration={3000}
                  words={["Email", "SMS", "CDN"]}
                />
                <span>to your AWS</span>
              </span>
              <span className="text-pretty">in one command.</span>
            </h1>

            {/* Subheading */}
            <p className="mb-8 max-w-lg text-pretty text-lg text-muted-foreground">
              Deploy production-ready infrastructure to your AWS account. Domain
              verification, event tracking, local console — all included, all
              free.
            </p>

            {/* Install command */}
            <div className="mb-8 max-w-md">
              <Snippet
                className="border-green-500/30 bg-[#0a0a0a] shadow-[0_0_15px_rgba(34,197,94,0.15)]"
                defaultValue="curl"
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
                        value="curl"
                      >
                        curl
                      </SnippetTabsTrigger>
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
                    className="text-green-400/70 opacity-100 hover:bg-green-500/10 hover:text-green-400"
                    value={installCommands.npm}
                  />
                </SnippetHeader>
                {Object.entries(installCommands).map(([key, command]) => (
                  <SnippetTabsContent
                    className="bg-[#0a0a0a] text-left font-mono text-green-400"
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
          </div>

          {/* Right column - Terminal Demo */}
          <div className="group relative">
            {/* Background glow effect */}
            <div className="absolute -inset-4 rounded-3xl bg-green-500/10 opacity-50 blur-2xl transition-opacity group-hover:opacity-70" />

            {/* Terminal */}
            <div className="relative overflow-hidden rounded-xl border-2 border-green-500/30 shadow-2xl">
              {/* Terminal header */}
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-500" />
                  <div className="size-3 rounded-full bg-yellow-500" />
                  <div className="size-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 font-medium text-muted-foreground text-xs">
                  terminal — wraps email init
                </span>
              </div>
              {/* Asciinema Player */}
              <div className="bg-[#121314]">
                <AsciinemaPlayer
                  cols={80}
                  fit="width"
                  idleTimeLimit={1}
                  loop={true}
                  rows={24}
                  speed={1.2}
                  src={assetUrl("demos/email-init.cast")}
                  terminalFontSize="12px"
                />
              </div>
            </div>

            {/* Bottom fade effect */}
            <div className="absolute bottom-0 left-0 h-12 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/20 to-background/60" />
          </div>
        </div>
      </div>
    </section>
  );
}
