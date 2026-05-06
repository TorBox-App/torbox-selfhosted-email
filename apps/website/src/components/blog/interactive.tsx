"use client";

import { Check, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";

export const CodeBlock = ({
  label,
  children,
}: {
  label: string;
  children: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
        <span className="font-mono text-muted-foreground text-xs">{label}</span>
        <button
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
            copied
              ? "bg-green-500/20 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-foreground text-sm">
        {children}
      </pre>
    </div>
  );
};

export const Collapsible = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="my-2 overflow-hidden rounded-lg border bg-muted/30">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left font-medium transition-colors hover:bg-muted/50"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
        {title}
      </button>
      {isOpen && <div className="border-t px-4 py-3">{children}</div>}
    </div>
  );
};
