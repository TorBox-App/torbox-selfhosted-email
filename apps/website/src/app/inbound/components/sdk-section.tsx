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

const codeExamples = {
  list: {
    label: "List",
    filename: "list-emails.ts",
    code: `import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail({
  inboundBucket: 'your-bucket-name',
});

// List recent inbound emails
const { emails, cursor } = await email.inbox.list({
  limit: 20,
  from: 'customer@example.com', // optional filter
});

for (const msg of emails) {
  console.log(\`\${msg.from.address}: \${msg.subject}\`);
}`,
  },
  get: {
    label: "Get",
    filename: "get-email.ts",
    code: `// Get full email details
const inbound = await email.inbox.get('inb_a1b2c3d4');

console.log('From:', inbound.from.name, inbound.from.address);
console.log('Subject:', inbound.subject);
console.log('HTML:', inbound.html);
console.log('Text:', inbound.text);

// Access attachments
for (const att of inbound.attachments) {
  console.log(\`Attachment: \${att.filename} (\${att.size} bytes)\`);
}

// Check spam/virus verdicts
if (inbound.spamVerdict === 'PASS') {
  // Safe to process
}`,
  },
  reply: {
    label: "Reply",
    filename: "reply-email.ts",
    code: `// Reply with proper threading headers
await email.inbox.reply('inb_a1b2c3d4', {
  from: 'support@yourapp.com',
  html: \`
    <p>Thanks for reaching out!</p>
    <p>We've received your message and will respond within 24 hours.</p>
    <p>Best,<br/>The Support Team</p>
  \`,
});

// Threading headers (In-Reply-To, References) are
// automatically set to maintain the email chain`,
  },
  forward: {
    label: "Forward",
    filename: "forward-email.ts",
    code: `// Forward to your team
await email.inbox.forward('inb_a1b2c3d4', {
  to: 'team@yourcompany.com',
  from: 'forwarding@yourapp.com',
  note: 'Please review this customer inquiry.',
});

// Original message and attachments are preserved`,
  },
  webhook: {
    label: "Webhook",
    filename: "eventbridge-handler.ts",
    code: `// EventBridge Lambda handler
export const handler = async (event: EventBridgeEvent) => {
  const email = event.detail;

  // Route based on recipient
  if (email.to[0].address.startsWith('support@')) {
    await createSupportTicket(email);
  } else if (email.to[0].address.startsWith('sales@')) {
    await notifySalesTeam(email);
  }

  // Process attachments
  if (email.attachments.length > 0) {
    await processAttachments(email);
  }

  return { statusCode: 200 };
};`,
  },
};

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

type ExampleKey = keyof typeof codeExamples;

export function SdkSection() {
  const [activeExample, setActiveExample] = useState<ExampleKey>("list");
  const example = codeExamples[activeExample];

  return (
    <section className="bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-8 text-center">
          <p className="text-lg text-muted-foreground">
            Simple SDK.{" "}
            <span className="text-foreground">
              Full control over your inbox.
            </span>
          </p>
        </div>

        {/* Tab buttons */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {(Object.keys(codeExamples) as ExampleKey[]).map((key) => (
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
              {codeExamples[key].label}
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
      </div>
    </section>
  );
}
