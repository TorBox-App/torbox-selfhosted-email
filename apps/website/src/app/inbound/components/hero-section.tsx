"use client";

import { Inbox, Mail, Paperclip, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const sampleEmails = [
  {
    id: 1,
    from: "customer@example.com",
    subject: "Order #12345 Question",
    preview: "Hi, I have a question about my recent order...",
    hasAttachment: false,
    isSpam: false,
    time: "2m ago",
  },
  {
    id: 2,
    from: "support@partner.io",
    subject: "Integration Request",
    preview: "We'd like to discuss API integration options...",
    hasAttachment: true,
    isSpam: false,
    time: "5m ago",
  },
  {
    id: 3,
    from: "noreply@service.com",
    subject: "Receipt for Payment #9876",
    preview: "Thank you for your payment. Attached is your receipt...",
    hasAttachment: true,
    isSpam: false,
    time: "12m ago",
  },
  {
    id: 4,
    from: "lead@prospect.co",
    subject: "Interested in your product",
    preview: "I saw your demo and would love to learn more...",
    hasAttachment: false,
    isSpam: false,
    time: "18m ago",
  },
];

function AnimatedInbox() {
  const [visibleEmails, setVisibleEmails] = useState<number[]>([]);
  const [animatingEmail, setAnimatingEmail] = useState<number | null>(null);

  useEffect(() => {
    // Initial display with stagger
    const showEmails = () => {
      sampleEmails.forEach((_, index) => {
        setTimeout(() => {
          setAnimatingEmail(index);
          setTimeout(() => {
            setVisibleEmails((prev) => [...prev, index]);
            setAnimatingEmail(null);
          }, 300);
        }, index * 400);
      });
    };

    showEmails();

    // Loop animation
    const interval = setInterval(() => {
      setVisibleEmails([]);
      setAnimatingEmail(null);
      setTimeout(showEmails, 500);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-cyan-500/30 bg-background shadow-2xl">
      {/* Inbox header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-red-500" />
            <div className="size-3 rounded-full bg-yellow-500" />
            <div className="size-3 rounded-full bg-green-500" />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-background/80 px-3 py-1">
            <Inbox className="size-3.5 text-cyan-500" />
            <span className="font-mono text-muted-foreground text-xs">
              inbox@yourapp.com
            </span>
          </div>
        </div>
        <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-medium text-cyan-600 text-xs dark:text-cyan-400">
          {visibleEmails.length} emails
        </span>
      </div>

      {/* Email list */}
      <div className="relative min-h-[280px] bg-background/50 p-2">
        {sampleEmails.map((email, index) => {
          const isVisible = visibleEmails.includes(index);
          const isAnimating = animatingEmail === index;

          return (
            <div
              className={cn(
                "mb-2 rounded-lg border border-transparent p-3 transition-all duration-300",
                isVisible &&
                  "translate-x-0 border-border bg-muted/30 opacity-100",
                !isVisible && isAnimating && "translate-x-8 opacity-50",
                !(isVisible || isAnimating) && "translate-x-full opacity-0",
                isVisible && "hover:border-cyan-500/30 hover:bg-cyan-500/5"
              )}
              key={email.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Mail className="size-3.5 shrink-0 text-cyan-500" />
                    <span className="truncate font-medium text-sm">
                      {email.from}
                    </span>
                    {email.hasAttachment && (
                      <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                    )}
                    {!email.isSpam && (
                      <ShieldCheck className="size-3 shrink-0 text-green-500" />
                    )}
                  </div>
                  <p className="mb-0.5 truncate font-medium text-sm">
                    {email.subject}
                  </p>
                  <p className="truncate text-muted-foreground text-xs">
                    {email.preview}
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {email.time}
                </span>
              </div>
            </div>
          );
        })}

        {/* Incoming email indicator */}
        {animatingEmail !== null && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-center">
            <div className="size-2 animate-pulse rounded-full bg-cyan-500" />
          </div>
        )}
      </div>
    </div>
  );
}

export function HeroSection() {
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
                className="border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-cyan-600 dark:text-cyan-400"
                variant="outline"
              >
                <Inbox className="mr-2 size-4" />
                Inbound Email
              </Badge>
            </div>

            {/* Main Headline */}
            <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-5xl">
              <span className="text-cyan-500">Every inbox.</span>
              <br />
              Your infrastructure.
            </h1>

            {/* Subheading */}
            <p className="mb-8 max-w-lg text-pretty text-lg text-muted-foreground">
              Receive, parse, and process emails in your AWS account. Build
              support inboxes, automate order processing, or create
              email-to-ticket workflows.
            </p>

            {/* Key features */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "SES + S3 + Lambda + EventBridge",
                "Parse headers & attachments",
                "Spam & virus detection",
                "Reply with threading",
              ].map((feature) => (
                <div className="flex items-center gap-2" key={feature}>
                  <div className="size-1.5 rounded-full bg-cyan-500" />
                  <span className="text-muted-foreground text-sm">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column - Animated Inbox */}
          <div className="group relative">
            {/* Background glow effect */}
            <div className="absolute -inset-4 rounded-3xl bg-cyan-500/10 opacity-50 blur-2xl transition-opacity group-hover:opacity-70" />

            <AnimatedInbox />
          </div>
        </div>
      </div>
    </section>
  );
}
