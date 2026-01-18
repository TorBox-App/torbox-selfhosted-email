"use client";

import {
  ArrowRight,
  Blocks,
  Book,
  Box,
  Layers,
  Mail,
  MessageSquare,
  Rocket,
  Terminal,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const quickStartCode = `# Deploy infrastructure to AWS
npx @wraps.dev/cli init

# Install SDK
npm install @wraps.dev/email

# Send your first email
import { Wraps } from '@wraps.dev/email'
const wraps = new Wraps()
await wraps.emails.send({ ... })`;

const quickLinks = [
  {
    icon: Rocket,
    title: "Quickstart",
    description: "Deploy your first email infrastructure in 2 minutes",
    href: "/docs/quickstart",
    disabled: false,
  },
  {
    icon: Blocks,
    title: "Platform SDK",
    description: "Type-safe API client for contacts, batches, and more",
    href: "/docs/client-sdk-reference",
    disabled: false,
  },
  {
    icon: Mail,
    title: "Email SDK",
    description: "Learn how to use @wraps.dev/email in your application",
    href: "/docs/sdk-reference",
    disabled: false,
  },
  {
    icon: MessageSquare,
    title: "SMS SDK",
    description: "Send SMS with @wraps.dev/sms through AWS",
    href: "/docs/sms-sdk-reference",
    disabled: false,
  },
  {
    icon: Layers,
    title: "CDK Construct",
    description: "Deploy with AWS CDK infrastructure as code",
    href: "/docs/cdk-reference",
    disabled: false,
  },
  {
    icon: Box,
    title: "Pulumi Component",
    description: "Deploy with Pulumi infrastructure as code",
    href: "/docs/pulumi-reference",
    disabled: false,
  },
  {
    icon: Terminal,
    title: "CLI Commands",
    description: "Complete reference for all wraps CLI commands",
    href: "/docs/cli-reference",
    disabled: false,
  },
  {
    icon: Book,
    title: "Guides",
    description: "Production access, domain verification, and more",
    href: "/docs/guides",
    disabled: false,
  },
];

export default function DocsPageContent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <a className="flex items-center" href="/">
              <Logo size={28} />
            </a>
            <Button asChild variant="ghost">
              <a href="/">Back to Home</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4" variant="outline">
              Documentation
            </Badge>
            <h1 className="mb-6 font-bold text-4xl tracking-tight sm:text-5xl">
              Get Started with Wraps
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Deploy production-ready email infrastructure to your AWS account
              in minutes. Learn how to use the CLI, SDK, and console.
            </p>

            {/* Quick Start Code Example */}
            <div className="mb-8 text-left">
              <div className="mb-2 text-muted-foreground text-sm">
                Get started in 3 commands:
              </div>
              <CodeBlock
                className="h-auto"
                data={[
                  {
                    language: "bash",
                    filename: "terminal.sh",
                    code: quickStartCode,
                  },
                ]}
                defaultValue="bash"
              >
                <CodeBlockHeader>
                  <CodeBlockFiles>
                    {(item) => (
                      <CodeBlockFilename
                        key={item.language}
                        value={item.language}
                      >
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

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <a href="/docs/quickstart">
                  Quickstart Guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/docs/sdk-reference">SDK Reference</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-8 text-center font-bold text-2xl">
              Documentation
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <Card
                  className={
                    link.disabled
                      ? "opacity-60"
                      : "transition-colors hover:border-primary/50"
                  }
                  key={link.href}
                >
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">
                      {link.title}
                      {link.disabled && (
                        <span className="ml-2 text-muted-foreground text-xs">
                          (Coming Soon)
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {link.disabled ? (
                      <Button className="w-full" disabled variant="ghost">
                        Coming Soon
                      </Button>
                    ) : (
                      <Button asChild className="w-full" variant="ghost">
                        <a href={link.href}>
                          Read more
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Additional Resources */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center font-bold text-2xl">
              Additional Resources
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>GitHub Repository</CardTitle>
                  <CardDescription>
                    View source code, report issues, and contribute
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <a
                      href="https://github.com/wraps-team/wraps"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View on GitHub
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform SDK</CardTitle>
                  <CardDescription>
                    View @wraps.dev/client package on npm
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <a
                      href="https://www.npmjs.com/package/@wraps.dev/client"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View on npm
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Email SDK</CardTitle>
                  <CardDescription>
                    View @wraps.dev/email package on npm
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <a
                      href="https://www.npmjs.com/package/@wraps.dev/email"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View on npm
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SMS SDK</CardTitle>
                  <CardDescription>
                    View @wraps.dev/sms package on npm
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <a
                      href="https://www.npmjs.com/package/@wraps.dev/sms"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View on npm
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>CDK Construct</CardTitle>
                  <CardDescription>
                    View @wraps.dev/cdk package on npm
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <a
                      href="https://www.npmjs.com/package/@wraps.dev/cdk"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View on npm
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pulumi Component</CardTitle>
                  <CardDescription>
                    View @wraps.dev/pulumi package on npm
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <a
                      href="https://www.npmjs.com/package/@wraps.dev/pulumi"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View on npm
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
