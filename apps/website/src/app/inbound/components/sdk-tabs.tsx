"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";

const jsonPreview = `{
  "emailId": "inb_a1b2c3d4",
  "receivedAt": "2024-01-15T10:30:00Z",
  "from": {
    "address": "customer@example.com",
    "name": "John Doe"
  },
  "to": [
    { "address": "support@yourapp.com" }
  ],
  "subject": "Order #12345 Question",
  "html": "<p>Hi, I have a question...</p>",
  "text": "Hi, I have a question...",
  "attachments": [
    {
      "id": "att_xyz789",
      "filename": "receipt.pdf",
      "contentType": "application/pdf",
      "size": 45678
    }
  ],
  "spamVerdict": "PASS",
  "virusVerdict": "PASS",
  "headers": {
    "message-id": "<abc@mail.example.com>",
    "date": "Mon, 15 Jan 2024 10:30:00 +0000"
  }
}`;

type CodeExamples = Record<
  string,
  {
    label: string;
    filename: string;
    code: string;
  }
>;

export function SdkTabs({ examples }: { examples: CodeExamples }) {
  const exampleKeys = Object.keys(examples) as (keyof typeof examples)[];
  const [activeExample, setActiveExample] = useState<keyof typeof examples>(
    exampleKeys[0]
  );
  const example = examples[activeExample];

  return (
    <>
      {/* Tab buttons */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {exampleKeys.map((key) => (
          <button
            className={cn(
              "rounded-lg px-4 py-2 font-medium text-sm transition-all",
              activeExample === key
                ? "bg-cyan-500 text-white"
                : "bg-muted hover:bg-muted/80"
            )}
            key={key}
            onClick={() => setActiveExample(key)}
            type="button"
          >
            {examples[key].label}
          </button>
        ))}
      </div>

      {/* Split view */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Code example */}
        <div>
          <CodeBlock
            className="h-full"
            data={[
              {
                language: "typescript",
                filename: example.filename,
                code: example.code,
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
            <CodeBlockBody className="max-h-[400px] overflow-y-auto">
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

        {/* JSON preview */}
        <div className="overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0a0a0a]">
          <div className="flex items-center justify-between border-b border-cyan-500/20 bg-[#111] px-4 py-3">
            <span className="font-mono text-cyan-400 text-sm">
              InboundEmail Response
            </span>
            <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-cyan-500 text-xs">
              JSON
            </span>
          </div>
          <pre className="max-h-[400px] overflow-y-auto p-4 font-mono text-xs text-green-400">
            {jsonPreview}
          </pre>
        </div>
      </div>
    </>
  );
}
