"use client";

import { ArrowRight, Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AsciinemaPlayer } from "@/components/asciinema-player";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetUrl } from "@/lib/utils";

const services = ["Email", "SMS", "CDN"];

function RotatingService() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % services.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative inline-block min-w-[80px] text-left sm:min-w-[100px]">
      <AnimatePresence mode="wait">
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          className="inline-block text-orange-500"
          exit={{ opacity: 0, y: 30 }}
          initial={{ opacity: 0, y: -30 }}
          key={services[index]}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {services[index]}
        </motion.span>
      </AnimatePresence>
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
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex justify-center gap-2"
            initial={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
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
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-5xl lg:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Own Your <RotatingService /> Infrastructure
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-3 text-balance text-lg sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            One command deploys serverless pay-as-you-go infrastructure to your
            AWS.
          </motion.p>

          {/* Platform pitch */}
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-10 text-balance text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Build workflows, templates, and broadcasts with the Wraps Platform.
          </motion.p>

          {/* CTA */}
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <button
              aria-label={
                copied ? "Copied to clipboard" : "Copy command to clipboard"
              }
              className="flex h-12 items-center gap-2 rounded-lg border-2 border-orange-500/30 bg-background px-5 font-mono text-sm transition-colors hover:border-orange-500 hover:bg-orange-500/5"
              onClick={copyToClipboard}
              type="button"
            >
              <span className="text-muted-foreground">$</span>
              <span>{command}</span>
              {copied ? (
                <Check aria-hidden="true" className="size-4 text-green-500" />
              ) : (
                <Copy
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
              )}
            </button>
            <Button
              asChild
              className="h-12 cursor-pointer border-2 border-transparent bg-orange-500 px-6 text-base hover:bg-orange-600"
            >
              <a href="/docs/quickstart">
                Get Started Free
                <ArrowRight aria-hidden="true" className="ml-2 size-4" />
              </a>
            </Button>
          </motion.div>
        </div>

        {/* Terminal Demo */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-16 max-w-4xl"
          initial={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
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
        </motion.div>
      </div>
    </section>
  );
}
