import { auth } from "@wraps/auth";
import { db, template } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { transform } from "esbuild";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    id: string;
  }>;
};

// POST /api/[orgSlug]/emails/templates/[id]/compile - Compile React Email TSX to HTML
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  const log = createRequestLogger({
    path: `/api/${orgSlug}/emails/templates/${id}/compile`,
    method: "POST",
    orgSlug,
  });

  try {
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

    // Verify template exists and belongs to this org
    const existing = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
      columns: { id: true, sourceFormat: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const { source }: { source: string } = await request.json();

    if (!source || typeof source !== "string") {
      return NextResponse.json(
        { error: "source is required" },
        { status: 400 }
      );
    }

    // Step 1: Transform TSX to CJS using esbuild
    const transformed = await transform(source, {
      loader: "tsx",
      jsx: "automatic",
      format: "cjs",
      target: "es2022",
    });

    // Step 2: Execute the transformed code with a require shim
    // Provide react, react/jsx-runtime, and @react-email/components
    const React = await import("react");
    const jsxRuntime = await import("react/jsx-runtime");
    const reactEmailComponents = await import("@react-email/components");

    const moduleShim: Record<string, unknown> = {
      react: React,
      "react/jsx-runtime": jsxRuntime,
      "@react-email/components": reactEmailComponents,
    };

    const requireShim = (id: string) => {
      if (moduleShim[id]) {
        return moduleShim[id];
      }
      throw new Error(
        `Cannot require "${id}" — only react and @react-email/components are available`
      );
    };

    const mod: Record<string, unknown> = {};
    const exports: Record<string, unknown> = {};
    mod.exports = exports;

    // Execute the compiled CJS code
    const fn = new Function("require", "module", "exports", transformed.code);
    fn(requireShim, mod, exports);

    // Extract exports (handle both module.exports and exports patterns)
    const moduleExports = (
      mod.exports !== exports ? mod.exports : exports
    ) as Record<string, unknown>;
    const Component = moduleExports.default as (
      props: Record<string, unknown>
    ) => unknown;
    const exportedSubject = (moduleExports.subject as string) ?? "";
    const exportedEmailType =
      (moduleExports.emailType as string) ?? "marketing";
    const exportedPreviewText = moduleExports.previewText as string | undefined;

    if (typeof Component !== "function") {
      return NextResponse.json(
        {
          error:
            "Template must have a default export (React component function)",
        },
        { status: 422 }
      );
    }

    // Step 3: Render with proxy props that produce {{handlebars}} placeholders
    const props = new Proxy({} as Record<string, string>, {
      get: (_target, prop) => {
        if (typeof prop === "symbol") {
          return;
        }
        return `{{${prop}}}`;
      },
    });

    const { render } = await import("@react-email/render");
    const element = Component(props);
    const compiledHtml = await render(element as React.ReactElement);
    const compiledText = await render(element as React.ReactElement, {
      plainText: true,
    });

    // Step 4: Extract variables from rendered output
    const variables = extractVariables(compiledHtml);

    return NextResponse.json({
      compiledHtml,
      compiledText,
      variables,
      subject: exportedSubject,
      emailType: exportedEmailType,
      previewText: exportedPreviewText,
    });
  } catch (error) {
    log.error({ err: serializeError(error) }, "Template compilation failed");

    const message =
      error instanceof Error ? error.message : "Compilation failed";

    return NextResponse.json(
      { error: "Compilation failed", message },
      { status: 422 }
    );
  }
}

// Extract {{variable}} patterns from rendered HTML
function extractVariables(
  html: string
): Array<{ name: string; fallback?: string }> {
  const vars: Array<{ name: string; fallback?: string }> = [];
  const seen = new Set<string>();
  const regex = /\{\{([a-zA-Z0-9_.]+)(?:\|([^}]*))?\}\}/g;
  let match = regex.exec(html);

  while (match !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      vars.push({ name, fallback: match[2]?.trim() });
    }
    match = regex.exec(html);
  }

  return vars;
}
