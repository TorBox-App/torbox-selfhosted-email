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

type DbOrTx =
  | typeof db
  | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export const templatesSyncRoutes = createAuthenticatedRoutes("/v1/templates")
  // POST /push — Upsert a single template from CLI
  .post(
    "/push",
    async (ctx) => {
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;
      const { body } = ctx;

      const result = await upsertTemplateFromCli(db, authContext, body);

      if (result.conflict) {
        ctx.set.status = 409;
        return {
          error: "conflict",
          message: "Template was edited on the dashboard since last push",
          lastEditedFrom: "dashboard",
          updatedAt: result.updatedAt,
        };
      }

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
        channel: t.Optional(
          t.Union([t.Literal("email"), t.Literal("sms")], {
            description: "Template channel (default: email)",
          })
        ),
        variables: t.Array(
          t.Object({
            name: t.String(),
            fallback: t.Optional(t.String()),
          }),
          { description: "Template variables" }
        ),
        sourceHash: t.String({ description: "SHA256 hash of source file" }),
        sesTemplateName: t.String({ description: "SES template name" }),
        cliProjectPath: t.Optional(
          t.String({
            description: "Path in project (e.g. templates/welcome.tsx)",
          })
        ),
        force: t.Optional(
          t.Boolean({
            description: "Force overwrite even if edited on dashboard",
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

  // POST /push/batch — Push multiple templates in a transaction
  .post(
    "/push/batch",
    async (ctx) => {
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;
      const { body } = ctx;

      const results = await db.transaction(async (tx) => {
        const settled = await Promise.allSettled(
          body.templates.map((tmpl) =>
            upsertTemplateFromCli(tx, authContext, tmpl)
          )
        );

        // If any rejected with unexpected errors, throw to rollback
        const errors = settled.filter(
          (s): s is PromiseRejectedResult => s.status === "rejected"
        );
        if (errors.length > 0) {
          throw errors[0].reason;
        }

        return settled
          .filter(
            (s): s is PromiseFulfilledResult<UpsertResult> =>
              s.status === "fulfilled"
          )
          .map((s) => s.value);
      });

      // Check if any had conflicts
      const conflicts = results.filter((r) => r.conflict);
      if (conflicts.length > 0) {
        ctx.set.status = 409;
        return {
          error: "conflict",
          conflicts: conflicts.map((c) => ({
            slug: c.slug,
            message: "Template was edited on the dashboard since last push",
            updatedAt: c.updatedAt,
          })),
          results: results
            .filter((r) => !r.conflict)
            .map((r) => ({
              slug: r.slug,
              id: r.id,
              status: "PUBLISHED" as const,
            })),
        };
      }

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
            channel: t.Optional(
              t.Union([t.Literal("email"), t.Literal("sms")])
            ),
            variables: t.Array(
              t.Object({
                name: t.String(),
                fallback: t.Optional(t.String()),
              })
            ),
            sourceHash: t.String(),
            sesTemplateName: t.String(),
            cliProjectPath: t.Optional(t.String()),
            force: t.Optional(t.Boolean()),
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
          channel: template.channel,
          variables: template.variables,
          sourceHash: template.sourceHash,
          status: template.status,
          updatedAt: template.updatedAt,
          lastEditedFrom: template.lastEditedFrom,
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

export type PushBody = {
  slug: string;
  source: string;
  compiledHtml: string;
  compiledText: string;
  subject: string;
  previewText?: string;
  emailType: "marketing" | "transactional";
  channel?: "email" | "sms";
  variables: Array<{ name: string; fallback?: string }>;
  sourceHash: string;
  sesTemplateName: string;
  cliProjectPath?: string;
  force?: boolean;
};

type UpsertResult = {
  id: string;
  slug: string;
  updatedAt: string;
  created: boolean;
  conflict?: boolean;
};

export async function upsertTemplateFromCli(
  tx: DbOrTx,
  authContext: AuthContext,
  body: PushBody
): Promise<UpsertResult> {
  const now = new Date();

  // Check for existing template by (organizationId, slug)
  const [existing] = await tx
    .select({
      id: template.id,
      lastEditedFrom: template.lastEditedFrom,
      updatedAt: template.updatedAt,
    })
    .from(template)
    .where(
      and(
        eq(template.organizationId, authContext.organizationId),
        eq(template.slug, body.slug)
      )
    )
    .limit(1);

  if (existing) {
    // Conflict check: if last edited from dashboard and not forcing, reject
    if (existing.lastEditedFrom === "dashboard" && !body.force) {
      return {
        id: existing.id,
        slug: body.slug,
        updatedAt: existing.updatedAt.toISOString(),
        created: false,
        conflict: true,
      };
    }

    // Update existing template
    await tx
      .update(template)
      .set({
        source: body.source,
        sourceFormat: "react-email",
        sourceHash: body.sourceHash,
        subject: body.subject,
        previewText: body.previewText ?? null,
        compiledHtml: body.compiledHtml,
        compiledText: body.compiledText,
        emailType: body.emailType,
        channel: body.channel ?? "email",
        variables: body.variables as Record<string, unknown>[],
        sesTemplateName: body.sesTemplateName,
        status: "PUBLISHED",
        pushedFromCli: true,
        lastPushedAt: now,
        cliProjectPath: body.cliProjectPath,
        lastEditedBy: authContext.userId,
        lastEditedFrom: "cli",
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
  const id = crypto.randomUUID();
  await tx.insert(template).values({
    id,
    organizationId: authContext.organizationId,
    name: body.slug,
    slug: body.slug,
    source: body.source,
    sourceFormat: "react-email",
    sourceHash: body.sourceHash,
    subject: body.subject,
    previewText: body.previewText ?? null,
    compiledHtml: body.compiledHtml,
    compiledText: body.compiledText,
    emailType: body.emailType,
    channel: body.channel ?? "email",
    variables: body.variables as Record<string, unknown>[],
    sesTemplateName: body.sesTemplateName,
    content: {}, // Empty content for code-pushed templates
    status: "PUBLISHED",
    pushedFromCli: true,
    lastPushedAt: now,
    cliProjectPath: body.cliProjectPath,
    lastEditedFrom: "cli",
    createdBy: authContext.userId ?? null,
  });

  return {
    id,
    slug: body.slug,
    updatedAt: now.toISOString(),
    created: true,
  };
}
