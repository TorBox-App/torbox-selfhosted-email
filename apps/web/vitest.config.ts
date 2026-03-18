import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // Load .env.test file
  const env = loadEnv("test", process.cwd(), "");

  return {
    test: {
      globals: true,
      environment: "node",
      // Use jsdom for component tests
      environmentMatchGlobs: [["src/components/**/*.test.{ts,tsx}", "jsdom"]],
      setupFiles: ["./src/lib/permissions/__tests__/setup.ts"],
      // Sequential execution required when using shared database with afterEach cleanup
      fileParallelism: false,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: [
          "src/lib/permissions/**/*.ts",
          "src/actions/**/*.ts",
          "src/lib/**/*.ts",
        ],
        exclude: ["**/__tests__/**", "**/*.test.ts", "**/types.ts"],
      },
      // Load environment variables from .env.test
      env,
      server: {
        deps: {
          // pathfinding is CJS but imported via ESM by @jalez/react-flow-smart-edge
          inline: ["pathfinding", "@jalez/react-flow-smart-edge"],
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "@wraps/db": path.resolve(import.meta.dirname, "../../packages/db/src"),
        "@wraps/auth": path.resolve(
          import.meta.dirname,
          "../../packages/auth/src"
        ),
        // Library's main entry uses CJS but package.json has "type": "module" — resolve to ESM bundle
        "@jalez/react-flow-smart-edge": path.resolve(
          import.meta.dirname,
          "node_modules/@jalez/react-flow-smart-edge/dist/react-flow-smart-edge.esm.js"
        ),
      },
    },
  };
});
