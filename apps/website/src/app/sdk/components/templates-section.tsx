"use client";

import { ArrowRight } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
  CodeBlockSelect,
  CodeBlockSelectContent,
  CodeBlockSelectItem,
  CodeBlockSelectTrigger,
  CodeBlockSelectValue,
} from "@/components/ui/shadcn-io/code-block";

const templateCode = `import { Body, Container, Heading, Text, Button } from "@react-email/components";

export const subject = "Welcome to {{companyName}}";
export const emailType = "transactional" as const;

type Props = {
  name: string;
  companyName: string;
  loginUrl: string;
};

export default function WelcomeEmail({ name, companyName, loginUrl }: Props) {
  return (
    <Body>
      <Container>
        <Heading>Welcome, {name}</Heading>
        <Text>Thanks for joining {companyName}.</Text>
        <Button href={loginUrl}>Get Started</Button>
      </Container>
    </Body>
  );
}`;

const configCode = `import { defineConfig } from "@wraps.dev/email";

export default defineConfig({
  org: "acme",
  from: { email: "hello@acme.com", name: "Acme" },
  region: "us-east-1",
  templatesDir: "./templates",
  brandFile: "./brand.ts",
});`;

const pushCode = `$ wraps templates push

  Push Templates

  ◆  Found 3 templates in ./wraps/templates
  │
  ◇  Compiled welcome-email (2 variables)
  ◇  Compiled order-confirmation (5 variables)
  ◇  Compiled password-reset (1 variable)
  │
  ◆  Pushed 3 templates to SES`;

const codeData = [
  {
    language: "tsx",
    filename: "wraps/templates/welcome.tsx",
    code: templateCode,
  },
  { language: "ts", filename: "wraps/wraps.config.ts", code: configCode },
  { language: "bash", filename: "Terminal", code: pushCode },
];

export function SdkTemplatesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-24" ref={ref}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          className="mb-16 flex items-center gap-4"
          initial={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-orange-500 font-bold text-white">
            1
          </div>
          <div>
            <p className="font-medium text-orange-500 text-sm">Define</p>
            <h2 className="font-bold text-2xl tracking-tight sm:text-3xl">
              Templates as Code
            </h2>
          </div>
        </motion.div>

        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="text-lg text-muted-foreground">
              Write email templates as React components. Type-safe variables,
              version-controlled, reviewed in PRs. Push to SES with one command.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">React Email components</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; renders correctly in Gmail, Outlook, Apple Mail
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Typed variables</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; catch missing data at compile time, not in
                    production
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">
                    <code className="font-mono text-xs">
                      wraps templates push
                    </code>
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; compiles, validates, and deploys to SES
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Brand kits</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; shared colors, fonts, and logo across all templates
                  </span>
                </p>
              </div>
            </div>

            <a
              className="inline-flex items-center gap-1 font-medium text-orange-500 text-sm hover:text-orange-600"
              href="/docs/guides/templates"
            >
              Template guide
              <ArrowRight className="size-3" />
            </a>
          </div>

          <motion.div
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <CodeBlock data={codeData} defaultValue="tsx">
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
                <CodeBlockSelect>
                  <CodeBlockSelectTrigger>
                    <CodeBlockSelectValue />
                  </CodeBlockSelectTrigger>
                  <CodeBlockSelectContent>
                    {(item) => (
                      <CodeBlockSelectItem
                        key={item.language}
                        value={item.language}
                      >
                        {item.filename}
                      </CodeBlockSelectItem>
                    )}
                  </CodeBlockSelectContent>
                </CodeBlockSelect>
                <CodeBlockCopyButton />
              </CodeBlockHeader>
              <CodeBlockBody>
                {(item) => (
                  <CodeBlockItem key={item.language} value={item.language}>
                    <CodeBlockContent
                      language={
                        item.language === "tsx"
                          ? "tsx"
                          : item.language === "bash"
                            ? "bash"
                            : "typescript"
                      }
                    >
                      {item.code}
                    </CodeBlockContent>
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
