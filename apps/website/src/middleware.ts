import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/markdown")) {
    return NextResponse.next();
  }

  // Serve llms.txt as markdown for any page request from an AI agent
  const llmsUrl = new URL("/llms.txt", request.nextUrl.origin);
  const res = await fetch(llmsUrl, { next: { revalidate: 3600 } });

  if (!res.ok) {
    return NextResponse.next();
  }

  const body = await res.text();

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export const config = {
  // Match all pages; exclude static assets, API routes, and Next.js internals
  matcher: [
    "/((?!_next|api|ingest|.*\\.(?:js|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|mp4|pdf|zip)).*)",
  ],
};
