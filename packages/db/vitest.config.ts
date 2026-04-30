import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ path: "../../apps/web/.env.local" });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
});
