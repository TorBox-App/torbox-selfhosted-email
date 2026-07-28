import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A self-hosted deployment is licensed, not metered. The API lifts its rate
// limits, plan gates and monthly event cap via isSelfHosted(), which reads
// process.env.WRAPS_LICENSE_KEY (apps/api/src/(ee)/lib/license.ts). The SST
// config used to inject the license into the API Lambda as bare LICENSE_KEY,
// so isSelfHosted() was false on every self-hosted API request and a paying
// customer was throttled — and told to upgrade — on their own hardware.
//
// This is a text-source test rather than an import because infra/ is not a
// workspace package: it has no package.json, no node_modules and no tsconfig,
// so neither `pnpm typecheck` nor any package's vitest run evaluates it. The
// only true evaluator is scripts/selfhost/eval-config.mjs in the CI
// selfhost-smoke job, which needs `sst install` and built packages. This
// assertion is the cheap guard that runs in `pnpm test:scripts`.
//
// Note the two load-bearing names: the .env.selfhost key stays LICENSE_KEY
// (scripts/selfhost/deploy.ts writes it, upgrade.ts reads it back), and only
// the injected Lambda variable is WRAPS_LICENSE_KEY.
const configPath = new URL(
  "../../../infra/selfhost.config.ts",
  import.meta.url
);
const configSource = readFileSync(configPath, "utf-8");

describe("infra/selfhost.config.ts license key injection", () => {
  it("injects the license into the API Lambda as WRAPS_LICENSE_KEY", () => {
    expect(configSource).toContain(
      'WRAPS_LICENSE_KEY: process.env.LICENSE_KEY ?? ""'
    );
  });

  it("injects nothing under the bare name LICENSE_KEY — the API would ignore it", () => {
    expect(configSource).not.toMatch(/(?<!WRAPS_)LICENSE_KEY:\s*process\.env/);
  });

  it("covers both consumers — the API Lambda and the web app", () => {
    expect(configSource.match(/WRAPS_LICENSE_KEY:/g)?.length).toBe(2);
  });
});
