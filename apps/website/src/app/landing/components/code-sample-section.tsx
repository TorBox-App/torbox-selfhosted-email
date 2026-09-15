"use client";

import { Button } from "@wraps/ui/components/ui/button";
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
import { Github } from "@/components/ui/svgs/brand-icons";
import { SectionKicker } from "./section-kicker";

const sampleCode = `// Install: npm i @wraps.dev/email
import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail();

await email.send({
  from: 'hello@acme.com',
  to: user.email,
  subject: 'Welcome to Acme',
  react: <WelcomeEmail name={user.name} />,
});`;

const codeData = [
  { language: "tsx", filename: "src/emails/welcome.tsx", code: sampleCode },
];

export function CodeSampleSection() {
  return (
    <section className="border-border border-b py-20 md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-16 lg:px-8">
        {/* Copy */}
        <div>
          <SectionKicker>TypeScript SDK</SectionKicker>
          <h2 className="font-heading font-semibold text-3xl text-foreground leading-none tracking-tight md:text-4xl">
            Send an email. That&apos;s the whole API.
          </h2>
          <p className="mt-4 max-w-[52ch] text-lg text-muted-foreground leading-relaxed">
            One import, one client, one call. Events stream to DynamoDB in your
            account — query them yourself or use the dashboard.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="cursor-pointer" variant="brand">
              <a href="/docs/sdk-reference">Read the docs</a>
            </Button>
            <Button asChild className="cursor-pointer" variant="outline">
              <a
                href="https://github.com/wraps-team/wraps"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Github aria-hidden="true" className="size-4" />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>

        {/* Code */}
        <CodeBlock className="h-auto" data={codeData} defaultValue="tsx">
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
    </section>
  );
}
