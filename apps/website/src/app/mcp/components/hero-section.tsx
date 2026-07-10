import { DotPattern } from "@wraps/ui/components/dot-pattern";
import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

const tools = [
  {
    name: "list_recent_sends",
    description: "Recent sends from your email history",
    write: false,
  },
  {
    name: "get_email_event_log",
    description: "Full delivery timeline for a message",
    write: false,
  },
  {
    name: "verify_domain_status",
    description: "DKIM + verification status of a domain",
    write: false,
  },
  {
    name: "list_suppressions",
    description: "Bounce and complaint suppression list",
    write: false,
  },
  {
    name: "send_email",
    description: "Send via your SES account, guarded",
    write: true,
  },
  {
    name: "check_send_status",
    description: "Poll a send awaiting operator approval",
    write: false,
  },
];

export function McpHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-28">
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          {/* Left column — mono-forward copy */}
          <div>
            <div className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              <span className="size-1.5 rounded-full bg-orange-500" />
              <span>wraps · mcp server</span>
            </div>

            <h1 className="mb-6 text-pretty font-heading font-semibold text-4xl leading-tight tracking-tight sm:text-5xl">
              The MCP server for email{" "}
              <span className="text-orange-500">your agent owns.</span>
            </h1>

            {/* Mono anchor: the install command IS the marketing */}
            <pre className="mb-6 overflow-x-auto rounded-lg border border-border bg-card/60 px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground/90">
              <span className="text-muted-foreground">$</span> npx -y{" "}
              <span className="text-orange-500">@wraps.dev/mcp</span>
            </pre>

            <p className="mb-6 max-w-md text-muted-foreground">
              Six tools over the AWS SES stack in your account — send history,
              delivery events, domain status, suppressions, and guarded sending.
              Runs locally over stdio; your credentials never leave your
              machine.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="bg-orange-500 text-white hover:bg-orange-600"
                size="lg"
              >
                <Link href="/docs/mcp-reference">
                  Read the MCP docs
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a
                  href="https://www.npmjs.com/package/@wraps.dev/mcp"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <BookOpen className="size-4" />
                  View on npm
                </a>
              </Button>
            </div>
          </div>

          {/* Right column — the tool surface */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-orange-500/10 opacity-60 blur-2xl" />
            <div className="relative overflow-hidden rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 border-border border-b px-4 py-2.5">
                <span className="size-1.5 rounded-full bg-orange-500" />
                <span className="font-mono text-muted-foreground text-xs">
                  wraps · 6 tools
                </span>
              </div>
              <ul className="divide-y divide-border">
                {tools.map((tool) => (
                  <li
                    className="flex items-center justify-between gap-3 px-4 py-3"
                    key={tool.name}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[13px] text-foreground/90">
                        {tool.name}
                      </p>
                      <p className="truncate text-muted-foreground text-xs">
                        {tool.description}
                      </p>
                    </div>
                    <Badge
                      className={
                        tool.write
                          ? "shrink-0 border-orange-500/40 text-orange-500"
                          : "shrink-0 text-muted-foreground"
                      }
                      variant="outline"
                    >
                      {tool.write ? "write" : "read"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
