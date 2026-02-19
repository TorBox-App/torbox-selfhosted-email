import { Sparkles } from "lucide-react";

const commandGroups = [
  {
    title: "Email",
    status: "available",
    commands: [
      { command: "email init", description: "Deploy email infrastructure" },
      { command: "email status", description: "Show infrastructure details" },
      { command: "email check <domain>", description: "Check deliverability" },
      { command: "email domains add", description: "Add a domain to SES" },
      { command: "email domains list", description: "List all domains" },
      { command: "email domains verify", description: "Verify DNS records" },
      { command: "email upgrade", description: "Add features to setup" },
      { command: "email destroy", description: "Remove infrastructure" },
    ],
  },
  {
    title: "CDN",
    status: "available",
    commands: [
      { command: "cdn init", description: "Deploy CDN infrastructure" },
      { command: "cdn status", description: "Show CDN details" },
      { command: "cdn upload <file>", description: "Upload file to CDN" },
      { command: "cdn invalidate", description: "Invalidate CDN cache" },
      { command: "cdn destroy", description: "Remove infrastructure" },
    ],
  },
  {
    title: "SMS",
    status: "beta",
    commands: [
      { command: "sms init", description: "Deploy SMS infrastructure" },
      { command: "sms status", description: "Show SMS details" },
      { command: "sms test", description: "Send a test SMS" },
      { command: "sms register", description: "Register toll-free number" },
    ],
  },
  {
    title: "Global",
    status: "available",
    commands: [
      { command: "console", description: "Start local web dashboard" },
      { command: "status", description: "Overview of all services" },
      { command: "aws setup", description: "Interactive AWS setup" },
      { command: "aws doctor", description: "Diagnose AWS issues" },
    ],
  },
];

export function CliCommandsSection() {
  return (
    <section className="border-y bg-[#0a0a0a] py-16 sm:py-20" id="commands">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Simple inline label */}
        <p className="mb-8 text-center font-mono text-green-500/70 text-sm">
          $ wraps --help
        </p>

        {/* Commands grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {commandGroups.map((group) => (
            <div key={group.title}>
              {/* Group header */}
              <div className="mb-4 flex items-center gap-2">
                <span className="font-mono font-semibold text-green-400">
                  {group.title}
                </span>
                {group.status === "beta" && (
                  <span className="flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-blue-400 text-[10px]">
                    <Sparkles className="size-2.5" />
                    beta
                  </span>
                )}
              </div>

              {/* Commands list */}
              <div className="space-y-1">
                {group.commands.map((cmd) => (
                  <div
                    className="group flex items-baseline gap-3 rounded px-2 py-1.5 transition-colors hover:bg-green-500/5"
                    key={cmd.command}
                  >
                    <code className="shrink-0 font-mono text-cyan-400 text-xs">
                      {cmd.command}
                    </code>
                    <span className="font-mono text-zinc-600 text-[11px]">
                      {cmd.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
