import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db, waitlist } from "@wraps/db";

/**
 * Hash email with SHA-256 for deduplication
 */
function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valid products for waitlist
 */
const VALID_PRODUCTS = ["sms", "queue"] as const;
type ValidProduct = (typeof VALID_PRODUCTS)[number];

function isValidProduct(product: string): product is ValidProduct {
  return VALID_PRODUCTS.includes(product as ValidProduct);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, product, source, referrer } = body as {
      email?: string;
      product?: string;
      source?: string;
      referrer?: string;
    };

    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate product
    if (!product || !isValidProduct(product)) {
      return NextResponse.json(
        { error: `Valid product required. Options: ${VALID_PRODUCTS.join(", ")}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = hashEmail(normalizedEmail);

    // Insert into waitlist, ignore duplicates
    await db
      .insert(waitlist)
      .values({
        email: normalizedEmail,
        emailHash,
        product,
        source: source || "website",
        referrer: referrer || null,
      })
      .onConflictDoNothing();

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("Waitlist API error:", error);
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
