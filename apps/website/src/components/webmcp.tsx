"use client";

import { useEffect } from "react";

type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

type WebMCPContext = {
  name: string;
  description: string;
  tools: WebMCPTool[];
};

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: interface augmentation required for Navigator merging
  interface Navigator {
    modelContext?: {
      provideContext: (ctx: WebMCPContext) => () => void;
    };
  }
}

export function WebMCP() {
  useEffect(() => {
    if (!navigator.modelContext) return;

    const cleanup = navigator.modelContext.provideContext({
      name: "Wraps",
      description:
        "Deploy email (AWS SES), SMS, and CDN infrastructure to your AWS account with one command. Full ownership, AWS pricing, no credentials stored.",
      tools: [
        {
          name: "get_pricing",
          description: "Get Wraps pricing plans and feature comparison",
          inputSchema: { type: "object", properties: {} },
          execute: async () => {
            const res = await fetch("/pricing.md");
            return res.ok ? res.text() : { error: "unavailable" };
          },
        },
        {
          name: "get_quickstart",
          description:
            "Get the quickstart guide for deploying email infrastructure on AWS",
          inputSchema: {
            type: "object",
            properties: {
              service: {
                type: "string",
                enum: ["email", "sms", "cdn"],
                description: "Which service to get quickstart docs for",
              },
            },
          },
          execute: async (input) => {
            const service = (input.service as string) ?? "email";
            const res = await fetch("/llms.txt");
            return res.ok ? res.text() : { error: "unavailable", service };
          },
        },
        {
          name: "search_docs",
          description: "Get full Wraps documentation in markdown format",
          inputSchema: { type: "object", properties: {} },
          execute: async () => {
            const res = await fetch("/llms-full.txt");
            return res.ok ? res.text() : { error: "unavailable" };
          },
        },
      ],
    });

    return cleanup;
  }, []);

  return null;
}
