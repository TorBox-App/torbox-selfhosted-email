import { auth } from "@wraps/auth";
import { db, template } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { extractBrandKitFromHtml } from "@/lib/brand-kit/extract-from-html";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

// POST /api/[orgSlug]/brand-kits/from-template - Extract brand kit from a react-email template
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

    const body = await request.json();
    const { templateId } = body;

    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    // Fetch the template, scoped to this organization
    const templateRecord = await db.query.template.findFirst({
      where: and(
        eq(template.id, templateId),
        eq(template.organizationId, orgWithMembership.id)
      ),
    });

    if (!templateRecord) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Ensure it's a react-email template with compiled HTML
    if (
      templateRecord.sourceFormat !== "react-email" ||
      !templateRecord.compiledHtml
    ) {
      return NextResponse.json(
        {
          error:
            "Only react-email templates with compiled HTML can be used for brand extraction",
        },
        { status: 400 }
      );
    }

    // Extract brand kit from the compiled HTML
    const extracted = extractBrandKitFromHtml(
      templateRecord.compiledHtml,
      templateRecord.name
    );

    return NextResponse.json({
      success: true,
      brandKit: {
        name: `Brand from ${templateRecord.name}`,
        logoUrl: extracted.logoUrl,
        primaryColor: extracted.primaryColor,
        secondaryColor: extracted.secondaryColor,
        backgroundColor: extracted.backgroundColor,
        textColor: extracted.textColor,
        fontFamily: extracted.fontFamily,
        headingFontFamily: extracted.headingFontFamily,
        buttonStyle: extracted.buttonStyle,
        buttonRadius: extracted.buttonRadius,
        companyName: extracted.companyName,
        autoExtracted: true,
      },
    });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/brand-kits/from-template",
      method: "POST",
    });
    log.error(
      { err: serializeError(error) },
      "Error extracting brand kit from template"
    );
    return NextResponse.json(
      { error: "Failed to extract brand kit from template" },
      { status: 500 }
    );
  }
}
