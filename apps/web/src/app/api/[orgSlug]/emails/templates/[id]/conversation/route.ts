import { auth } from "@wraps/auth";
import { aiConversation, db, template } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    id: string;
  }>;
};

// GET /api/[orgSlug]/emails/templates/[id]/conversation — Load AI conversation
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the template's linked conversation, scoped to org
    const tmpl = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
      columns: { aiConversationId: true },
    });

    if (!tmpl?.aiConversationId) {
      return NextResponse.json({ messages: [] });
    }

    const conversation = await db.query.aiConversation.findFirst({
      where: and(
        eq(aiConversation.id, tmpl.aiConversationId),
        eq(aiConversation.organizationId, orgWithMembership.id)
      ),
      columns: { id: true, messages: true },
    });

    if (!conversation) {
      return NextResponse.json({ messages: [] });
    }

    // Transform stored { role, content } to UIMessage-compatible format
    const stored = (conversation.messages ?? []) as Array<{
      role: string;
      content: string;
    }>;
    const uiMessages = stored.map((m, i) => ({
      id: `saved-${i}`,
      role: m.role,
      parts: [{ type: "text" as const, text: m.content }],
      createdAt: new Date(),
    }));

    return NextResponse.json({
      conversationId: conversation.id,
      messages: uiMessages,
    });
  } catch (error) {
    const log = createRequestLogger({
      path: `/api/${orgSlug}/emails/templates/${id}/conversation`,
      method: "GET",
      orgSlug,
    });
    log.error({ err: error }, "Error loading AI conversation");
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}

// DELETE /api/[orgSlug]/emails/templates/[id]/conversation — Clear conversation
export async function DELETE(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the current conversation ID before unlinking
    const tmpl = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
      columns: { aiConversationId: true },
    });

    // Unlink conversation from template
    await db
      .update(template)
      .set({ aiConversationId: null })
      .where(
        and(
          eq(template.id, id),
          eq(template.organizationId, orgWithMembership.id)
        )
      );

    // Delete the orphaned conversation row
    if (tmpl?.aiConversationId) {
      await db
        .delete(aiConversation)
        .where(
          and(
            eq(aiConversation.id, tmpl.aiConversationId),
            eq(aiConversation.organizationId, orgWithMembership.id)
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const log = createRequestLogger({
      path: `/api/${orgSlug}/emails/templates/${id}/conversation`,
      method: "DELETE",
      orgSlug,
    });
    log.error({ err: error }, "Error clearing AI conversation");
    return NextResponse.json(
      { error: "Failed to clear conversation" },
      { status: 500 }
    );
  }
}
