"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

const command = "npx @wraps.dev/cli email connect";

export function ExistingSesSection() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative border-b py-14 sm:py-18">
      {/* Accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="mb-2 font-medium text-primary text-sm uppercase tracking-wider">
            Already using SES?
          </p>
          <h2 className="mb-4 font-semibold text-xl sm:text-2xl">
            Connect without breaking anything
          </h2>
          <p className="mb-6 text-muted-foreground text-sm">
            Add tracking, analytics, and the SDK to your existing setup.
          </p>

          <div className="mb-6 w-full max-w-sm">
            <InputGroup>
              <InputGroupInput
                className="font-mono text-sm"
                readOnly
                value={command}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Copy command"
                  size="icon-xs"
                  title="Copy"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <Button
            asChild
            className="group cursor-pointer text-muted-foreground"
            size="sm"
            variant="link"
          >
            <a href="/docs/cli-reference#email-connect">
              Learn more
              <ArrowRight className="ml-1 size-3 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
