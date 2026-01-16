import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["aws-cdk-lib", "constructs"],
  noExternal: ["@wraps/core"], // Bundle core into package
});
