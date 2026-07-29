import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const { version } = createRequire(import.meta.url)("./package.json");

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(version),
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
