/**
 * Proxy for email-check API with Cloudflare Turnstile verification.
 * Validates the Turnstile token before forwarding to the real API.
 */

import { type NextRequest, NextResponse } from "next/server";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const API_URL = "https://api.wraps.dev";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { turnstileToken, ...emailCheckPayload } = body;

    if (!turnstileToken || typeof turnstileToken !== "string") {
      return NextResponse.json(
        { error: "Verification required" },
        { status: 400 }
      );
    }

    if (!TURNSTILE_SECRET_KEY) {
      console.error("TURNSTILE_SECRET_KEY not configured");
      return NextResponse.json(
        { error: "Verification not configured" },
        { status: 500 }
      );
    }

    const verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: TURNSTILE_SECRET_KEY,
          response: turnstileToken,
        }),
      }
    );

    const verifyResult = await verifyResponse.json();

    if (!verifyResult.success) {
      return NextResponse.json(
        { error: "Verification failed. Please try again." },
        { status: 403 }
      );
    }

    const apiResponse = await fetch(`${API_URL}/tools/email-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailCheckPayload),
    });

    const data = await apiResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Email check proxy error:", error);
    return NextResponse.json(
      { error: "Failed to check domain" },
      { status: 500 }
    );
  }
}
