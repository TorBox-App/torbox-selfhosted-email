export const dynamic = "force-static";

export function GET() {
  const content = `# Wraps - Email Infrastructure for Developers
# https://wraps.dev

# Content Signals (https://contentsignals.org/)
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: *
Allow: /
Disallow: /api/
Disallow: /ingest/
Disallow: /_next/

Sitemap: https://wraps.dev/sitemap.xml
`;

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
