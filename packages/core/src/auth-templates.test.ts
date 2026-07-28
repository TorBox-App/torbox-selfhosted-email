import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTH_SES_TEMPLATES } from "./auth-templates.js";

/**
 * SES substitutes exactly the keys passed as `templateData` and renders an
 * unmatched key as EMPTY rather than failing. That makes drift invisible at
 * every layer: the send succeeds, the event stream shows Delivery, and the
 * recipient gets a mail with a blank greeting or a dead verification link.
 * These tests are the only thing that fails.
 */

describe("template variable contract with the senders", () => {
  const senderFor: Record<string, string> = {
    "email-verification": "verification.ts",
    "mobile-rescue": "mobile-rescue.ts",
    "team-invitation": "invitation.ts",
  };

  /** Every {{x}}, {{{x}}} and {{#if x}} reference in a template body. */
  function placeholders(template: {
    subject: string;
    htmlPart: string;
    textPart: string;
  }): Set<string> {
    const source = [
      template.subject,
      template.htmlPart,
      template.textPart,
    ].join("\n");
    const found = new Set<string>();
    for (const match of source.matchAll(
      /\{\{\{?\s*(?:#if\s+)?([\w.]+)\s*\}?\}\}/g
    )) {
      const name = match[1];
      // Block terminators and the else arm are syntax, not data.
      if (name && name !== "else" && name !== "if") {
        found.add(name);
      }
    }
    return found;
  }

  /** The templateData keys a sender actually passes to sendTemplate(). */
  function senderKeys(file: string): Set<string> {
    const source = readFileSync(
      new URL(`../../email/src/emails/${file}`, import.meta.url),
      "utf-8"
    );
    const block = source.slice(source.indexOf("templateData: {"));
    const body = block.slice(0, block.indexOf("\n    },"));
    const keys = new Set<string>();
    // `[,:]` — mobile-rescue and invitation pass several keys as ES shorthand
    // (`workspaceItemsHtml,`), so a colon-only match silently reads them as an
    // empty key set and the contract check passes vacuously.
    for (const match of body.matchAll(/^\s{6}(\w+)[,:]/gm)) {
      if (match[1]) {
        keys.add(match[1]);
      }
    }
    return keys;
  }

  for (const template of AUTH_SES_TEMPLATES) {
    const file = senderFor[template.templateName];

    it(`${template.templateName}: every placeholder is supplied by ${file}`, () => {
      const supplied = senderKeys(file as string);
      expect(supplied.size).toBeGreaterThan(0);

      const unsupplied = [...placeholders(template)].filter(
        (name) => !supplied.has(name)
      );
      // An unsupplied placeholder renders empty — a blank greeting or, worse,
      // a dead verification link.
      expect(unsupplied).toEqual([]);
    });

    it(`${template.templateName}: sampleData covers every placeholder`, () => {
      // TestRenderEmailTemplate only proves what it is given values for.
      const missing = [...placeholders(template)].filter(
        (name) => !(name in template.sampleData)
      );
      expect(missing).toEqual([]);
    });
  }

  it("team-invitation interpolates workspaceItemsHtml raw", () => {
    const invitation = AUTH_SES_TEMPLATES.find(
      (t) => t.templateName === "team-invitation"
    );
    // buildWorkspaceItemsHtml returns <li> markup. A double stash escapes it
    // and prints the tags to the recipient as visible text.
    expect(invitation?.htmlPart).toContain("{{{workspaceItemsHtml}}}");
  });
});
