/**
 * Waitlist API endpoint (Next.js Route Handler)
 * Creates contacts in the Wraps Platform using the SDK
 */

import { createPlatformClient } from "@wraps.dev/client";
import { type NextRequest, NextResponse } from "next/server";

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

/**
 * CORS headers for all responses
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Handle OPTIONS request (CORS preflight)
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * Waitlist API handler
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      product?: string;
      source?: string;
      referrer?: string;
    };

    const { email, product, source, referrer } = body;

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
      console.error("WRAPS_API_KEY not configured");
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
        console.log(`Contact exists, subscribing to topic: ${normalizedEmail}`);

        // Find existing contact by email
        const searchResult = await client.GET("/v1/contacts/", {
          params: { query: { search: normalizedEmail, pageSize: "1" } },
        });

        const contactsData = searchResult.data as
          | { contacts: Array<{ id: string }> }
          | undefined;
        const searchError = searchResult.error;
        const existingContact = contactsData?.contacts?.[0];

        if (searchError || !existingContact) {
          console.error(
            "Failed to find existing contact:",
            JSON.stringify(searchError, null, 2)
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
          console.error(
            "Failed to subscribe existing contact to topic:",
            JSON.stringify(updateError, null, 2)
          );
          return NextResponse.json(
            { error: "Failed to join waitlist" },
            { status: 500, headers: corsHeaders }
          );
        }

        console.log(
          `Existing contact subscribed to waitlist: ${normalizedEmail} for ${product}`
        );
        return NextResponse.json({ success: true }, { headers: corsHeaders });
      }

      console.error(
        "API error creating contact:",
        JSON.stringify(error, null, 2)
      );
      return NextResponse.json(
        {
          error: "Failed to join waitlist",
          details: process.env.NODE_ENV === "development" ? error : undefined,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`Contact added to waitlist: ${normalizedEmail} for ${product}`);
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to add to waitlist:", error);
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500, headers: corsHeaders }
    );
  }
}
