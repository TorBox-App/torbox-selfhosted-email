"use client";

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
import { PRICING_COPY } from "@/config/pricing";

const EVENT_CODE = `await wraps.track('order.completed', {
  contactEmail: 'jane@acme.co',
  properties: { orderId: '123', plan: 'growth' },
})`;

const codeData = [
  { language: "typescript", filename: "events.ts", code: EVENT_CODE },
];

export function TrackedEventsExplainer() {
  return (
    <div className="mx-auto max-w-3xl">
      <h3 className="mb-2 text-center font-bold text-2xl tracking-tight">
        {PRICING_COPY.trackedEventsHeadline}
      </h3>
      <p className="mb-8 text-center text-muted-foreground">
        {PRICING_COPY.trackedEventsSubline}
      </p>

      <div className="mx-auto max-w-2xl">
        <CodeBlock
          className="h-auto"
          data={codeData}
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

        <p className="mt-4 text-muted-foreground text-xs">
          Emails, contacts, opens, clicks, and deliveries never count.
        </p>
      </div>
    </div>
  );
}
