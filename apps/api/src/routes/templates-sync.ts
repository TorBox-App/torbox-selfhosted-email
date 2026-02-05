/**
 * Templates Sync Routes
 *
 * CLI-to-platform template synchronization for "templates as code".
 *
 * POST /v1/templates/push       - Upsert a single template from CLI
 * POST /v1/templates/push/batch - Push multiple templates atomically
 * GET  /v1/templates/pull       - List all code-pushed templates with source
 */

import { and, db, eq, template } from "@wraps/db";
import { t } from "elysia";
import type { AuthContext } from "../middleware/auth";
import { createAuthenticatedRoutes } from "../middleware/auth";

export const templatesSyncRoutes = createAuthenticatedRoutes("/v1/templates")
  // POST /push — Upsert a single template from CLI
  .post(
    "/push",
    async (ctx) => {
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;
      const { body } = ctx;

      const result = await upsertTemplateFromCli(authContext, body);

      ctx.set.status = result.created ? 201 : 200;
      return {
        id: result.id,
        slug: result.slug,
        status: "PUBLISHED",
        updatedAt: result.updatedAt,
        remoteHash: body.sourceHash,
      };
    },
    {
      body: t.Object({
        slug: t.String({
          description: "Template slug (filename without extension)",
        }),
        source: t.String({ description: "React Email TSX source code" }),
        compiledHtml: t.String({ description: "Compiled HTML output" }),
        compiledText: t.String({ description: "Compiled plain text output" }),
        subject: t.String({ description: "Email subject line" }),
        previewText: t.Optional(
          t.String({ description: "Preview/preheader text" })
        ),
        emailType: t.Union(
          [t.Literal("marketing"), t.Literal("transactional")],
          {
            description: "Email type for compliance",
          }
        ),
        variables: t.Array(t.Any(), { description: "Template variables" }),
        sourceHash: t.String({ description: "SHA256 hash of source file" }),
        sesTemplateName: t.String({ description: "SES template name" }),
        cliProjectPath: t.Optional(
          t.String({
            description: "Path in project (e.g. templates/welcome.tsx)",
          })
        ),
      }),
      detail: {
        tags: ["templates"],
        summary: "Push a template from CLI",
        description:
          "Upserts a template compiled from React Email source. Used by `wraps push`.",
      },
    }
  )

  // POST /push/batch — Push multiple templates atomically
  .post(
    "/push/batch",
    async (ctx) => {
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;
      const { body } = ctx;

      const results = await Promise.all(
        body.templates.map((tmpl) => upsertTemplateFromCli(authContext, tmpl))
      );

      return {
        results: results.map((r) => ({
          slug: r.slug,
          id: r.id,
          status: "PUBLISHED" as const,
        })),
      };
    },
    {
      body: t.Object({
        templates: t.Array(
          t.Object({
            slug: t.String(),
            source: t.String(),
            compiledHtml: t.String(),
            compiledText: t.String(),
            subject: t.String(),
            previewText: t.Optional(t.String()),
            emailType: t.Union([
              t.Literal("marketing"),
              t.Literal("transactional"),
            ]),
            variables: t.Array(t.Any()),
            sourceHash: t.String(),
            sesTemplateName: t.String(),
            cliProjectPath: t.Optional(t.String()),
          })
        ),
      }),
      detail: {
        tags: ["templates"],
        summary: "Push multiple templates from CLI",
        description: "Batch upsert templates compiled from React Email source.",
      },
    }
  )

  // GET /pull — List all code-pushed templates with source
  .get(
    "/pull",
    async (ctx) => {
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;

      const templates = await db
        .select({
          id: template.id,
          slug: template.slug,
          source: template.source,
          subject: template.subject,
          emailType: template.emailType,
          variables: template.variables,
          sourceHash: template.sourceHash,
          status: template.status,
          updatedAt: template.updatedAt,
        })
        .from(template)
        .where(
          and(
            eq(template.organizationId, authContext.organizationId),
            eq(template.sourceFormat, "react-email")
          )
        );

      return {
        templates: templates
          .filter((t) => t.source != null)
          .map((t) => ({
            ...t,
            updatedAt: t.updatedAt.toISOString(),
          })),
      };
    },
    {
      detail: {
        tags: ["templates"],
        summary: "Pull templates for CLI sync",
        description:
          "Returns all templates pushed from CLI with their React Email source.",
      },
    }
  );

// ── Helpers ──

interface PushBody {
  slug: string;
  source: string;
  compiledHtml: string;
  compiledText: string;
  subject: string;
  previewText?: string;
  emailType: "marketing" | "transactional";
  variables: unknown[];
  sourceHash: string;
  sesTemplateName: string;
  cliProjectPath?: string;
}

async function upsertTemplateFromCli(
  authContext: AuthContext,
  body: PushBody
): Promise<{ id: string; slug: string; updatedAt: string; created: boolean }> {
  const now = new Date();

  // Check for existing template by (organizationId, slug)
  const [existing] = await db
    .select({ id: template.id })
    .from(template)
    .where(
      and(
        eq(template.organizationId, authContext.organizationId),
        eq(template.slug, body.slug)
      )
    )
    .limit(1);

  if (existing) {
    // Update existing template
    await db
      .update(template)
      .set({
        source: body.source,
        sourceFormat: "react-email",
        sourceHash: body.sourceHash,
        subject: body.subject,
        compiledHtml: body.compiledHtml,
        compiledText: body.compiledText,
        emailType: body.emailType,
        variables: body.variables as Record<string, unknown>[],
        sesTemplateName: body.sesTemplateName,
        status: "PUBLISHED",
        pushedFromCli: true,
        lastPushedAt: now,
        cliProjectPath: body.cliProjectPath,
        lastEditedBy: authContext.userId,
        updatedAt: now,
      })
      .where(eq(template.id, existing.id));

    return {
      id: existing.id,
      slug: body.slug,
      updatedAt: now.toISOString(),
      created: false,
    };
  }

  // Insert new template
  // createdBy requires non-null; for API key auth userId may be null,
  // fall back to "cli" as a sentinel value
  const id = crypto.randomUUID();
  await db.insert(template).values({
    id,
    organizationId: authContext.organizationId,
    name: body.slug,
    slug: body.slug,
    source: body.source,
    sourceFormat: "react-email",
    sourceHash: body.sourceHash,
    subject: body.subject,
    compiledHtml: body.compiledHtml,
    compiledText: body.compiledText,
    emailType: body.emailType,
    variables: body.variables as Record<string, unknown>[],
    sesTemplateName: body.sesTemplateName,
    content: {}, // Empty content for code-pushed templates
    status: "PUBLISHED",
    pushedFromCli: true,
    lastPushedAt: now,
    cliProjectPath: body.cliProjectPath,
    createdBy: authContext.userId ?? "cli",
  });

  return {
    id,
    slug: body.slug,
    updatedAt: now.toISOString(),
    created: true,
  };
}
