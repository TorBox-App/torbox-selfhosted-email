import { next } from "@vercel/edge";

/**
 * Blog post metadata for social crawlers
 * Add new blog posts here with their OG metadata
 */
const BLOG_META: Record<
  string,
  { title: string; description: string; image: string }
> = {
  "/blog/your-dmarc-policy-is-useless": {
    title: "Your DMARC policy is useless",
    description:
      "82% of domains have no DMARC. Of those that do, most set p=none—which tells receivers not to enforce. An interactive deep-dive into email authentication.",
    image: "https://wraps.dev/blog/dmarc-policy-is-useless.png",
  },
};

/**
 * Known social media and search engine crawler user agents
 */
const CRAWLER_PATTERNS = [
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
  "Googlebot",
  "bingbot",
  "Slurp", // Yahoo
  "DuckDuckBot",
  "Baiduspider",
  "yandex",
  "Embedly",
  "Quora Link Preview",
  "Showyoubot",
  "outbrain",
  "pinterest",
  "redditbot",
  "applebot",
];

/**
 * Check if the user agent is a known crawler
 */
function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) {
    return false;
  }
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((pattern) => ua.includes(pattern.toLowerCase()));
}

/**
 * Generate minimal HTML with proper meta tags for crawlers
 */
function generateMetaHtml(
  meta: { title: string; description: string; image: string },
  url: URL
): string {
  const fullUrl = url.toString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${meta.title} | Wraps</title>
  <meta name="title" content="${meta.title} | Wraps">
  <meta name="description" content="${meta.description}">

  <!-- Canonical -->
  <link rel="canonical" href="${fullUrl}">

  <!-- Open Graph / Facebook / LinkedIn -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Wraps">
  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.description}">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:image" content="${meta.image}">
  <meta property="og:image:alt" content="${meta.title}">
  <meta property="og:image:width" content="800">
  <meta property="og:image:height" content="421">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${meta.title}">
  <meta name="twitter:description" content="${meta.description}">
  <meta name="twitter:image" content="${meta.image}">
  <meta name="twitter:image:alt" content="${meta.title}">
</head>
<body>
  <h1>${meta.title}</h1>
  <p>${meta.description}</p>
  <p><a href="${fullUrl}">Read full article at Wraps</a></p>
</body>
</html>`;
}

/**
 * Vercel Edge Middleware
 * Intercepts requests to blog pages and serves crawler-friendly HTML with proper OG tags
 */
export default function middleware(request: Request) {
  const url = new URL(request.url);
  const meta = BLOG_META[url.pathname];

  // Only intercept if this is a blog page with metadata AND a crawler
  if (meta && isCrawler(request.headers.get("user-agent"))) {
    return new Response(generateMetaHtml(meta, url), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  }

  // Let all other requests through to the SPA
  return next();
}

/**
 * Only run middleware on blog routes (performance optimization)
 */
export const config = {
  matcher: "/blog/:path*",
};
