import { auth } from "@wraps/auth";
import { db, segment, template, topic } from "@wraps/db";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { buildWorkflowSystemPrompt } from "@/lib/ai/(ee)/workflow-system-prompt";
import { getAIModel } from "@/lib/ai/model";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import { checkAiUsageLimit, trackAiRequest } from "@/lib/usage/ai-usage";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

// POST /api/[orgSlug]/workflows/ai/generate - Generate workflow with AI
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
      workflowId,
      existingWorkflow,
    }: {
      messages: UIMessage[];
      workflowId?: string;
      existingWorkflow?: {
        name: string;
        steps: unknown[];
        transitions: unknown[];
      };
    } = await request.json();

    if (!(messages && Array.isArray(messages)) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Convert UI messages to model messages for the AI SDK
    const modelMessages = convertToModelMessages(messages);

    // Fetch organization context for the AI
    const [templates, segments, topics] = await Promise.all([
      db.query.template.findMany({
        where: eq(template.organizationId, orgWithMembership.id),
        columns: {
          id: true,
          name: true,
          description: true,
          emailType: true,
        },
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
        limit: 50, // Limit to avoid bloating the prompt
      }),
      db.query.segment.findMany({
        where: eq(segment.organizationId, orgWithMembership.id),
        columns: {
          id: true,
          name: true,
          description: true,
          memberCount: true,
        },
        orderBy: (s, { asc }) => [asc(s.name)],
        limit: 50,
      }),
      db.query.topic.findMany({
        where: eq(topic.organizationId, orgWithMembership.id),
        columns: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: (t, { asc }) => [asc(t.name)],
        limit: 50,
      }),
    ]);

    // Build system prompt with organization context and existing workflow
    // existingWorkflow is sent from the client (like Template AI with editor.getJSON())
    const systemPrompt = buildWorkflowSystemPrompt({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        emailType: t.emailType,
      })),
      segments: segments.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        memberCount: s.memberCount,
      })),
      topics: topics.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
      })),
      // Pass existing workflow for incremental updates (sent from client)
      existingWorkflow,
    });

    const { model, modelId: MODEL_ID } = getAIModel();

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 8000,
      onFinish: async ({ usage }) => {
        const log = createRequestLogger({
          path: "/api/[orgSlug]/workflows/ai/generate",
          method: "POST",
          orgSlug,
        });

        // Track usage for billing/limits (async)
        trackAiRequest({
          organizationId: orgWithMembership.id,
          userId: session.user.id,
          featureType: "workflow_ai",
          templateId: workflowId, // Repurpose field for workflowId
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          totalTokens: usage?.totalTokens,
          model: MODEL_ID,
        }).catch((error) => {
          log.error({ err: error }, "Failed to track AI request");
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
      path: "/api/[orgSlug]/workflows/ai/generate",
      method: "POST",
      orgSlug,
    });
    log.error({ err: error }, "Error generating AI workflow");
    return NextResponse.json(
      { error: "Failed to generate workflow" },
      { status: 500 }
    );
  }
}
