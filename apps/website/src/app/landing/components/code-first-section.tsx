"use client";

import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockItem,
} from "@/components/ui/shadcn-io/code-block";

const templateCode = `// emails/welcome.tsx
import { Button, Heading, Text } from '@wraps.dev/email';

interface WelcomeProps {
  name: string;
  activationUrl: string;
}

export default function Welcome({ name, activationUrl }: WelcomeProps) {
  return (
    <>
      <Heading>Welcome, {name}</Heading>
      <Text>Your account is ready. Let's get you set up.</Text>
      <Button href={activationUrl}>Activate your account</Button>
    </>
  );
}`;

const workflowCode = `// workflows/welcome-series.ts
import { defineWorkflow, sendEmail, delay, condition } from '@wraps.dev/client';

export default defineWorkflow({
  name: 'Welcome Series',
  trigger: { type: 'contact_created' },
  steps: [
    sendEmail('welcome', { template: 'welcome-email' }),
    delay('wait-1-day', { days: 1 }),
    condition('setup-complete', {
      field: 'contact.hasCompletedSetup',
      operator: 'equals',
      value: true,
      branches: {
        yes: [sendEmail('success', { template: 'success-story' })],
        no: [sendEmail('nudge', { template: 'setup-nudge' })],
      },
    }),
  ],
});`;

const templateData = [
  { language: "tsx", filename: "emails/welcome.tsx", code: templateCode },
];

const workflowData = [
  {
    language: "typescript",
    filename: "workflows/welcome-series.ts",
    code: workflowCode,
  },
];

export function CodeFirstSection() {
  return (
    <section className="py-24" id="code-first">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 animate-fade-in-up">
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            Every other email platform traps your work in a dashboard.
          </h2>
          <p className="max-w-3xl text-lg text-muted-foreground">
            Templates live in their editor. Workflows live in their builder. No
            version control. No type checking. No code review. One bad edit and
            you're manually restoring from a screenshot.
          </p>
        </div>

        {/* Code examples */}
        <div className="space-y-10 animate-fade-in-up animation-delay-100">
          {/* Template example */}
          <div>
            <CodeBlock data={templateData} defaultValue="tsx">
              <CodeBlockBody>
                {(item) => (
                  <CodeBlockItem key={item.language} value={item.language}>
                    <CodeBlockContent language={item.language}>
                      {item.code}
                    </CodeBlockContent>
                    <CodeBlockCopyButton />
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
            <p className="mt-3 text-sm text-muted-foreground">
              JSX. Typed props. Component composition. Reviewed in your PR, not
              a screenshot in Slack.
            </p>
          </div>

          {/* Workflow example */}
          <div>
            <CodeBlock data={workflowData} defaultValue="typescript">
              <CodeBlockBody>
                {(item) => (
                  <CodeBlockItem key={item.language} value={item.language}>
                    <CodeBlockContent language={item.language}>
                      {item.code}
                    </CodeBlockContent>
                    <CodeBlockCopyButton />
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
            <p className="mt-3 text-sm text-muted-foreground">
              Delays. Conditions. Branching. Version-controlled and testable.
              Not trapped in a drag-and-drop canvas you can't grep.
            </p>
          </div>
        </div>

        {/* Section closer */}
        <div className="mt-12 animate-fade-in-up animation-delay-200">
          <p className="text-lg text-muted-foreground">
            The CLI compiles templates to HTML and deploys workflows to your AWS.
            Your email infrastructure ships with your product.
          </p>
          <a
            className="mt-4 inline-flex items-center text-sm font-medium text-orange-500 hover:text-orange-600"
            href="/docs/quickstart/email"
          >
            Read the docs →
          </a>
        </div>
      </div>
    </section>
  );
}
