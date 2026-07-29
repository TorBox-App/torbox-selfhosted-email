import type { JSONContent } from "@tiptap/core";
import { getAIModel, isProviderConfigError } from "@wraps/ai";
import { aiConversation, brandKit, db, templateVariable } from "@wraps/db";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolveAIRequest } from "@/app/api/shared/ai-request";
import { aiEnv } from "@/lib/ai/env";
import { buildSystemPromptParts } from "@/lib/ai/system-prompt";
import { extractTipTapJson, validateTipTapJson } from "@/lib/ai/validator";
import { createRequestLogger } from "@/lib/logger";
import { trackAiRequest } from "@/lib/usage/ai-usage";

const ROUTE_PATH = "/api/[orgSlug]/emails/templates/ai/generate";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

// POST /api/[orgSlug]/emails/templates/ai/generate - Generate template content with AI
export async function POST(request: Request, context: RouteContext) {
  try {
    const gated = await resolveAIRequest(context, {
      resource: "templates",
      permissions: ["write"],
      path: ROUTE_PATH,
    });
    if (!gated.ok) return gated.response;
    const { orgSlug, org: orgWithMembership, userId, log } = gated;

    const {
      messages,
      templateId,
      brandKitId,
      existingContent,
    }: {
      messages: UIMessage[];
      templateId?: string;
      brandKitId?: string;
      existingContent?: JSONContent;
    } = await request.json();

    if (!(messages && Array.isArray(messages)) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Convert UI messages to model messages for the AI SDK
    const modelMessages = convertToModelMessages(messages);

    // Load brand kit
    let kit = null;
    if (brandKitId) {
      kit = await db.query.brandKit.findFirst({
        where: and(
          eq(brandKit.id, brandKitId),
          eq(brandKit.organizationId, orgWithMembership.id)
        ),
      });
    } else {
      // Get default brand kit
      kit = await db.query.brandKit.findFirst({
        where: and(
          eq(brandKit.organizationId, orgWithMembership.id),
          eq(brandKit.isDefault, true)
        ),
      });
    }

    // Load available variables
    const variables = await db.query.templateVariable.findMany({
      where: eq(templateVariable.organizationId, orgWithMembership.id),
    });

    // Split so the ~15k-token stable half can carry a prompt-cache breakpoint.
    const { stable: stablePrompt, dynamic: dynamicPrompt } =
      buildSystemPromptParts({
        brandKit: kit || undefined,
        availableVariables: variables.map((v) => ({
          name: v.name,
          label: v.label,
          type: v.type,
        })),
        existingContent: existingContent
          ? JSON.stringify(existingContent)
          : undefined,
      });

    // providerOptions is namespaced for whichever provider actually serves this
    // request. Previously an anthropic thinking block was sent unconditionally,
    // which did nothing on this route's Grok default.
    const {
      model,
      modelId: MODEL_ID,
      providerOptions,
      cache,
    } = await getAIModel(
      {
        model: "grok-code-fast",
        reasoning: { effort: "medium" },
      },
      aiEnv()
    );

    const result = streamText({
      model,
      // `system` moves into `messages` so the stable half can carry a
      // per-message cache breakpoint. Order is load-bearing: the cached prefix
      // must come first or it is not a prefix.
      messages: [
        {
          role: "system" as const,
          content: stablePrompt,
          ...(cache.breakpoint && { providerOptions: cache.breakpoint }),
        },
        { role: "system" as const, content: dynamicPrompt },
        ...modelMessages,
      ],
      maxOutputTokens: 16_000,
      providerOptions: {
        ...providerOptions,
        ...cache.requestOptions,
      },
      onFinish: async ({ text, usage }) => {
        // Validate final output
        const json = extractTipTapJson(text);
        if (json) {
          const validation = validateTipTapJson(json);
          if (!validation.valid) {
            log.warn(
              { validationErrors: validation.errors },
              "AI output validation issues"
            );
          }
        }

        // Awaited, not fire-and-forget: the serverless function can be frozen
        // the moment the stream ends, dropping an un-awaited write.
        const results = await Promise.allSettled([
          trackAiRequest({
            organizationId: orgWithMembership.id,
            userId,
            featureType: "ai_chat",
            templateId,
            inputTokens: usage?.inputTokens,
            // Recorded separately so enabling caching does not read as a drop
            // in input_tokens. Undefined on providers that do not report it.
            cachedInputTokens: usage?.cachedInputTokens,
            outputTokens: usage?.outputTokens,
            totalTokens: usage?.totalTokens,
            model: MODEL_ID,
          }),
          trackConversation({
            organizationId: orgWithMembership.id,
            templateId,
            messages,
            userId,
          }),
        ]);

        for (const result of results) {
          if (result.status === "rejected") {
            log.error(
              { err: result.reason },
              "Failed to track AI usage or conversation"
            );
          }
        }
      },
    });

    // Stream with reasoning parts included
    return result.toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (error) {
    const log = createRequestLogger({
      path: ROUTE_PATH,
      method: "POST",
      orgSlug: (await context.params).orgSlug,
    });
    if (isProviderConfigError(error)) {
      // Operator-facing detail goes to the log, never to the response.
      log.error(
        { err: error, issues: error.issues },
        "AI provider is not configured for this deployment"
      );
      return NextResponse.json(
        { error: "AI generation is not configured for this deployment." },
        { status: 503 }
      );
    }
    log.error({ err: error }, "Error generating AI content");
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}

// Track conversation for history and analytics
async function trackConversation(data: {
  organizationId: string;
  templateId?: string;
  messages: UIMessage[];
  userId: string;
}): Promise<void> {
  const log = createRequestLogger({
    path: ROUTE_PATH,
    method: "POST",
    orgSlug: "system",
  });

  try {
    // Convert UIMessages to a simpler format for storage
    const simplifiedMessages = data.messages.map((m) => ({
      role: m.role,
      content: m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(""),
    }));

    await db.insert(aiConversation).values({
      organizationId: data.organizationId,
      templateId: data.templateId || null,
      messages: simplifiedMessages,
      createdBy: data.userId,
    });
  } catch (error) {
    log.error({ err: error }, "Failed to track AI conversation");
  }
}
