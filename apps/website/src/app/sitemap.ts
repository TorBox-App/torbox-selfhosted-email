import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://wraps.dev";

  // Static pages
  const staticPages = [
    "",
    "/calculator",
    "/tools",
    "/tools/spf-builder",
    "/why-wraps",
    "/sms",
    "/cli",
    "/platform",
    "/changelog",
    "/privacy",
    "/terms",
    "/blog",
    "/blog/your-dmarc-policy-is-useless",
    "/blog/ses-sandbox-guide",
    "/blog/ses-production-architecture",
    "/blog/spf-guide",
    "/docs",
    "/docs/quickstart",
    "/docs/quickstart/email",
    "/docs/quickstart/sms",
    "/docs/quickstart/cdn",
    "/docs/quickstart/platform",
    "/docs/sdk-reference",
    "/docs/client-sdk-reference",
    "/docs/sms-sdk-reference",
    "/docs/cdk-reference",
    "/docs/pulumi-reference",
    "/docs/cli-reference",
    "/docs/cli-reference/email",
    "/docs/cli-reference/cdn",
    "/docs/cli-reference/sms",
    "/docs/guides",
    "/docs/guides/production-access",
    "/docs/guides/domain-verification",
    "/docs/guides/aws-setup",
    "/docs/guides/aws-setup/quick",
    "/docs/guides/aws-setup/full",
    "/docs/guides/aws-setup/troubleshooting",
    "/docs/telemetry",
  ];

  return staticPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.startsWith("/docs") ? 0.8 : 0.7,
  }));
}
