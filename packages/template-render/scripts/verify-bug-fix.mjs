#!/usr/bin/env node
/**
 * Manual verification script for the SES test-send Handlebars bug fix.
 *
 * Reproduces the exact template body that was leaking raw `{{#if firstName}}`
 * to inboxes from the dashboard's "Send test email" path, runs it through
 * the canonical @wraps/template-render renderer, and prints the result.
 *
 * Usage: pnpm --filter @wraps/template-render exec node scripts/verify-bug-fix.mjs
 */

import { renderTemplate } from "../src/render.ts";

const reengagementSubject =
  "The setup just got easier{{#if firstName}}, {{firstName}}{{/if}}.";

const reengagementBodyFragment =
  "{{#if firstName}}Hey {{firstName}}, the{{else}}The{{/if}} setup just got easier.";

console.log("\n=== Subject (firstName: Jarod) ===");
console.log(renderTemplate(reengagementSubject, { firstName: "Jarod" }));

console.log("\n=== Subject (no firstName) ===");
console.log(renderTemplate(reengagementSubject, {}));

console.log("\n=== Body fragment (firstName: Jarod) ===");
console.log(renderTemplate(reengagementBodyFragment, { firstName: "Jarod" }));

console.log("\n=== Body fragment (no firstName) ===");
console.log(renderTemplate(reengagementBodyFragment, {}));

console.log(
  "\nIf any of the above contain the literal `{{#if`, `{{else}}`, or `{{/if}}`,"
);
console.log("the fix is NOT in place. Otherwise the consolidation is working.");
