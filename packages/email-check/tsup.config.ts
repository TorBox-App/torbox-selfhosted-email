import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  // Cleaning in watch mode deletes dist on startup, breaking consumers
  // (apps/api bun --watch) that resolve dist/index.js during turbo dev
  clean: !options.watch,
  sourcemap: true,
}));
