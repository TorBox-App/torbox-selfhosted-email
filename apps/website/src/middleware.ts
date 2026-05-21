import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/markdown")) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  // Route the request to /api/md/<path> so dynamic route params carry the page path
  const mdPath = pathname === "/" ? "/api/md/root" : `/api/md${pathname}`;
  const mdUrl = new URL(mdPath, request.nextUrl.origin);

  return NextResponse.rewrite(mdUrl);
}

export const config = {
  // Match all pages; exclude static assets, API routes, and Next.js internals
  matcher: [
    "/((?!_next|api|ingest|.*\\.(?:js|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|mp4|pdf|zip)).*)",
  ],
};
