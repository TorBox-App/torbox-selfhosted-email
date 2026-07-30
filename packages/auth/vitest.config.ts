import path from "node:path";
import { loadEnv, type UserConfig } from "vite";
import { defineConfig } from "vitest/config";
import { resolveTestDatabaseUrl } from "../../scripts/test-db/resolve-branch.mjs";

export default defineConfig(async (): Promise<UserConfig> => {
  // Load .env.test file from apps/web (shared test environment)
  const env = loadEnv(
    "test",
    path.resolve(import.meta.dirname, "../../apps/web"),
    ""
  );
  env.DATABASE_URL = await resolveTestDatabaseUrl(env.DATABASE_URL ?? "", env);

  return {
    test: {
      globals: true,
      environment: "node",
      // Importing `src/index.ts` pulls in better-auth, Stripe and the DB layer;
      // a cold import runs ~2s idle and considerably longer when every package's
      // tests run in parallel. The 5s default made that a timeout under load.
      // `login-alert-sms-vercel-oidc.test.ts` no longer needs this — it imports the leaf
      // `src/login-alert-sms.ts` module instead (~118ms) — but
      // `two-factor-encryption.test.ts` and `stripe-config.test.ts` still
      // import `../index` directly and still need the headroom.
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
