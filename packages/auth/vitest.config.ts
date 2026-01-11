import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // Load .env.test file from apps/web (shared test environment)
  const env = loadEnv("test", path.resolve(__dirname, "../../apps/web"), "");

  return {
    test: {
      globals: true,
      environment: "node",
      // Load environment variables from apps/web/.env.test
      env,
    },
    resolve: {
      alias: {
        "@wraps/db": path.resolve(__dirname, "../db/src"),
        "@wraps/email": path.resolve(__dirname, "../email/src"),
      },
    },
  };
});
