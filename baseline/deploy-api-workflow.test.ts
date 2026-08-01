import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The hosted API deploy had no migration step at all, so every schema change
// reached production only if someone remembered to run `db:migrate` by hand.
// batch_send.paused_at is what happened when nobody did: the column and the
// broadcast-reaper query that reads it shipped in the same commit, the Lambda
// went live, and the reaper threw `column batch_send.paused_at does not exist`
// on every run until the migration was applied out of band.
//
// scripts/selfhost/upgrade.ts already learned this and migrates before
// deploying; this file holds the same guarantee for the hosted pipeline.
const workflowSource = readFileSync(
  new URL("../.github/workflows/deploy-api.yml", import.meta.url),
  "utf-8"
);

// Anchored to the `run:` commands, not bare mentions: both strings also appear
// in the prose explaining why the order matters, and a comment sitting above
// the migrate step would otherwise register as the deploy happening first.
const migrateIndex = workflowSource.search(/^\s+run: .*db:migrate/m);
const deployIndex = workflowSource.search(/^\s+run: .*sst deploy/m);

// Scoped to the migrate step alone: DATABASE_URL is also mapped into the deploy
// step, which would satisfy a file-wide match while leaving migrate with none.
const MIGRATE_STEP =
  /- name: Run database migrations[\s\S]*?(?=\n {6}- name: )/;
const DATABASE_URL_FROM_SECRETS = /^\s+DATABASE_URL: \$\{\{ secrets\./m;

describe(".github/workflows/deploy-api.yml", () => {
  it("runs database migrations as part of the deploy", () => {
    expect(migrateIndex).toBeGreaterThan(-1);
  });

  it("runs migrations BEFORE deploying new code", () => {
    // `sst deploy` publishes each Lambda's new code as that function updates,
    // well before the command returns, so migrating afterwards still leaves a
    // window where new code runs against the old schema. Order is the whole
    // guarantee, so assert the order rather than only that both steps exist.
    //
    // This order also fails the better way round: a migration that dies leaves
    // the old code on the old schema, which works. The other order leaves new
    // code on the old schema, which does not.
    // Both bounds asserted: a missing migrate step leaves migrateIndex at -1,
    // which would sit "before" the deploy and pass this on a vacuous truth.
    expect(migrateIndex).toBeGreaterThan(-1);
    expect(deployIndex).toBeGreaterThan(-1);
    expect(migrateIndex).toBeLessThan(deployIndex);
  });

  it("gives the migration step a database to connect to", () => {
    // drizzle-kit reads DATABASE_URL from the environment: its dotenv call
    // targets apps/web/.env.local, which does not exist on a CI runner, and
    // dotenv does not override an already-set variable anyway. A migrate step
    // without this mapping connects to an empty URL and fails the deploy.
    const migrateStep = workflowSource.match(MIGRATE_STEP)?.[0];
    expect(migrateStep).toBeDefined();
    expect(migrateStep).toMatch(DATABASE_URL_FROM_SECRETS);
  });
});
