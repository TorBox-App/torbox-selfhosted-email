"use client";

import { Button } from "@wraps/ui/components/ui/button";
import { ArrowRight, Bot } from "lucide-react";
import Link from "next/link";
import { trackEvent } from "@/utils/analytics";

export function McpCtaSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="mb-6 font-medium text-2xl tracking-tight sm:text-3xl">
          Your SES. Your credentials.{" "}
          <span className="text-muted-foreground">One config block.</span>
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            asChild
            className="bg-orange-500 text-white hover:bg-orange-600"
            size="lg"
          >
            <Link
              href="/docs/mcp-reference"
              onClick={() =>
                trackEvent("cta_click", {
                  location: "mcp_cta",
                  cta_text: "Read the MCP reference",
                })
              }
            >
              Read the MCP reference
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/agents">
              <Bot className="size-4" />
              Wraps for agents
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
