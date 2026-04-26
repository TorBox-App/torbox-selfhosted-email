import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: false, // Don't clean - console UI and Lambda bundles are already built here
  shims: true,
  splitting: false,
  bundle: true,
  minify: false, // Keep readable for debugging
  sourcemap: true,
  target: "node24",
  outDir: "dist",
  noExternal: ["@wraps.dev/email-check", "@wraps/core"], // Bundle workspace packages into CLI
  onSuccess: async () => {
    // Make CLI executable
    await import("node:fs/promises").then((fs) =>
      fs.chmod("dist/cli.js", 0o755)
    );
  },
});
