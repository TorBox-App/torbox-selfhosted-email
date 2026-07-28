import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// Bare `@wraps/core` does not resolve from this file's location: `scripts/`
// is not a workspace package (no package.json dependency on @wraps/core), so
// Node's ESM resolution — which Vitest follows here — walks up from this
// file and never finds it. Import the built dist output by relative path
// instead; it is the same module `@wraps/core`'s package.json "exports"
// resolves to from packages that do declare the dependency. Requires
// `packages/core` to be built first (`pnpm build`), which both CI's
// `test:scripts` job and the documented local workflow already do.
import { SELFHOST_CONSOLE_ACCESS_ROLE_NAME } from "../../../packages/core/dist/index.js";

// infra/selfhost.config.ts has no package.json/node_modules of its own — SST
// bundles it with its own esbuild using resolveDir: infra/. Importing
// @wraps/core there breaks `sst deploy` on a customer machine with a
// `Could not resolve "@wraps/core"` error, and nothing in `pnpm check:all`
// would catch it because infra/ is not a workspace package. So the config
// carries a string literal instead of the shared constant — this test is the
// only thing keeping that literal honest.
const configPath = new URL(
  "../../../infra/selfhost.config.ts",
  import.meta.url
);
const configSource = readFileSync(configPath, "utf-8");

describe("infra/selfhost.config.ts WRAPS_CONSOLE_ROLE_NAME literal", () => {
  it("is pinned to SELFHOST_CONSOLE_ACCESS_ROLE_NAME", () => {
    expect(configSource).toContain(
      `WRAPS_CONSOLE_ROLE_NAME: "${SELFHOST_CONSOLE_ACCESS_ROLE_NAME}"`
    );
  });

  it("has no @wraps/ import — one would break the SST esbuild bundle at deploy time", () => {
    expect(configSource).not.toMatch(/^import .*@wraps\//m);
  });
});
