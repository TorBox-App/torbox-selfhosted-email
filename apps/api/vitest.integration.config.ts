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
    // Integration tests drive live AWS (SQS/EventBridge/Lambda) over multiple
    // sequential round-trips. The 5s default is far too tight; give them room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Absorb genuinely transient AWS eventual-consistency blips (e.g. an
    // UpdateSchedule racing a just-created schedule). Tests seed idempotently
    // (onConflictDoUpdate) and clean up per-test, so retries are safe — but
    // tests must not lean on retry to mask deterministic bugs; fix those at the source.
    retry: 2,
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
