/**
 * Waitlist API endpoint (Vercel Serverless Function)
 * Creates contacts in the Wraps Platform using the SDK
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createPlatformClient } from "@wraps.dev/client";

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
 * Waitlist API handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).end();
    return;
  }

  // Only accept POST
  if (req.method !== "POST") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { email, product, source, referrer } = req.body as {
      email?: string;
      product?: string;
      source?: string;
      referrer?: string;
    };

    // Validate email
    if (!(email && isValidEmail(email))) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    // Validate product
    if (!(product && isValidProduct(product))) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(400).json({
        error: `Valid product required. Options: ${VALID_PRODUCTS.join(", ")}`,
      });
      return;
    }

    // Use Wraps' own API key to call the Platform API (dogfooding)
    const apiKey = process.env.WRAPS_API_KEY;
    if (!apiKey) {
      console.error("WRAPS_API_KEY not configured");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(500).json({ error: "Waitlist not configured" });
      return;
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
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.status(500).json({ error: "Failed to join waitlist" });
          return;
        }

        // Subscribe existing contact to the topic
        const { error: updateError } = await client.PATCH(
          "/v1/contacts/{id}",
          {
            params: { path: { id: existingContact.id } },
            body: {
              topicSlugs: [topicSlug],
            },
          }
        );

        if (updateError) {
          console.error(
            "Failed to subscribe existing contact to topic:",
            JSON.stringify(updateError, null, 2)
          );
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.status(500).json({ error: "Failed to join waitlist" });
          return;
        }

        console.log(
          `Existing contact subscribed to waitlist: ${normalizedEmail} for ${product}`
        );
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({ success: true });
        return;
      }

      console.error(
        "API error creating contact:",
        JSON.stringify(error, null, 2)
      );
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(500).json({
        error: "Failed to join waitlist",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      });
      return;
    }

    console.log(`Contact added to waitlist: ${normalizedEmail} for ${product}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to add to waitlist:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ error: "Failed to join waitlist" });
  }
}
