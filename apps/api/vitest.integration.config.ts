import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load .env.local from web app (same database as SST dev Lambda)
config({ path: path.resolve(import.meta.dirname, "../web/.env.local") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    include: [
      "src/**/*.integration.test.ts",
      "src/\\(ee\\)/**/*.integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@wraps/db": path.resolve(import.meta.dirname, "../../packages/db/src"),
    },
  },
});
