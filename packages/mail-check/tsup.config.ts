import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  clean: true,
  shims: true,
  splitting: false,
  bundle: true,
  minify: false,
  sourcemap: true,
  target: "node20",
  outDir: "dist",
  noExternal: [/(.*)/], // Bundle everything for zero runtime deps
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: async () => {
    await import("node:fs/promises").then((fs) =>
      fs.chmod("dist/cli.js", 0o755)
    );
  },
});
