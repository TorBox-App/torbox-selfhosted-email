"use client";

import { SectionWrapper } from "@/app/landing/components/section-card";

const emailCommands = [
  { command: "email init", description: "Deploy new email infrastructure" },
  { command: "email status", description: "Show infrastructure details" },
  { command: "email check <domain>", description: "Check email deliverability" },
  { command: "email domains add", description: "Add a domain to SES" },
  { command: "email domains list", description: "List all domains" },
  { command: "email domains verify", description: "Verify DNS records" },
  { command: "email upgrade", description: "Add features to your setup" },
  { command: "email destroy", description: "Remove infrastructure" },
];

const globalCommands = [
  { command: "console", description: "Start local web dashboard" },
  { command: "status", description: "Show overview of all services" },
  { command: "news", description: "Show recent Wraps updates" },
  { command: "support", description: "Get help and contact info" },
  { command: "aws setup", description: "Interactive AWS setup wizard" },
  { command: "aws doctor", description: "Diagnose AWS issues" },
];

const smsCommands = [
  { command: "sms init", description: "Deploy SMS infrastructure" },
  { command: "sms status", description: "Show SMS details" },
  { command: "sms test", description: "Send a test SMS" },
  { command: "sms register", description: "Register toll-free number" },
];

export function CliCommandsSection() {
  return (
    <SectionWrapper
      badge="Commands"
      description="Full command reference for email, SMS, and infrastructure management."
      id="commands"
      title="Built-in commands"
    >
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Email Commands */}
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b bg-muted/50 px-6 py-4">
            <h3 className="font-semibold">Email Commands</h3>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {emailCommands.map((cmd) => (
                <li className="flex items-start gap-2 text-sm" key={cmd.command}>
                  <code className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs">
                    {cmd.command}
                  </code>
                  <span className="text-muted-foreground">
                    {cmd.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Global Commands */}
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b bg-muted/50 px-6 py-4">
            <h3 className="font-semibold">Global Commands</h3>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {globalCommands.map((cmd) => (
                <li className="flex items-start gap-2 text-sm" key={cmd.command}>
                  <code className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs">
                    {cmd.command}
                  </code>
                  <span className="text-muted-foreground">
                    {cmd.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* SMS Commands */}
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b bg-muted/50 px-6 py-4">
            <h3 className="font-semibold">SMS Commands</h3>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {smsCommands.map((cmd) => (
                <li className="flex items-start gap-2 text-sm" key={cmd.command}>
                  <code className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs">
                    {cmd.command}
                  </code>
                  <span className="text-muted-foreground">
                    {cmd.description}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-muted-foreground text-xs">
              Run <code className="rounded bg-muted px-1">wraps --help</code> for
              the full command list.
            </p>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
