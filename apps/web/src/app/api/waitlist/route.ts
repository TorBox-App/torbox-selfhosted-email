import crypto from "node:crypto";
import { and, apiKey, db, eq, topic } from "@wraps/db";
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

// Cache lookups to avoid repeated DB queries
const topicIdCache = new Map<string, string>();
const orgIdCache = new Map<string, string>();

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function getOrgIdFromApiKey(key: string): Promise<string | null> {
  const keyHash = hashApiKey(key);
  if (orgIdCache.has(keyHash)) {
    return orgIdCache.get(keyHash)!;
  }

  const [result] = await db
    .select({ organizationId: apiKey.organizationId })
    .from(apiKey)
    .where(eq(apiKey.keyHash, keyHash))
    .limit(1);

  if (result) {
    orgIdCache.set(keyHash, result.organizationId);
    return result.organizationId;
  }
  return null;
}

async function getTopicIdBySlug(
  slug: string,
  organizationId: string
): Promise<string | null> {
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
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Create client with the provided API key
function getClient(apiKey: string) {
  return createPlatformClient({ apiKey });
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

    // Get API key from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401, headers: corsHeaders }
      );
    }

    const apiKeyValue = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!apiKeyValue.startsWith("wraps_")) {
      return NextResponse.json(
        { error: "Invalid API key format" },
        { status: 401, headers: corsHeaders }
      );
    }

    const orgId = await getOrgIdFromApiKey(apiKeyValue);
    if (!orgId) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401, headers: corsHeaders }
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
    const platformClient = getClient(apiKeyValue);
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
