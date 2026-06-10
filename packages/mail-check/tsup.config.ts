import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/cli.ts"],
  format: ["esm"],
  // Cleaning in watch mode deletes dist on startup, breaking consumers
  // that resolve dist/ during turbo dev
  clean: !options.watch,
  shims: true,
  splitting: false,
  bundle: true,
  minify: false,
  sourcemap: true,
  target: "node24",
  outDir: "dist",
  noExternal: [/(.*)/], // Bundle everything for zero runtime deps
  esbuildOptions(options) {
    options.alias = {
      "@wraps.dev/email-check": "../email-check/src/index.ts",
    };
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: async () => {
    await import("node:fs/promises").then((fs) =>
      fs.chmod("dist/cli.js", 0o755)
    );
  },
}));
