"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// ============================================================================
// EXPORTED COMPONENTS
// ============================================================================

export const CodeBlock = ({
  code,
  language = "javascript",
  title,
}: {
  code: string;
  language?: string;
  title?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border bg-muted/30">
      <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            {language}
          </span>
          {title && (
            <span className="text-xs text-muted-foreground">{title}</span>
          )}
        </div>
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
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-foreground/80 font-mono leading-relaxed">
          {code}
        </code>
      </pre>
    </div>
  );
};

export const SectionNav = ({
  sections,
}: {
  sections: { id: string; title: string }[];
}) => {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  const scrollToSection = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="sticky top-24 hidden xl:block w-56 shrink-0">
      <div className="p-4 rounded-xl border bg-muted/30 backdrop-blur-sm">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          On this page
        </h4>
        <ul className="space-y-1">
          {sections.map((s, i) => (
            <li key={i}>
              <button
                className={`text-sm w-full text-left px-3 py-1.5 rounded-lg transition-colors ${
                  active === s.id
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                onClick={() => scrollToSection(s.id)}
                type="button"
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};
