/**
 * Tests for the (private) `substituteVariables` helper inside
 * `@wraps/email`'s subscription confirmation mailer.
 *
 * This helper renders Handlebars-flavored confirmation templates against a
 * recipient's variable dict before SES sends the email. The previous
 * implementation was a pure regex substituter that left `{{#if}}` blocks
 * untouched. After the consolidation onto `@wraps/template-render`, block
 * helpers evaluate correctly — and a compile or runtime failure THROWS
 * (after a `console.info` paper trail via the service's `structuredLog`)
 * so a malformed custom template never ships raw `{{#if}}` to a real
 * inbox; the caller falls back to the default confirmation email. These
 * tests pin that contract.
 *
 * Lives in apps/web because packages/email has no vitest setup; the
 * `@wraps/email/lib/*` export pattern lets us import the deep path
 * directly for unit tests.
 */

import { substituteVariables } from "@wraps/email/lib/subscription-service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("subscription substituteVariables — render failure observability", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // structuredLog inside subscription-service uses console.info under the hood.
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
      // intentionally silent in tests
    });
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it("renders a well-formed template without logging", () => {
    const result = substituteVariables(
      "Hi {{contact.firstName}}, confirm your {{topic.name}} subscription.",
      {
        "contact.firstName": "Jane",
        "topic.name": "Product Updates",
      }
    );

    expect(result).toBe("Hi Jane, confirm your Product Updates subscription.");
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("evaluates {{#if}} block helpers from the consolidated renderer", () => {
    // Regression: the old regex implementation shipped raw {{#if}} to inboxes.
    // The whole point of the consolidation was to fix this — pin the contract.
    const result = substituteVariables(
      "{{#if firstName}}Hi {{firstName}}{{else}}Hi there{{/if}}, welcome.",
      { firstName: "Jane" }
    );

    expect(result).toBe("Hi Jane, welcome.");
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("logs and throws when a malformed template fails to compile", () => {
    // Unclosed {{#if}} — Handlebars compile throws; the mailer must NOT
    // ship raw Handlebars to a subscriber, so substituteVariables rethrows
    // and the caller falls back to the default confirmation email.
    const malformed = "Hi {{#if firstName}}{{firstName}}";

    expect(() => substituteVariables(malformed, { firstName: "Jane" })).toThrow(
      /Template rendering failed/
    );
    // The log is the paper trail for detecting malformed confirmation
    // templates in production.
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logLine = String(infoSpy.mock.calls[0][0]);
    expect(logLine).toMatch(/render failed/);
  });

  it("does not log when a well-formed template references a missing variable", () => {
    // Missing variables resolve to empty string — that's normal Handlebars
    // behavior, not a render failure. The log is reserved for actual bails
    // so on-call doesn't drown in false positives.
    const result = substituteVariables("Hi {{firstName}}!", {});

    expect(result).toBe("Hi !");
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
