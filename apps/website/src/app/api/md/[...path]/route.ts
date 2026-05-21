import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AGENT_CONTENT } from "@/lib/agent-content";

const MD_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  Vary: "Accept",
  "Cache-Control": "public, max-age=3600",
} as const;

function getLlmsFallback(): string {
  try {
    return readFileSync(join(process.cwd(), "public", "llms.txt"), "utf-8");
  } catch {
    return AGENT_CONTENT["/"];
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  // "root" is a sentinel for "/" since Next.js dynamic routes can't match empty segments
  const pagePath =
    path[0] === "root" && path.length === 1 ? "/" : `/${path.join("/")}`;
  const content = AGENT_CONTENT[pagePath] ?? getLlmsFallback();

  return new NextResponse(content, { headers: MD_HEADERS });
}
