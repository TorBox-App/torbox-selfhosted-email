"use client";

import { Mail, Paperclip, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type HighlightKey =
  | "emailId"
  | "from"
  | "to"
  | "subject"
  | "html"
  | "attachments"
  | "spamVerdict"
  | null;

const emailJson = {
  emailId: '"inb_a1b2c3d4"',
  from: '{ "address": "customer@example.com", "name": "John Doe" }',
  to: '[{ "address": "support@yourapp.com" }]',
  subject: '"Order #12345 Question"',
  html: '"<p>Hi, I have a question about my order...</p>"',
  attachments:
    '[{ "filename": "receipt.pdf", "contentType": "application/pdf", "size": 45678 }]',
  spamVerdict: '"PASS"',
  virusVerdict: '"PASS"',
};

const highlightColors: Record<string, string> = {
  emailId: "ring-cyan-500 bg-cyan-500/10",
  from: "ring-blue-500 bg-blue-500/10",
  to: "ring-green-500 bg-green-500/10",
  subject: "ring-orange-500 bg-orange-500/10",
  html: "ring-purple-500 bg-purple-500/10",
  attachments: "ring-yellow-500 bg-yellow-500/10",
  spamVerdict: "ring-emerald-500 bg-emerald-500/10",
};

function EmailPreview({
  highlighted,
  onHover,
}: {
  highlighted: HighlightKey;
  onHover: (key: HighlightKey) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {/* Email header */}
      <div className="border-b bg-muted/30 p-4">
        <div className="mb-3 flex items-start justify-between">
          <div
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-all",
              highlighted === "from" && highlightColors.from
            )}
            onMouseEnter={() => onHover("from")}
            onMouseLeave={() => onHover(null)}
            role="button"
            tabIndex={0}
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/10">
              <User className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium">John Doe</p>
              <p className="text-muted-foreground text-sm">
                customer@example.com
              </p>
            </div>
          </div>
          <div
            className={cn(
              "cursor-pointer rounded-lg p-2 transition-all",
              highlighted === "emailId" && highlightColors.emailId
            )}
            onMouseEnter={() => onHover("emailId")}
            onMouseLeave={() => onHover(null)}
            role="button"
            tabIndex={0}
          >
            <span className="font-mono text-muted-foreground text-xs">
              inb_a1b2c3d4
            </span>
          </div>
        </div>

        <div
          className={cn(
            "mb-2 cursor-pointer rounded-lg p-2 transition-all",
            highlighted === "to" && highlightColors.to
          )}
          onMouseEnter={() => onHover("to")}
          onMouseLeave={() => onHover(null)}
          role="button"
          tabIndex={0}
        >
          <span className="text-muted-foreground text-sm">
            To: support@yourapp.com
          </span>
        </div>

        <div
          className={cn(
            "cursor-pointer rounded-lg p-2 transition-all",
            highlighted === "subject" && highlightColors.subject
          )}
          onMouseEnter={() => onHover("subject")}
          onMouseLeave={() => onHover(null)}
          role="button"
          tabIndex={0}
        >
          <h3 className="font-semibold text-lg">Order #12345 Question</h3>
        </div>
      </div>

      {/* Email body */}
      <div
        className={cn(
          "cursor-pointer p-4 transition-all",
          highlighted === "html" && highlightColors.html
        )}
        onMouseEnter={() => onHover("html")}
        onMouseLeave={() => onHover(null)}
        role="button"
        tabIndex={0}
      >
        <p className="text-muted-foreground">
          Hi, I have a question about my order. Could you please help me track
          the shipment? I ordered it last week and haven't received any updates.
        </p>
      </div>

      {/* Attachments */}
      <div className="border-t bg-muted/20 p-4">
        <div
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background p-3 transition-all",
            highlighted === "attachments" && highlightColors.attachments
          )}
          onMouseEnter={() => onHover("attachments")}
          onMouseLeave={() => onHover(null)}
          role="button"
          tabIndex={0}
        >
          <Paperclip className="size-4 text-yellow-500" />
          <div>
            <p className="font-medium text-sm">receipt.pdf</p>
            <p className="text-muted-foreground text-xs">45.6 KB</p>
          </div>
        </div>
      </div>

      {/* Security badges */}
      <div className="flex items-center gap-4 border-t bg-muted/10 p-4">
        <div
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-all",
            highlighted === "spamVerdict" && highlightColors.spamVerdict
          )}
          onMouseEnter={() => onHover("spamVerdict")}
          onMouseLeave={() => onHover(null)}
          role="button"
          tabIndex={0}
        >
          <ShieldCheck className="size-4 text-emerald-500" />
          <span className="font-medium text-emerald-600 text-sm dark:text-emerald-400">
            Not Spam
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span className="font-medium text-emerald-600 text-sm dark:text-emerald-400">
            No Virus
          </span>
        </div>
      </div>
    </div>
  );
}

function JsonPreview({
  highlighted,
  onHover,
}: {
  highlighted: HighlightKey;
  onHover: (key: HighlightKey) => void;
}) {
  const renderLine = (key: string, value: string, isLast = false) => {
    const isHighlighted = highlighted === key;
    return (
      <div
        className={cn(
          "cursor-pointer rounded px-2 py-1 transition-all",
          isHighlighted && highlightColors[key]
        )}
        key={key}
        onMouseEnter={() => onHover(key as HighlightKey)}
        onMouseLeave={() => onHover(null)}
        role="button"
        tabIndex={0}
      >
        <span className="text-cyan-400">"{key}"</span>
        <span className="text-white">: </span>
        <span className="text-green-400">{value}</span>
        {!isLast && <span className="text-white">,</span>}
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-cyan-500/20 bg-[#111] px-4 py-3">
        <Mail className="size-4 text-cyan-500" />
        <span className="font-mono text-cyan-400 text-sm">
          InboundEmail.json
        </span>
      </div>

      {/* JSON content */}
      <div className="overflow-x-auto p-4 font-mono text-sm">
        <div className="text-white">{"{"}</div>
        <div className="pl-4">
          {renderLine("emailId", emailJson.emailId)}
          {renderLine("from", emailJson.from)}
          {renderLine("to", emailJson.to)}
          {renderLine("subject", emailJson.subject)}
          {renderLine("html", emailJson.html)}
          {renderLine("attachments", emailJson.attachments)}
          {renderLine("spamVerdict", emailJson.spamVerdict)}
          {renderLine("virusVerdict", emailJson.virusVerdict, true)}
        </div>
        <div className="text-white">{"}"}</div>
      </div>
    </div>
  );
}

export function AnatomySection() {
  const [highlighted, setHighlighted] = useState<HighlightKey>(null);

  return (
    <section className="bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          <p className="text-lg text-muted-foreground">
            Every field parsed.{" "}
            <span className="text-foreground">
              Hover to explore the structure.
            </span>
          </p>
        </div>

        {/* Split view */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Email preview */}
          <div>
            <p className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wider">
              Email Preview
            </p>
            <EmailPreview highlighted={highlighted} onHover={setHighlighted} />
          </div>

          {/* JSON structure */}
          <div>
            <p className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wider">
              Parsed Data
            </p>
            <JsonPreview highlighted={highlighted} onHover={setHighlighted} />
          </div>
        </div>

        {/* Mobile hint */}
        <p className="mt-6 text-center text-muted-foreground text-sm lg:hidden">
          Tap elements to see the connection
        </p>
      </div>
    </section>
  );
}
