import { createPlatformClient } from "@wraps.dev/client";
import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";

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
      // If contact already exists, try to subscribe them to the topic
      const errorMessage =
        error && typeof error === "object" && "error" in error
          ? String((error as { error: unknown }).error)
          : "";

      if (errorMessage.includes("already exists")) {
        log.info(
          { email: normalizedEmail },
          "Contact exists, subscribing to topic"
        );

        // Find existing contact by email (use search param which does ILIKE on email)
        const searchResult = await client.GET("/v1/contacts/", {
          params: { query: { search: normalizedEmail, pageSize: "1" } },
        });

        const contactsData = searchResult.data as
          | { contacts: Array<{ id: string }> }
          | undefined;
        const searchError = searchResult.error;
        const existingContact = contactsData?.contacts?.[0];

        if (searchError || !existingContact) {
          log.error(
            { error: searchError, email: normalizedEmail },
            "Failed to find existing contact"
          );
          return NextResponse.json(
            { error: "Failed to join waitlist" },
            { status: 500, headers: corsHeaders }
          );
        }

        // Subscribe existing contact to the topic
        const { error: updateError } = await client.PATCH("/v1/contacts/{id}", {
          params: { path: { id: existingContact.id } },
          body: {
            topicSlugs: [topicSlug],
          },
        });

        if (updateError) {
          log.error(
            { error: updateError, email: normalizedEmail },
            "Failed to subscribe existing contact to topic"
          );
          return NextResponse.json(
            { error: "Failed to join waitlist" },
            { status: 500, headers: corsHeaders }
          );
        }

        log.info(
          { email: normalizedEmail, product, contactId: existingContact.id },
          "Existing contact subscribed to waitlist"
        );
        return NextResponse.json({ success: true }, { headers: corsHeaders });
      }

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
    log.error({ err: error }, "Failed to add to waitlist");
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
