"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { AsciinemaPlayer } from "@/components/asciinema-player";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetUrl } from "@/lib/utils";

const services = [
  { name: "Email", price: "$0.10/1k" },
  { name: "CDN", price: "$0.085/GB" },
  { name: "SMS", price: "~$0.01/msg" },
];

function SyncedRotate() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % services.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const current = services[index];

  return (
    <span className="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
      <span className="flex items-center gap-2 sm:gap-3">
        <span>Own your</span>
        <span className="relative inline-block min-w-[100px] sm:min-w-[120px]">
          <AnimatePresence mode="wait">
            <motion.span
              key={current.name}
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="inline-block text-orange-500"
            >
              {current.name}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
      <span className="flex items-center gap-2 sm:gap-3">
        <span className="text-muted-foreground">for</span>
        <span className="relative inline-block min-w-[120px] sm:min-w-[140px]">
          <AnimatePresence mode="wait">
            <motion.span
              key={current.price}
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="inline-block text-orange-500"
            >
              {current.price}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
    </span>
  );
}

const command = "npx @wraps.dev/cli email init";

export function HeroSection() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        {/* Dot pattern overlay using reusable component */}
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement Badge */}
          <div className="mb-8 flex justify-center gap-2">
            <a href="/cli">
              <Badge
                className="border-green-500/50 bg-green-500/10 px-3 py-1.5 text-green-700 transition-colors hover:bg-green-500/20 dark:text-green-400"
                variant="outline"
              >
                Free CLI + SDK
              </Badge>
            </a>
            <a href="/platform">
              <Badge
                className="border-orange-500/50 bg-orange-500/10 px-3 py-1.5 text-orange-700 transition-colors hover:bg-orange-500/20 dark:text-orange-400"
                variant="outline"
              >
                Platform from $10/mo
              </Badge>
            </a>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-5xl lg:text-6xl">
            <SyncedRotate />
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            One command deploys to your AWS account. No vendor markup.
            No lock-in. Just AWS pricing.
          </p>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4">
            <button
              className="flex items-center gap-2 rounded-lg border-2 border-orange-500/30 bg-background px-5 py-3 font-mono text-sm transition-colors hover:border-orange-500 hover:bg-orange-500/5 sm:text-base"
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
              className="cursor-pointer bg-orange-500 text-base hover:bg-orange-600"
              size="lg"
            >
              <a href="/docs/quickstart">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Terminal Demo */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="group relative">
            {/* Top background glow effect */}
            <div className="-translate-x-1/2 absolute top-0 left-1/2 mx-auto h-16 w-[70%] transform rounded-full bg-orange-500/10 blur-2xl lg:h-32" />

            {/* Terminal */}
            <div className="relative overflow-hidden rounded-xl border-2 shadow-2xl">
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
                  cols={100}
                  fit="width"
                  idleTimeLimit={1}
                  loop={true}
                  rows={30}
                  speed={1.2}
                  src={assetUrl("demos/email-init.cast")}
                  terminalFontSize="13px"
                />
              </div>
            </div>

            {/* Bottom fade effect */}
            <div className="absolute bottom-0 left-0 h-12 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/20 to-background/60 lg:h-16" />
          </div>
        </div>
      </div>
    </section>
  );
}
