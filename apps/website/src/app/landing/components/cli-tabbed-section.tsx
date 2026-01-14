"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Code2,
  Globe,
  History,
  Key,
  LayoutDashboard,
  ListFilter,
  Send,
  Shield,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
} from "@/components/ui/shadcn-io/code-block";
import {
  Snippet,
  SnippetCopyButton,
  SnippetHeader,
  SnippetTabsContent,
  SnippetTabsList,
  SnippetTabsTrigger,
} from "@/components/ui/shadcn-io/snippet";
import { assetUrl, cn } from "@/lib/utils";
import { InteractiveArchitectureDiagram } from "./architecture-section";
import { IconBox, SectionWrapper } from "./section-card";

type TabKey = "console" | "deploy" | "send";

const consoleFeatures = [
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Track sends, deliveries, opens, clicks, bounces in real-time",
  },
  {
    icon: History,
    title: "Message History",
    description: "Search and filter through your email history with timelines",
  },
  {
    icon: ListFilter,
    title: "Suppression Lists",
    description: "View and manage bounce/complaint suppression automatically",
  },
  {
    icon: Globe,
    title: "Domain Management",
    description: "View verification status, DKIM records, and DNS config",
  },
  {
    icon: Shield,
    title: "Reputation Metrics",
    description: "Monitor sender reputation, bounce rates, complaint ratios",
  },
  {
    icon: Key,
    title: "SMTP Credentials",
    description: "Generate SMTP credentials for legacy integrations",
  },
];

const installCommands = {
  npm: "npm install @wraps.dev/email",
  pnpm: "pnpm add @wraps.dev/email",
  yarn: "yarn add @wraps.dev/email",
  bun: "bun add @wraps.dev/email",
};

const cliExample = `# Deploy infrastructure to AWS
npx @wraps.dev/cli email init

# Add and verify your domain
npx @wraps.dev/cli email domains add -d yourdomain.com
npx @wraps.dev/cli email domains verify -d yourdomain.com`;

const sdkExample = `import { Wraps } from '@wraps.dev/email';

const wraps = new Wraps();

const result = await wraps.emails.send({
  from: 'hello@yourdomain.com',
  to: 'user@example.com',
  subject: 'Welcome to our app!',
  html: '<h1>Welcome!</h1>',
});`;

function DeployContent() {
  return (
    <div className="space-y-8">
      {/* Code section */}
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <IconBox highlighted icon={Terminal} />
          <div>
            <h3 className="font-semibold text-orange-500">
              Deploy Infrastructure
            </h3>
            <p className="text-muted-foreground text-sm">
              One command deploys everything to AWS
            </p>
          </div>
        </div>

        <CodeBlock
          className="h-auto"
          data={[{ language: "bash", filename: "terminal", code: cliExample }]}
          defaultValue="bash"
        >
          <CodeBlockHeader>
            <CodeBlockFiles>
              {(item) => (
                <CodeBlockFilename key={item.language} value={item.language}>
                  {item.filename}
                </CodeBlockFilename>
              )}
            </CodeBlockFiles>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
          <CodeBlockBody>
            {(item) => (
              <CodeBlockItem
                key={item.language}
                lineNumbers={false}
                value={item.language}
              >
                <CodeBlockContent language={item.language}>
                  {item.code}
                </CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>

        <div className="grid gap-2 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
          {[
            "Validates AWS credentials",
            "Shows cost estimates",
            "Deploys automatically",
            "Zero stored credentials",
          ].map((item) => (
            <div className="flex items-center gap-2" key={item}>
              <Check className="size-4 text-orange-500" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture diagram showing deploy flow */}
      <div className="mx-auto max-w-2xl">
        <InteractiveArchitectureDiagram
          compact
          defaultTab="deploy"
          showTabBar={false}
        />
      </div>

      <div className="flex justify-center gap-4">
        <Button asChild className="bg-orange-500 hover:bg-orange-600" size="lg">
          <a href="/docs/quickstart">
            View Quickstart
            <ArrowRight className="ml-2 size-4" />
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="/cli">Learn About CLI</a>
        </Button>
      </div>
    </div>
  );
}

function SendContent() {
  return (
    <div className="space-y-8">
      {/* Code section */}
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <IconBox highlighted icon={Code2} />
          <div>
            <h3 className="font-semibold text-orange-500">
              Install SDK & Send
            </h3>
            <p className="text-muted-foreground text-sm">
              Add the package and start sending
            </p>
          </div>
        </div>

        <Snippet className="mb-4" defaultValue="npm">
          <SnippetHeader>
            <SnippetTabsList>
              <SnippetTabsTrigger value="npm">npm</SnippetTabsTrigger>
              <SnippetTabsTrigger value="pnpm">pnpm</SnippetTabsTrigger>
              <SnippetTabsTrigger value="yarn">yarn</SnippetTabsTrigger>
              <SnippetTabsTrigger value="bun">bun</SnippetTabsTrigger>
            </SnippetTabsList>
            <SnippetCopyButton
              className="opacity-100"
              value={installCommands.npm}
            />
          </SnippetHeader>
          {Object.entries(installCommands).map(([key, command]) => (
            <SnippetTabsContent key={key} value={key}>
              {command}
            </SnippetTabsContent>
          ))}
        </Snippet>

        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "typescript",
              filename: "send-email.ts",
              code: sdkExample,
            },
          ]}
          defaultValue="typescript"
        >
          <CodeBlockHeader>
            <CodeBlockFiles>
              {(item) => (
                <CodeBlockFilename key={item.language} value={item.language}>
                  {item.filename}
                </CodeBlockFilename>
              )}
            </CodeBlockFiles>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
          <CodeBlockBody>
            {(item) => (
              <CodeBlockItem
                key={item.language}
                lineNumbers={false}
                value={item.language}
              >
                <CodeBlockContent language={item.language}>
                  {item.code}
                </CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>
      </div>

      {/* Architecture diagram showing send flow */}
      <div className="mx-auto max-w-2xl">
        <InteractiveArchitectureDiagram
          compact
          defaultTab="send"
          showTabBar={false}
        />
      </div>

      <div className="flex justify-center gap-4">
        <Button asChild className="bg-orange-500 hover:bg-orange-600" size="lg">
          <a href="/docs/sdk-reference">
            SDK Reference
            <ArrowRight className="ml-2 size-4" />
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="/docs/quickstart">View Quickstart</a>
        </Button>
      </div>
    </div>
  );
}

function ConsoleContent() {
  return (
    <div className="space-y-8">
      {/* Large browser window mockup */}
      <div className="group relative mx-auto max-w-4xl">
        {/* Glow effect */}
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-orange-500/20 opacity-50 blur-3xl transition-opacity duration-700 group-hover:opacity-70" />

        {/* Browser window */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-orange-500/20 bg-background shadow-2xl dark:border-orange-500/30">
          {/* Browser chrome */}
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-red-500" />
                <div className="size-3 rounded-full bg-yellow-500" />
                <div className="size-3 rounded-full bg-green-500" />
              </div>
              <div className="hidden items-center gap-2 rounded-md bg-background/80 px-3 py-1 sm:flex">
                <div className="size-3 rounded-full bg-green-500/50" />
                <span className="font-mono text-muted-foreground text-xs">
                  localhost:5555
                </span>
              </div>
            </div>
            <span className="hidden rounded bg-orange-500/10 px-2 py-0.5 font-medium text-orange-600 text-xs sm:inline dark:text-orange-400">
              Local Mode
            </span>
          </div>

          {/* Screenshot */}
          <div className="relative aspect-[16/10] overflow-hidden bg-muted/20">
            <img
              alt="Wraps Console - Light Mode"
              className="block size-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02] dark:hidden"
              decoding="async"
              loading="lazy"
              src={assetUrl("Wraps-Console.gif")}
            />
            <img
              alt="Wraps Console - Dark Mode"
              className="hidden size-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02] dark:block"
              decoding="async"
              loading="lazy"
              src={assetUrl("Wraps-Console.gif")}
            />

            {/* Fade overlay at bottom */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/60 to-transparent" />
          </div>
        </div>
      </div>

      {/* Feature pills */}
      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {consoleFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              className="flex flex-col items-center rounded-xl border bg-muted/30 p-4 text-center transition-colors hover:border-orange-500/50"
              key={feature.title}
            >
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Icon className="size-5 text-orange-500" />
              </div>
              <h4 className="mb-1 font-semibold text-sm">{feature.title}</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="flex justify-center gap-4">
        <Button asChild className="bg-orange-500 hover:bg-orange-600" size="lg">
          <a href="/docs/quickstart">
            Get Started
            <ArrowRight className="ml-2 size-4" />
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="/cli">Learn About CLI</a>
        </Button>
      </div>
    </div>
  );
}

type GlowingTabProps = {
  tabs: { key: TabKey; label: string; icon: LucideIcon }[];
  activeTab: TabKey;
  onTabChange: (key: TabKey) => void;
};

function GlowingTabBar({ tabs, activeTab, onTabChange }: GlowingTabProps) {
  return (
    <div className="mb-8 flex justify-center">
      {/* Outer glow container */}
      <div className="relative">
        {/* Background glow effect */}
        <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl dark:bg-orange-500/10" />

        {/* Tab container with glass effect */}
        <div className="relative inline-flex gap-1 rounded-full border border-orange-500/20 bg-background/80 p-1.5 shadow-lg backdrop-blur-sm dark:border-orange-500/30 dark:bg-background/50">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;

            return (
              <button
                className={cn(
                  "group relative flex items-center gap-2 overflow-hidden rounded-full px-5 py-2.5 font-medium text-sm transition-all duration-300",
                  isActive
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : "text-muted-foreground hover:bg-orange-500/10 hover:text-foreground dark:hover:bg-orange-500/20"
                )}
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                type="button"
              >
                {/* Active tab glow */}
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-orange-500 blur-md opacity-50" />
                )}

                <Icon
                  className={cn(
                    "relative size-4 transition-transform duration-300",
                    isActive
                      ? "scale-110"
                      : "group-hover:scale-110 group-hover:text-orange-500"
                  )}
                />

                <span className="relative hidden sm:inline">{tab.label}</span>

                {/* Shimmer effect for inactive tabs - staggered for ripple effect */}
                {!isActive && (
                  <div
                    className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-orange-500/10 to-transparent"
                    style={{ animationDelay: `${index * 0.3}s` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CliTabbedSection() {
  const [activeTab, setActiveTab] = useState<TabKey>("console");

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: "console", label: "Console", icon: LayoutDashboard },
    { key: "deploy", label: "Deploy", icon: Terminal },
    { key: "send", label: "Send", icon: Send },
  ];

  return (
    <SectionWrapper
      badge="Free Forever"
      badgeColor="green"
      badgeLink="/cli"
      description="Deploy production-ready infrastructure to your AWS account. CLI, TypeScript SDK, and local console included."
      id="cli"
      title="CLI + SDK + Local Console"
    >
      <GlowingTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
      />

      {/* Tab content */}
      <div className="min-h-[500px]">
        {activeTab === "console" && <ConsoleContent />}
        {activeTab === "deploy" && <DeployContent />}
        {activeTab === "send" && <SendContent />}
      </div>
    </SectionWrapper>
  );
}
