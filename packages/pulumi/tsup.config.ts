import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: { resolve: ["@wraps/core"] }, // Bundle core's types, not just its JS
  sourcemap: true,
  clean: true,
  external: ["@pulumi/pulumi", "@pulumi/aws"],
  noExternal: ["@wraps/core"], // Bundle core into package
});
