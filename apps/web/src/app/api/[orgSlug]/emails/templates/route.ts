import { auth } from "@wraps/auth";
import type { WorkflowStep } from "@wraps/db";
import { batchSend, db, template, workflow } from "@wraps/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { trackTemplateCreated } from "@/lib/activation-tracking";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

// GET /api/[orgSlug]/emails/templates - List all templates
export async function GET(request: Request, context: RouteContext) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const channel = searchParams.get("channel");

    // Build query conditions
    const conditions = [eq(template.organizationId, orgWithMembership.id)];

    const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
    if (status && (validStatuses as readonly string[]).includes(status)) {
      conditions.push(
        eq(template.status, status as (typeof validStatuses)[number])
      );
    }

    const validChannels = ["email", "sms"] as const;
    if (channel && (validChannels as readonly string[]).includes(channel)) {
      conditions.push(
        eq(template.channel, channel as (typeof validChannels)[number])
      );
    }

    const templates = await db.query.template.findMany({
      where: and(...conditions),
      orderBy: [desc(template.updatedAt)],
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Get broadcast (batchSend) counts per template
    const broadcastCounts = await db
      .select({
        templateId: batchSend.emailTemplateId,
        count: sql<number>`count(*)::int`,
      })
      .from(batchSend)
      .where(eq(batchSend.organizationId, orgWithMembership.id))
      .groupBy(batchSend.emailTemplateId);

    const broadcastCountMap = new Map(
      broadcastCounts.map((b) => [b.templateId, b.count])
    );

    // Get all workflows for this org and count which use each template
    const workflows = await db.query.workflow.findMany({
      where: eq(workflow.organizationId, orgWithMembership.id),
      columns: {
        id: true,
        name: true,
        steps: true,
      },
    });

    // Count automation usage per template
    const automationCountMap = new Map<string, number>();
    const automationNamesMap = new Map<string, string[]>();

    for (const wf of workflows) {
      const steps = (wf.steps || []) as WorkflowStep[];
      const usedTemplateIds = new Set<string>();

      for (const step of steps) {
        if (
          step.config.type === "send_email" &&
          step.config.templateId &&
          !usedTemplateIds.has(step.config.templateId)
        ) {
          usedTemplateIds.add(step.config.templateId);
          const current = automationCountMap.get(step.config.templateId) || 0;
          automationCountMap.set(step.config.templateId, current + 1);

          const names = automationNamesMap.get(step.config.templateId) || [];
          names.push(wf.name);
          automationNamesMap.set(step.config.templateId, names);
        }
      }
    }

    // Enhance templates with usage data
    const templatesWithUsage = templates.map((t) => ({
      ...t,
      broadcastCount: broadcastCountMap.get(t.id) || 0,
      automationCount: automationCountMap.get(t.id) || 0,
      automationNames: automationNamesMap.get(t.id) || [],
    }));

    return NextResponse.json(templatesWithUsage);
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates",
      method: "GET",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error fetching templates");
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/[orgSlug]/emails/templates - Create new template
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

    const { name, description, subject, channel } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    // Determine channel (default to email)
    const templateChannel = channel === "sms" ? "sms" : "email";

    // SMS templates use plain text content, email templates use TipTap
    const defaultContent =
      templateChannel === "sms"
        ? { type: "doc", content: [] }
        : {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Start editing your template..." },
                ],
              },
            ],
          };

    // Create template with empty content
    const [newTemplate] = await db
      .insert(template)
      .values({
        organizationId: orgWithMembership.id,
        name: name.trim(),
        description: description?.trim() || null,
        subject: templateChannel === "sms" ? null : subject?.trim() || null,
        channel: templateChannel,
        content: defaultContent,
        createdBy: session.user.id,
        status: "DRAFT",
      })
      .returning();

    // Track activation event (fire-and-forget)
    trackTemplateCreated(session.user.email, orgWithMembership.id);

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates",
      method: "POST",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error creating template");
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
