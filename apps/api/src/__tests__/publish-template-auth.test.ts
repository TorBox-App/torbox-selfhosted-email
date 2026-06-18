/**
 * publishTemplateToSES — Auth Gate
 *
 * Verifies that the exported server action enforces verifyOrgAccess before
 * performing any AWS operations.
 *
 * publishTemplateToSES is wrapped by the `orgAction` factory, which runs
 * verifyOrgAccess (and a permission check) before invoking the handler that
 * performs AWS work (getOrAssumeRole / db.query). This asserts both halves of
 * that guarantee at the source level:
 *   1. templates.ts wires publishTemplateToSES through orgAction with the
 *      templates resource + write permission (the auth/permission gate).
 *   2. org-action.ts calls verifyOrgAccess before it invokes the handler.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

describe("publishTemplateToSES — auth gate", () => {
  it("wraps publishTemplateToSES in orgAction with templates write permission", () => {
    const source = readFileSync(
      resolve(REPO_ROOT, "apps/web/src/actions/templates.ts"),
      "utf-8"
    );

    const declIndex = source.indexOf(
      "export const publishTemplateToSES = orgAction("
    );
    expect(declIndex).toBeGreaterThan(-1);

    // The opts object lives between the orgAction( call and the async handler.
    const handlerIndex = source.indexOf("async (", declIndex);
    expect(handlerIndex).toBeGreaterThan(declIndex);

    const optsBlock = source.slice(declIndex, handlerIndex);
    expect(optsBlock).toContain('resource: "templates"');
    expect(optsBlock).toContain('permission: ["write"]');
  });

  it("orgAction calls verifyOrgAccess before invoking the handler", () => {
    const source = readFileSync(
      resolve(REPO_ROOT, "apps/web/src/actions/shared/org-action.ts"),
      "utf-8"
    );

    const verifyIndex = source.indexOf("await verifyOrgAccess(");
    const handlerIndex = source.indexOf("await handler(");

    expect(verifyIndex).toBeGreaterThan(-1);
    expect(handlerIndex).toBeGreaterThan(-1);
    // Auth must gate the handler, which performs the AWS operations.
    expect(verifyIndex).toBeLessThan(handlerIndex);
  });
});
