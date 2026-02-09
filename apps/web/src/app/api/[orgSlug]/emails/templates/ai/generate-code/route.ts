import { gateway } from "@ai-sdk/gateway";
import { auth } from "@wraps/auth";
import { aiConversation, brandKit, db, templateVariable } from "@wraps/db";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
  type UserContent,
} from "ai";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { fetchAndProcessImage } from "@/lib/ai/image-utils";
import { buildReactEmailSystemPrompt } from "@/lib/ai/react-email-system-prompt";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import { checkAiUsageLimit, trackAiRequest } from "@/lib/usage/ai-usage";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

// POST /api/[orgSlug]/emails/templates/ai/generate-code - Generate React Email TSX with AI
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify organization membership
    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check AI usage limit before processing
    const usageCheck = await checkAiUsageLimit(orgWithMembership.id);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: "AI message limit reached",
          message: `You've used ${usageCheck.current} of ${usageCheck.limit} AI messages this month. Upgrade your plan for more.`,
          limitReached: true,
          current: usageCheck.current,
          limit: usageCheck.limit,
        },
        { status: 429 }
      );
    }

    const {
      messages,
      templateId,
      brandKitId,
      existingSource,
      imageUrl,
    }: {
      messages: UIMessage[];
      templateId?: string;
      brandKitId?: string;
      existingSource?: string;
      imageUrl?: string;
    } = await request.json();

    if (!(messages && Array.isArray(messages)) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Convert UI messages to model messages for the AI SDK
    const modelMessages = convertToModelMessages(messages);

    // If an image URL is provided, fetch and inject it into the last user message
    if (imageUrl) {
      try {
        const processedImage = await fetchAndProcessImage(imageUrl);
        let lastUserIndex = -1;
        for (let i = modelMessages.length - 1; i >= 0; i--) {
          if (modelMessages[i].role === "user") {
            lastUserIndex = i;
            break;
          }
        }
        if (lastUserIndex !== -1) {
          const lastUserMsg = modelMessages[lastUserIndex];
          const existingText =
            typeof lastUserMsg.content === "string"
              ? lastUserMsg.content
              : Array.isArray(lastUserMsg.content)
                ? lastUserMsg.content
                    .filter(
                      (p): p is { type: "text"; text: string } =>
                        p.type === "text"
                    )
                    .map((p) => p.text)
                    .join("")
                : "";

          const newContent: UserContent = [
            {
              type: "image",
              image: processedImage.base64,
              mediaType: processedImage.mediaType,
            },
            {
              type: "text",
              text: existingText,
            },
          ];

          modelMessages[lastUserIndex] = {
            role: "user" as const,
            content: newContent,
          };
        }
      } catch (imageError) {
        const log = createRequestLogger({
          path: "/api/[orgSlug]/emails/templates/ai/generate-code",
          method: "POST",
          orgSlug,
        });
        log.warn(
          { err: serializeError(imageError) },
          "Failed to process image, continuing without it"
        );
      }
    }

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

    // Build system prompt for React Email TSX generation
    const systemPrompt = buildReactEmailSystemPrompt({
      brandKit: kit || undefined,
      availableVariables: variables.map((v) => ({
        name: v.name,
        label: v.label,
        type: v.type,
      })),
      existingSource,
      hasImageReference: !!imageUrl,
    });

    // Use Claude Sonnet for code generation
    const MODEL_ID = "anthropic/claude-sonnet-4";

    const result = streamText({
      model: gateway(MODEL_ID),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 16_000,
      providerOptions: {
        anthropic: {
          thinking: { type: "enabled", budgetTokens: 10_000 },
        },
      },
      onFinish: async ({ usage }) => {
        const log = createRequestLogger({
          path: "/api/[orgSlug]/emails/templates/ai/generate-code",
          method: "POST",
          orgSlug,
        });

        // Track usage for billing/limits
        trackAiRequest({
          organizationId: orgWithMembership.id,
          userId: session.user.id,
          featureType: "ai_chat",
          templateId,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          totalTokens: usage?.totalTokens,
          model: MODEL_ID,
        }).catch((error) => {
          log.error(
            { err: serializeError(error) },
            "Failed to track AI request"
          );
        });

        // Track conversation in database
        trackConversation({
          organizationId: orgWithMembership.id,
          templateId,
          messages,
          userId: session.user.id,
        }).catch((error) => {
          log.error(
            { err: serializeError(error) },
            "Failed to track conversation"
          );
        });
      },
    });

    // Stream with reasoning parts included
    return result.toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/ai/generate-code",
      method: "POST",
      orgSlug,
    });
    log.error(
      { err: serializeError(error) },
      "Error generating AI code content"
    );
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
    path: "/api/[orgSlug]/emails/templates/ai/generate-code",
    method: "POST",
    orgSlug: "system",
  });

  try {
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
    log.error(
      { err: serializeError(error) },
      "Failed to track AI conversation"
    );
  }
}
