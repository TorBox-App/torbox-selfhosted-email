import { auth } from "@wraps/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

// PUT/PATCH/DELETE are not optional: the SCIM plugin serves user updates on
// PUT and PATCH and deprovisioning on DELETE (/api/auth/scim/v2/Users/:id).
// Exporting only GET and POST made Next.js answer every IdP update, deactivate
// and delete push with 405, so provisioning appeared to work (Create is a POST)
// and then silently stopped syncing.
const { GET, POST: authPOST, PUT, PATCH, DELETE } = toNextJsHandler(auth);
export { GET, PUT, PATCH, DELETE };

export async function POST(request: NextRequest) {
  const url = new URL(request.url);

  if (url.pathname === "/api/auth/sign-up/email" && TURNSTILE_SECRET_KEY) {
    const token = request.headers.get("x-turnstile-token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification required" },
        { status: 400 }
      );
    }

    const verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: TURNSTILE_SECRET_KEY,
          response: token,
        }),
      }
    );
    const result = await verifyResponse.json();
    if (!result.success) {
      return NextResponse.json(
        { error: "Verification failed. Please try again." },
        { status: 403 }
      );
    }
  }

  return authPOST(request);
}
