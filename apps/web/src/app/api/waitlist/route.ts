import { createPlatformClient } from "@wraps.dev/client";
import { NextResponse } from "next/server";
import { createRequestLogger, serializeError } from "@/lib/logger";

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Product to topic slug mapping
 */
const PRODUCT_TOPIC_SLUG_MAP: Record<string, string> = {
  sms: "sms-waitlist",
};

const VALID_PRODUCTS = Object.keys(PRODUCT_TOPIC_SLUG_MAP);

function isValidProduct(product: string): boolean {
  return VALID_PRODUCTS.includes(product);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(request: Request) {
  const log = createRequestLogger({ path: "/api/waitlist", method: "POST" });

  try {
    const body = await request.json();
    const { email, product, source, referrer } = body as {
      email?: string;
      product?: string;
      source?: string;
      referrer?: string;
    };

    // Validate email
    if (!(email && isValidEmail(email))) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate product
    if (!(product && isValidProduct(product))) {
      return NextResponse.json(
        {
          error: `Valid product required. Options: ${VALID_PRODUCTS.join(", ")}`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use Wraps' own API key to call the Platform API (dogfooding)
    const apiKey = process.env.WRAPS_API_KEY;
    if (!apiKey) {
      log.error("WRAPS_API_KEY not configured");
      return NextResponse.json(
        { error: "Waitlist not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    const topicSlug = PRODUCT_TOPIC_SLUG_MAP[product];
    const normalizedEmail = email.toLowerCase().trim();

    // Create contact and subscribe to topic using the Platform SDK
    const client = createPlatformClient({ apiKey });
    const { error } = await client.POST("/v1/contacts/", {
      body: {
        email: normalizedEmail,
        emailStatus: "active",
        properties: {
          source: source || "website",
          referrer: referrer || null,
          waitlistProduct: product,
          joinedAt: new Date().toISOString(),
        },
        topicSlugs: [topicSlug],
      },
    });

    if (error) {
      log.error(
        { error, email: normalizedEmail },
        "API error creating contact"
      );
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500, headers: corsHeaders }
      );
    }

    log.info({ email: normalizedEmail, product }, "Contact added to waitlist");
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    log.error({ err: serializeError(error) }, "Failed to add to waitlist");
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}
