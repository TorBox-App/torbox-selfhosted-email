/**
 * Tests for the (private) `substituteVariables` helper inside
 * `@wraps/email`'s subscription confirmation mailer.
 *
 * This helper renders Handlebars-flavored confirmation templates against a
 * recipient's variable dict before SES sends the email. The previous
 * implementation was a pure regex substituter that left `{{#if}}` blocks
 * untouched. After the consolidation onto `@wraps/template-render`, block
 * helpers evaluate correctly — but the canonical renderer also swallows
 * compile errors and returns the raw template, which means a malformed
 * confirmation template would silently ship raw `{{#if}}` to a real inbox.
 *
 * The function detects that bail and emits a `console.info` line via the
 * service's `structuredLog` so we have a paper trail. These tests pin
 * that contract.
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

  it("logs when a malformed template causes the renderer to bail", () => {
    // Unclosed {{#if}} — Handlebars compile throws, renderer returns raw.
    const malformed = "Hi {{#if firstName}}{{firstName}}";

    const result = substituteVariables(malformed, { firstName: "Jane" });

    // Renderer returns the raw template — that's the contract.
    expect(result).toBe(malformed);
    // The mailer MUST log so we can detect malformed confirmation templates
    // before they ship raw Handlebars to a real subscriber.
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logLine = String(infoSpy.mock.calls[0][0]);
    expect(logLine).toMatch(/render failed/);
    expect(logLine).toMatch(/raw template/);
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
