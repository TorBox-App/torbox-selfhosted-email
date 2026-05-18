import { auth } from "@wraps/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

const { GET, POST: authPOST } = toNextJsHandler(auth);
export { GET };

export async function POST(request: NextRequest) {
  const url = new URL(request.url);

  if (url.pathname === "/api/auth/sign-up/email") {
    const token = request.headers.get("x-turnstile-token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification required" },
        { status: 400 }
      );
    }

    if (TURNSTILE_SECRET_KEY) {
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
  }

  return authPOST(request);
}
