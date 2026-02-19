import { globSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://wraps.dev";
  const appDir = join(process.cwd(), "src/app");

  const pages = globSync("**/page.tsx", { cwd: appDir });

  const routes = pages
    .map((file) => {
      const route = file
        .replace(/\/page\.tsx$/, "")
        .replace(/page\.tsx$/, "")
        .replace(/\([^)]+\)\/?/g, ""); // strip route groups like (auth)/
      return `/${route}`.replace(/\/$/, "") || "/";
    })
    .filter((route) => route !== "/sitemap")
    .sort();

  return routes.map((route) => ({
    url: `${baseUrl}${route === "/" ? "" : route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority:
      route === "/"
        ? 1
        : route.startsWith("/tools")
          ? 0.9
          : route.startsWith("/docs")
            ? 0.8
            : 0.7,
  }));
}
