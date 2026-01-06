"use client";

import {
  ArrowRight,
  Check,
  Cloud,
  Code2,
  Gauge,
  Lock,
  Mail,
  Send,
  Shield,
  Terminal,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { Image3D } from "@/components/image-3d";
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
import { InteractiveArchitectureDiagram } from "./architecture-section";
import { IconBox, SectionWrapper } from "./section-card";

type TabKey = "deploy" | "send" | "features";

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

const mainFeatures = [
  {
    icon: Terminal,
    title: "One-Command Deploy",
    description: "Production-ready email infrastructure in under 2 minutes.",
  },
  {
    icon: Mail,
    title: "TypeScript-First SDK",
    description: "Clean API with full type safety. Just wraps.emails.send().",
  },
  {
    icon: Gauge,
    title: "Event Tracking",
    description: "Delivery, open, and click tracking stored in DynamoDB.",
  },
  {
    icon: Lock,
    title: "Zero Stored Credentials",
    description: "OIDC and IAM roles - we never see your AWS keys.",
  },
];

const secondaryFeatures = [
  {
    icon: Cloud,
    title: "AWS Pricing, No Markup",
    description: "Pay AWS directly at $0.10 per 1,000 emails.",
  },
  {
    icon: Shield,
    title: "Production-Ready Configs",
    description: "Pre-configured presets for different needs.",
  },
  {
    icon: Terminal,
    title: "Local-First Dashboard",
    description: "Run the console locally with zero setup.",
  },
  {
    icon: Workflow,
    title: "Future-Proof Roadmap",
    description: "Email today, SMS and workflows coming soon.",
  },
];

function DeployContent() {
  return (
    <div className="space-y-8">
      {/* Code section */}
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <IconBox highlighted icon={Terminal} />
          <div>
            <h3 className="font-semibold text-orange-500">Deploy Infrastructure</h3>
            <p className="text-muted-foreground text-sm">One command deploys everything to AWS</p>
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
              <CodeBlockItem key={item.language} lineNumbers={false} value={item.language}>
                <CodeBlockContent language={item.language}>{item.code}</CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>

        <div className="grid gap-2 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
          {["Validates AWS credentials", "Shows cost estimates", "Deploys automatically", "Zero stored credentials"].map((item) => (
            <div className="flex items-center gap-2" key={item}>
              <Check className="size-4 text-orange-500" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture diagram showing deploy flow */}
      <div className="mx-auto max-w-2xl">
        <InteractiveArchitectureDiagram compact defaultTab="deploy" showTabBar={false} />
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
            <h3 className="font-semibold text-orange-500">Install SDK & Send</h3>
            <p className="text-muted-foreground text-sm">Add the package and start sending</p>
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
            <SnippetCopyButton className="opacity-100" value={installCommands.npm} />
          </SnippetHeader>
          {Object.entries(installCommands).map(([key, command]) => (
            <SnippetTabsContent key={key} value={key}>
              {command}
            </SnippetTabsContent>
          ))}
        </Snippet>

        <CodeBlock
          className="h-auto"
          data={[{ language: "typescript", filename: "send-email.ts", code: sdkExample }]}
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
              <CodeBlockItem key={item.language} lineNumbers={false} value={item.language}>
                <CodeBlockContent language={item.language}>{item.code}</CodeBlockContent>
              </CodeBlockItem>
            )}
          </CodeBlockBody>
        </CodeBlock>
      </div>

      {/* Architecture diagram showing send flow */}
      <div className="mx-auto max-w-2xl">
        <InteractiveArchitectureDiagram compact defaultTab="send" showTabBar={false} />
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

function FeaturesContent() {
  return (
    <div className="space-y-12">
      {/* First row - Image left, features right */}
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <Image3D
          alt="Analytics dashboard"
          darkSrc="feature-1-dark.webp"
          direction="left"
          lightSrc="feature-1-light.webp"
        />
        <div className="space-y-4">
          <h3 className="font-semibold text-xl">Everything You Need</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {mainFeatures.map((feature) => (
              <li className="flex items-start gap-3" key={feature.title}>
                <IconBox highlighted icon={feature.icon} size="sm" />
                <div>
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-muted-foreground text-xs">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Second row - Features left, image right */}
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className="order-2 space-y-4 lg:order-1">
          <h3 className="font-semibold text-xl">Send, Track, Iterate</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {secondaryFeatures.map((feature) => (
              <li className="flex items-start gap-3" key={feature.title}>
                <IconBox highlighted icon={feature.icon} size="sm" />
                <div>
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-muted-foreground text-xs">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Image3D
          alt="Performance dashboard"
          className="order-1 lg:order-2"
          darkSrc="feature-2-dark.webp"
          direction="right"
          lightSrc="feature-2-light.webp"
        />
      </div>

      <div className="flex justify-center gap-4">
        <Button asChild className="bg-orange-500 hover:bg-orange-600" size="lg">
          <a href="/docs">
            Read the Docs
            <ArrowRight className="ml-2 size-4" />
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="https://github.com/wraps-team/wraps" rel="noopener noreferrer" target="_blank">
            View on GitHub
          </a>
        </Button>
      </div>
    </div>
  );
}

export function CliTabbedSection() {
  const [activeTab, setActiveTab] = useState<TabKey>("deploy");

  const tabs = [
    { key: "deploy" as const, label: "Deploy", icon: Terminal },
    { key: "send" as const, label: "Send", icon: Send },
    { key: "features" as const, label: "Features", icon: Gauge },
  ];

  return (
    <SectionWrapper
      badge="Free · CLI + SDK"
      description="Skip the AWS Console. Deploy production-ready email infrastructure in under 2 minutes."
      id="cli"
      title="Built for Developers"
    >
      {/* Main tab bar */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border bg-background p-1">
          {tabs.map((tab) => (
            <button
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 font-medium text-sm transition-all ${
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <tab.icon className="size-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[500px]">
        {activeTab === "deploy" && <DeployContent />}
        {activeTab === "send" && <SendContent />}
        {activeTab === "features" && <FeaturesContent />}
      </div>
    </SectionWrapper>
  );
}
