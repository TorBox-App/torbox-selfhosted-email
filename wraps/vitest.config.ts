import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["templates/__tests__/*.test.tsx"],
  },
});
