import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_EVENT_TYPES,
  CONSOLE_ACCESS_ROLE_NAME,
  SELFHOST_CONSOLE_ACCESS_ROLE_NAME,
} from "@wraps/core";
import { describe, expect, it } from "vitest";

/**
 * Plan 180: the docs that fed the BYOC spec its wrong facts were never
 * checked against code — `wraps-email-events` (an SQS queue) was documented
 * as a DynamoDB table, and the event-type list README.md:434 claimed was
 * incomplete (six of the ten registered types). Both errors sat undetected
 * until a marketing page inherited them and a review caught it there — the
 * last place it could have been caught.
 *
 * This guards the two highest-value, most-parseable claims in
 * `packages/cli/README.md` against the same drift recurring silently:
 *
 * 1. The event-type list in the "Configuration Presets" section must match
 *    `ALL_EVENT_TYPES` (the canonical list created in plan 182) exactly —
 *    not a hand-copied subset that can fall out of sync.
 * 2. Every `.ts` filename the README's directory tree claims lives under
 *    `infrastructure/resources/` must actually exist there — this is what
 *    would have caught the stale `src/lambda/event-processor/` entry (the
 *    Lambda source moved to the sibling `packages/core/lambda/` package).
 * 3. The two IAM role names README.md's Selfhost Commands section names in
 *    prose must match the actual exported constants — not a copy that can
 *    drift if the role is ever renamed in code.
 *
 * This deliberately does NOT assert the reverse of (2) — that every file
 * under `infrastructure/resources/` appears in the README's tree. The tree
 * has always been a partial, illustrative listing (it omits several real
 * resource files, e.g. `dynamodb-agent-policy.ts`, `iam-agent-user.ts`), and
 * making the guard require full parity would force a restructuring of the
 * README's tree section as a side effect of writing a guard — the kind of
 * guard plan 180 explicitly said not to build unilaterally. One direction
 * (README claims a file that doesn't exist) already catches the class of
 * bug this plan is about; the other direction is a documentation-completeness
 * concern, not a correctness one.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const readmePath = join(__dirname, "../../README.md");
const readme = readFileSync(readmePath, "utf-8");

describe("packages/cli/README.md resource inventory", () => {
  it("lists all 10 registered SES event types, matching ALL_EVENT_TYPES exactly", () => {
    const match = readme.match(
      /Tracks all 10 registered SES event types: ([A-Z_, ]+)/
    );
    expect(
      match,
      "expected the event-type list line to be present"
    ).not.toBeNull();

    const listedTypes = match![1]!.trim().split(/,\s*/);
    expect(listedTypes).toEqual(ALL_EVENT_TYPES);
  });

  it("every resource filename claimed under infrastructure/resources/ actually exists there", () => {
    const start = readme.indexOf("resources/           # Resource definitions");
    const end = readme.indexOf("├── console/", start);
    expect(
      start,
      "expected to find the resources/ tree anchor"
    ).toBeGreaterThan(-1);
    expect(
      end,
      "expected to find the console/ tree anchor after it"
    ).toBeGreaterThan(start);

    const treeBlock = readme.slice(start, end);
    const filenames = [...treeBlock.matchAll(/([a-z0-9-]+\.ts)/g)].map(
      (m) => m[1]!
    );

    // Guards the extraction itself — if this drops to 0, the anchors above
    // silently stopped matching and every assertion below is vacuous.
    expect(filenames.length).toBeGreaterThan(10);

    const resourcesDir = join(__dirname, "../infrastructure/resources");
    for (const filename of filenames) {
      expect(
        existsSync(join(resourcesDir, filename)),
        `README claims ${filename} exists under infrastructure/resources/, but it does not`
      ).toBe(true);
    }
  });

  it("names the platform console-access role correctly", () => {
    expect(readme).toContain(`\`${CONSOLE_ACCESS_ROLE_NAME}\``);
  });

  it("names the self-hosted console-access role correctly", () => {
    expect(readme).toContain(`\`${SELFHOST_CONSOLE_ACCESS_ROLE_NAME}\``);
  });
});
