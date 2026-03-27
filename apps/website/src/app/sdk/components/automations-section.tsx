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

const workflowCode = `import {
  condition,
  defineWorkflow,
  delay,
  sendEmail,
  waitForEvent,
} from "@wraps.dev/client";

export default defineWorkflow({
  name: "Onboarding Drip",
  trigger: { type: "event", eventName: "user.signed_up" },

  steps: [
    sendEmail("welcome", { template: "welcome-email" }),

    delay("wait-1d", { days: 1 }),

    waitForEvent("wait-setup", {
      eventName: "account.setup_completed",
      timeout: { days: 2 },
    }),

    condition("check-setup", {
      field: "contact.hasCompletedSetup",
      operator: "is_true",
      branches: {
        yes: [sendEmail("tips", { template: "power-user-tips" })],
        no: [sendEmail("nudge", { template: "complete-setup" })],
      },
    }),
  ],
});`;

const pushCode = `$ wraps automations push

  Push Workflows

  ◆  Found 2 workflows in ./wraps/workflows
  │
  ◇  Validated onboarding-drip (6 steps, 2 templates)
  ◇  Validated trial-expiry (4 steps, 1 template)
  │
  ◆  Deployed 2 workflows`;

const codeData = [
  {
    language: "ts",
    filename: "wraps/workflows/onboarding.ts",
    code: workflowCode,
  },
  { language: "bash", filename: "Terminal", code: pushCode },
];

export function SdkAutomationsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      className="relative bg-stone-100/50 py-24 dark:bg-white/[0.06]"
      ref={ref}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          className="mb-16 flex items-center gap-4"
          initial={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-orange-500 font-bold text-white">
            2
          </div>
          <div>
            <p className="font-medium text-orange-500 text-sm">Automate</p>
            <h2 className="font-bold text-2xl tracking-tight sm:text-3xl">
              Automations as Code
            </h2>
          </div>
        </motion.div>

        <div className="grid items-start gap-12 lg:grid-cols-2">
          <motion.div
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            className="order-2 lg:order-1"
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <CodeBlock data={codeData} defaultValue="ts">
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
                        item.language === "bash" ? "bash" : "typescript"
                      }
                    >
                      {item.code}
                    </CodeBlockContent>
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
          </motion.div>

          <div className="order-1 space-y-6 lg:order-2">
            <p className="text-lg text-muted-foreground">
              Define workflows in TypeScript. Triggers, conditions, delays,
              branching &mdash; all type-checked. Deploy with{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                wraps automations push
              </code>
              .
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Event triggers</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; start workflows from signups, purchases, or any
                    custom event
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Wait for events</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; pause until a specific action happens, with
                    configurable timeouts
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Conditional branching</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; route contacts based on properties, behavior, or
                    event data
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Multi-channel</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; send email, SMS, or fire webhooks in the same
                    workflow
                  </span>
                </p>
              </div>
            </div>

            <a
              className="inline-flex items-center gap-1 font-medium text-orange-500 text-sm hover:text-orange-600"
              href="/docs/guides/workflows"
            >
              Workflow guide
              <ArrowRight className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
