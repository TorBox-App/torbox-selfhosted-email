import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(() => {
  // Load .env.test file from apps/web (shared test environment)
  const env = loadEnv(
    "test",
    path.resolve(import.meta.dirname, "../../apps/web"),
    ""
  );

  return {
    test: {
      globals: true,
      environment: "node",
      // Importing `src/index.ts` pulls in better-auth, Stripe and the DB layer;
      // a cold import runs ~2s idle and considerably longer when every package's
      // tests run in parallel. The 5s default made that a timeout under load.
      testTimeout: 30_000,
      hookTimeout: 30_000,
      // Load environment variables from apps/web/.env.test
      env,
    },
    resolve: {
      alias: {
        "@wraps/db": path.resolve(import.meta.dirname, "../db/src"),
        "@wraps/email": path.resolve(import.meta.dirname, "../email/src"),
      },
    },
  };
});
