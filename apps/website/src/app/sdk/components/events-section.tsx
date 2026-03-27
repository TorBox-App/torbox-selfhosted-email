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

const trackCode = `import { createPlatformClient } from "@wraps.dev/client";

const wraps = createPlatformClient({ apiKey: process.env.WRAPS_API_KEY });

// Emit an event — triggers any workflow listening for "order.completed"
await wraps.track("order.completed", {
  contactEmail: "alice@example.com",
  properties: {
    orderId: "ord_8f3k2",
    amount: 149,
    plan: "pro",
  },
});`;

const batchCode = `// Track multiple events in one request
await wraps.trackBatch([
  {
    name: "page.viewed",
    contactEmail: "alice@example.com",
    properties: { page: "/pricing" },
  },
  {
    name: "feature.used",
    contactEmail: "bob@example.com",
    properties: { feature: "api-keys" },
  },
]);`;

const workflowCode = `// This workflow triggers automatically when "order.completed" fires
export default defineWorkflow({
  name: "Post-Purchase",
  trigger: { type: "event", eventName: "order.completed" },

  steps: [
    sendEmail("receipt", { template: "order-receipt" }),
    delay("wait-3d", { days: 3 }),
    sendEmail("review", { template: "ask-for-review" }),
  ],
});`;

const codeData = [
  { language: "track", filename: "app/checkout.ts", code: trackCode },
  { language: "batch", filename: "app/analytics.ts", code: batchCode },
  {
    language: "workflow",
    filename: "wraps/workflows/post-purchase.ts",
    code: workflowCode,
  },
];

export function SdkEventsSection() {
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
            3
          </div>
          <div>
            <p className="font-medium text-orange-500 text-sm">Trigger</p>
            <h2 className="font-bold text-2xl tracking-tight sm:text-3xl">
              Custom Events
            </h2>
          </div>
        </motion.div>

        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="text-lg text-muted-foreground">
              Emit events from anywhere in your app.{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                wraps.track()
              </code>{" "}
              fires the event &mdash; workflows listening for that event name
              execute automatically.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Any event name</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash;{" "}
                    <code className="font-mono text-xs">user.signed_up</code>,{" "}
                    <code className="font-mono text-xs">order.completed</code>,{" "}
                    <code className="font-mono text-xs">trial.expiring</code>
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Typed properties</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; attach any JSON payload, available in templates and
                    conditions
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">Batch support</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; send multiple events in a single API call
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm">
                  <span className="font-medium">
                    Automatic contact resolution
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; match events to contacts by email or ID
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  How it works:
                </span>{" "}
                Call{" "}
                <code className="font-mono text-xs">
                  wraps.track("order.completed")
                </code>{" "}
                from your checkout flow. Any workflow with{" "}
                <code className="font-mono text-xs">
                  trigger: {"{"} eventName: "order.completed" {"}"}
                </code>{" "}
                runs automatically.
              </p>
            </div>

            <a
              className="inline-flex items-center gap-1 font-medium text-orange-500 text-sm hover:text-orange-600"
              href="/docs/sdk-reference/events"
            >
              Events reference
              <ArrowRight className="size-3" />
            </a>
          </div>

          <motion.div
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <CodeBlock data={codeData} defaultValue="track">
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
                    <CodeBlockContent language="typescript">
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
