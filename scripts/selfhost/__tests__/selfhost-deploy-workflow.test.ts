import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The upgrade job runs on a fresh runner: .env.selfhost is gitignored, so the
// workflow rebuilds it from repository secrets and SST reads only that file.
// Any key deploy.ts writes but the workflow forgets is therefore silently
// dropped on the next CI upgrade — that is how SENTRY_DSN got un-configured
// on every automated run while working fine from a laptop.
const workflowSource = readFileSync(
  new URL("../../../.github/workflows/selfhost-deploy.yml", import.meta.url),
  "utf-8"
);
// Every module that contributes lines to .env.selfhost, not just deploy.ts —
// the DNS settings are built in dns.ts and are dropped on a CI upgrade in
// exactly the same way if the workflow forgets them.
const envFileSources = ["../deploy.ts", "../dns.ts"].map((path) =>
  readFileSync(new URL(path, import.meta.url), "utf-8")
);

const envFileKeys = envFileSources.flatMap((source) =>
  [...source.matchAll(/`([A-Z][A-Z0-9_]*)=\$\{/g)].map((match) => match[1])
);

describe(".github/workflows/selfhost-deploy.yml", () => {
  it("finds the keys deploy.ts writes to .env.selfhost", () => {
    // Guards the regex above, not the workflow.
    expect(envFileKeys).toContain("SENTRY_DSN");
    expect(envFileKeys.length).toBeGreaterThanOrEqual(8);
  });

  it.each(envFileKeys)(
    "reconstructs %s on upgrade — anything missing is dropped from the deployment",
    (key) => {
      expect(workflowSource).toContain(`echo "${key}=`);
    }
  );

  it("passes the Sentry DSN to the first-time deploy as a flag", () => {
    // deploy.ts ignores process.env.SENTRY_DSN on purpose, so exporting the
    // secret into the step's environment would not be enough.
    expect(workflowSource).toContain('args+=(--sentry-dsn "${SENTRY_DSN}")');
  });

  it("ends the reconstruct block with an unconditional command", () => {
    // `[ -n "$X" ] && echo …` is the group's exit status, and the group is the
    // step's last command: a false test on the final optional secret would
    // fail the whole step.
    const block = workflowSource.match(/\{\n[\s\S]*?\} > \.env\.selfhost/)?.[0];
    expect(block).toBeDefined();
    const lastLine = block?.split("\n").at(-2)?.trim();
    expect(lastLine).toBe("true");
  });
});
