import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load env from web app's .env.local
config({ path: path.resolve(import.meta.dirname, "../web/.env.local") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Sequential execution required when using shared database
    fileParallelism: false,
    include: ["src/**/*.test.ts", "src/\\(ee\\)/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/routes/**/*.ts",
        "src/middleware/**/*.ts",
        "src/\\(ee\\)/routes/**/*.ts",
        "src/\\(ee\\)/workers/**/*.ts",
      ],
      exclude: ["**/__tests__/**", "**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@wraps/db": path.resolve(import.meta.dirname, "../../packages/db/src"),
    },
  },
});
