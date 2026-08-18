import { defineConfig } from "@wraps.dev/client";

export default defineConfig({
  org: "wraps",
  from: { email: "hello@wraps.dev", name: "Wraps" },
  region: "us-east-1",
  templatesDir: "./templates",
  brandFile: "./brand.ts",
});
