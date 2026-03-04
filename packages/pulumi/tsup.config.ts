import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@pulumi/pulumi", "@pulumi/aws"],
  noExternal: ["@wraps/core"], // Bundle core into package
});
