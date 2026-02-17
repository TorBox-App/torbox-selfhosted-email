/**
 * Workflow Generate Route
 *
 * POST /v1/workflows/generate - Generate a workflow from a natural language description
 *
 * Uses Anthropic Claude to generate TypeScript workflow DSL code
 * based on a description. Requires authentication.
 */

import { t } from "elysia";
import type { AuthContext } from "../middleware/auth";
import { createAuthenticatedRoutes } from "../middleware/auth";

// ── DSL System Prompt ──

const DSL_SYSTEM_PROMPT = `You are a workflow code generator for the Wraps email automation platform.
You generate TypeScript workflow files using the \`@wraps.dev/client\` DSL.

## Available API

### Trigger Types
\`\`\`typescript
trigger: {
  type: 'contact_created';       // Fires when a new contact is created
} | {
  type: 'contact_updated';       // Fires when a contact is updated
} | {
  type: 'event';                 // Fires on a custom event
  eventName: string;             // e.g. 'cart.abandoned', 'trial.ending'
} | {
  type: 'segment_entered';       // Fires when a contact enters a segment
  segmentId: string;
} | {
  type: 'segment_exited';        // Fires when a contact exits a segment
  segmentId: string;
} | {
  type: 'topic_subscribed';      // Fires when subscribed to a topic
  topicId: string;
} | {
  type: 'topic_unsubscribed';    // Fires when unsubscribed from a topic
  topicId: string;
} | {
  type: 'manual';                // Triggered manually via API
} | {
  type: 'schedule';              // Runs on a cron schedule
  cron: string;                  // e.g. '0 9 * * 1' (Mondays at 9am)
}
\`\`\`

### Step Helpers (all imported from '@wraps.dev/client')

1. \`sendEmail(id: string, config: { template: string; subject?: string; from?: string })\`
   - Sends an email using a template slug
2. \`sendSms(id: string, config: { template: string })\`
   - Sends an SMS using a template slug
3. \`delay(id: string, duration: { minutes?: number; hours?: number; days?: number })\`
   - Pauses the workflow for a duration
4. \`condition(id: string, config: { field: string; operator: string; value: any; branches: { yes: Step[]; no: Step[] } })\`
   - Branches based on a contact field condition
   - Operators: 'equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains', 'is_set', 'is_not_set'
5. \`waitForEvent(id: string, config: { eventName: string; timeout: { hours?: number; days?: number }; branches: { received: Step[]; timeout: Step[] } })\`
   - Waits for a specific event to occur, with a timeout fallback
6. \`webhook(id: string, config: { url: string; method?: string })\`
   - Calls an external webhook
7. \`updateContact(id: string, config: { fields: Record<string, any> })\`
   - Updates contact fields
8. \`addToSegment(id: string, config: { segmentId: string })\`
   - Adds the contact to a segment
9. \`removeFromSegment(id: string, config: { segmentId: string })\`
   - Removes the contact from a segment
10. \`exit(id: string)\`
    - Ends the workflow
11. \`cascade(id: string, config: { channels: Array<{ type: 'email' | 'sms'; template: string; waitFor?: Duration; engagement?: string }> })\`
    - Cross-channel cascade: tries channels in order, falling back if no engagement
    - Returns an array (use spread: \`...cascade(...)\`)
12. \`abTest(id: string, config: { variants: Array<{ weight: number; steps: Step[] }> })\`
    - Splits contacts into A/B test variants by weight

### defineWorkflow structure

\`\`\`typescript
import { defineWorkflow, sendEmail, delay, condition, exit } from '@wraps.dev/client';

export default defineWorkflow({
  name: 'Workflow Name',
  description: 'Optional description',
  trigger: { type: 'contact_created' },
  steps: [
    // Array of step helper calls
  ],
});
\`\`\`

## Rules

1. Always use \`export default defineWorkflow({...})\`
2. Import only what you use from \`@wraps.dev/client\`
3. Step IDs must be kebab-case and unique (e.g. 'send-welcome', 'wait-1-day')
4. Template slugs should be descriptive kebab-case (e.g. 'welcome-email', 'cart-recovery')
5. Use the \`...cascade()\` spread pattern when using cascade
6. Add a JSDoc comment at the top describing the workflow
7. Keep workflows focused — typically 3-10 steps
8. Use meaningful, human-readable names for the workflow and steps

## Example

\`\`\`typescript
import {
  defineWorkflow,
  sendEmail,
  delay,
  condition,
  exit,
} from '@wraps.dev/client';

/**
 * Welcome Sequence
 *
 * Onboard new users with a welcome email,
 * then check if they activated before sending tips.
 */
export default defineWorkflow({
  name: 'Welcome Sequence',
  trigger: {
    type: 'contact_created',
  },

  steps: [
    sendEmail('send-welcome', { template: 'welcome-email' }),
    delay('wait-1-day', { days: 1 }),
    condition('check-activated', {
      field: 'contact.hasActivated',
      operator: 'equals',
      value: true,
      branches: {
        yes: [exit('already-active')],
        no: [
          sendEmail('send-tips', { template: 'getting-started-tips' }),
        ],
      },
    }),
  ],
});
\`\`\`

Output ONLY the TypeScript code. No markdown fences, no explanation — just the code.`;

// ── Route ──

export const workflowGenerateRoutes = createAuthenticatedRoutes(
  "/v1/workflows"
).post(
  "/generate",
  async (ctx) => {
    const authContext = (ctx as unknown as { auth: AuthContext }).auth;
    const { description, slug } = ctx.body;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      ctx.set.status = 503;
      return {
        error: "Workflow generation is not configured on this server",
      };
    }

    // Call Anthropic Messages API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: DSL_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Generate a workflow for: ${description}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[WORKFLOW-GENERATE] Anthropic API error: ${response.status}`,
        body
      );

      if (response.status === 429) {
        ctx.set.status = 429;
        return { error: "Rate limit exceeded. Please try again later." };
      }

      ctx.set.status = 502;
      return { error: "Failed to generate workflow" };
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const textBlock = data.content.find((block) => block.type === "text");
    if (!textBlock?.text) {
      ctx.set.status = 502;
      return { error: "No content returned from AI" };
    }

    const code = extractTypeScriptCode(textBlock.text);

    if (!code.includes("defineWorkflow")) {
      console.error(
        "[WORKFLOW-GENERATE] Generated code missing defineWorkflow:",
        code.slice(0, 200)
      );
      ctx.set.status = 502;
      return { error: "Generated code is invalid — missing defineWorkflow" };
    }

    console.log(
      `[WORKFLOW-GENERATE] Generated workflow for org=${authContext.organizationId} slug=${slug}`
    );

    return { code, slug: slug || slugifyDescription(description) };
  },
  {
    body: t.Object({
      description: t.String({
        description: "Natural language description of the desired workflow",
      }),
      slug: t.Optional(
        t.String({ description: "Output file slug (optional)" })
      ),
    }),
    detail: {
      tags: ["workflows"],
      summary: "Generate a workflow from a description",
      description:
        "Uses AI to generate a TypeScript workflow file from a natural language description.",
    },
  }
);

// ── Helpers ──

const TS_FENCE_RE = /```(?:typescript|ts)\s*\n([\s\S]*?)```/;
const GENERIC_FENCE_RE = /```\s*\n([\s\S]*?)```/;

/**
 * Extract TypeScript code from LLM response.
 * Looks for fenced code blocks first, falls back to raw text.
 */
function extractTypeScriptCode(text: string): string {
  // Try to extract from fenced code blocks
  const fenceMatch = text.match(TS_FENCE_RE);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try generic code fence
  const genericMatch = text.match(GENERIC_FENCE_RE);
  if (genericMatch) {
    return genericMatch[1].trim();
  }

  // Fall back to the full text
  return text.trim();
}

function slugifyDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
