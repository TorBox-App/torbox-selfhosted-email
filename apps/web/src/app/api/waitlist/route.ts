import { createPlatformClient } from "@wraps.dev/client";
import { and, db, eq, topic } from "@wraps/db";
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

// Cache topic IDs to avoid repeated DB lookups
const topicIdCache = new Map<string, string>();

async function getTopicIdBySlug(slug: string, organizationId: string): Promise<string | null> {
  const cacheKey = `${organizationId}:${slug}`;
  if (topicIdCache.has(cacheKey)) {
    return topicIdCache.get(cacheKey)!;
  }

  const [result] = await db
    .select({ id: topic.id })
    .from(topic)
    .where(and(eq(topic.slug, slug), eq(topic.organizationId, organizationId)))
    .limit(1);

  if (result) {
    topicIdCache.set(cacheKey, result.id);
    return result.id;
  }
  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Lazy-initialize the client
let client: ReturnType<typeof createPlatformClient> | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.WRAPS_API_KEY;
    if (!apiKey) {
      throw new Error("WRAPS_API_KEY environment variable is required");
    }
    client = createPlatformClient({
      apiKey,
      baseUrl: process.env.WRAPS_API_URL,
    });
  }
  return client;
}

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

    const orgId = process.env.WRAPS_ORG_ID;
    if (!orgId) {
      log.error("WRAPS_ORG_ID environment variable is required");
      return NextResponse.json(
        { error: "Waitlist not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    const topicSlug = PRODUCT_TOPIC_SLUG_MAP[product];
    const topicId = await getTopicIdBySlug(topicSlug, orgId);
    if (!topicId) {
      log.warn({ product, topicSlug }, "Topic not found for product");
      return NextResponse.json(
        { error: "Waitlist not configured for this product" },
        { status: 500, headers: corsHeaders }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Create contact and subscribe to topic using the Platform SDK
    const platformClient = getClient();
    const { error } = await platformClient.POST("/v1/contacts/", {
      body: {
        email: normalizedEmail,
        emailStatus: "active",
        properties: {
          source: source || "website",
          referrer: referrer || null,
          waitlistProduct: product,
          joinedAt: new Date().toISOString(),
        },
        topicIds: [topicId],
      },
    });

    if (error) {
      log.error({ error, email: normalizedEmail }, "API error creating contact");
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
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
