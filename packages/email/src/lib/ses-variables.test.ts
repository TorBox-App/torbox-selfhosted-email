/**
 * SES Variable Transformation Tests
 *
 * transformVariablesForSes is the function that GENERATES Handlebars
 * conditional blocks from `{{var|fallback}}` authoring syntax — every
 * published SES template's subject, html, and text part flows through it.
 * A bug here ships un-renderable templates to customer SES accounts, where
 * a render failure means silent non-delivery at send time.
 */

import { describe, expect, it } from "vitest";
import {
  flattenVariablesForSes,
  toSesVariableName,
  transformVariablesForSes,
} from "./ses-variables";

describe("toSesVariableName", () => {
  it("returns names without dots unchanged", () => {
    expect(toSesVariableName("firstName")).toBe("firstName");
    expect(toSesVariableName("unsubscribeUrl")).toBe("unsubscribeUrl");
  });

  it("flattens dot notation to camelCase", () => {
    expect(toSesVariableName("contact.email")).toBe("contactEmail");
    expect(toSesVariableName("contact.firstName")).toBe("contactFirstName");
    expect(toSesVariableName("organization.name")).toBe("organizationName");
  });

  it("flattens multi-level dot paths", () => {
    expect(toSesVariableName("contact.properties.plan")).toBe(
      "contactPropertiesPlan"
    );
  });
});

describe("transformVariablesForSes", () => {
  it("flattens dotted variables to SES-compatible names", () => {
    expect(transformVariablesForSes("Hi {{contact.firstName}}")).toBe(
      "Hi {{contactFirstName}}"
    );
  });

  it("leaves flat variables unchanged", () => {
    expect(transformVariablesForSes("Hi {{firstName}}")).toBe(
      "Hi {{firstName}}"
    );
  });

  it("converts {{var|fallback}} into a Handlebars conditional block", () => {
    expect(transformVariablesForSes("Hi {{firstName|there}}")).toBe(
      "Hi {{#if firstName}}{{firstName}}{{else}}there{{/if}}"
    );
  });

  it("converts dotted fallback syntax with flattened names", () => {
    expect(transformVariablesForSes("Hi {{contact.firstName|there}}")).toBe(
      "Hi {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}"
    );
  });

  it("handles an empty fallback after the pipe", () => {
    expect(transformVariablesForSes("Hi {{firstName|}}")).toBe(
      "Hi {{#if firstName}}{{firstName}}{{else}}{{/if}}"
    );
  });

  it("tolerates whitespace inside the mustache", () => {
    expect(transformVariablesForSes("Hi {{ firstName | there }}")).toBe(
      "Hi {{#if firstName}}{{firstName}}{{else}}there{{/if}}"
    );
  });

  it("passes authored {{#if}}/{{else}}/{{/if}} blocks through untouched", () => {
    // Templates authored with explicit conditionals (e.g. a subject line of
    // "...{{#if firstName}}, {{firstName}}{{/if}}.") must survive publish
    // unchanged — only the inner bare variables are eligible for rewriting,
    // and a flat name rewrites to itself.
    const subject =
      "The setup just got easier{{#if firstName}}, {{firstName}}{{/if}}.";
    expect(transformVariablesForSes(subject)).toBe(subject);
  });

  it("flattens dotted variables inside authored conditional blocks", () => {
    expect(
      transformVariablesForSes(
        "{{#if firstName}}Hey {{contact.firstName}}{{/if}}"
      )
    ).toBe("{{#if firstName}}Hey {{contactFirstName}}{{/if}}");
  });

  it("does not rewrite {{else}} into a conditional", () => {
    // {{else}} matches the bare-variable pattern; rewriting it would corrupt
    // every authored conditional. It has no pipe, so it rewrites to itself.
    expect(transformVariablesForSes("{{#if a}}x{{else}}y{{/if}}")).toBe(
      "{{#if a}}x{{else}}y{{/if}}"
    );
  });

  it("does not touch {{#each}}/{{#unless}} blocks", () => {
    const tpl = "{{#each items}}{{this}}{{/each}}{{#unless done}}…{{/unless}}";
    expect(transformVariablesForSes(tpl)).toBe(tpl);
  });

  it("transforms every occurrence across a full template", () => {
    const html =
      "<h1>Hi {{contact.firstName|there}}</h1><p>{{contact.company}} — {{unsubscribeUrl}}</p>";
    expect(transformVariablesForSes(html)).toBe(
      "<h1>Hi {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}</h1><p>{{contactCompany}} — {{unsubscribeUrl}}</p>"
    );
  });
});

describe("flattenVariablesForSes", () => {
  it("flattens nested objects to camelCase keys with string values", () => {
    expect(
      flattenVariablesForSes({
        contact: { email: "a@b.com", firstName: "John" },
        unsubscribeUrl: "https://u.example.com",
      })
    ).toEqual({
      contactEmail: "a@b.com",
      contactFirstName: "John",
      unsubscribeUrl: "https://u.example.com",
    });
  });

  it("stringifies non-string values and maps null/undefined to empty string", () => {
    expect(
      flattenVariablesForSes({ count: 3, active: true, missing: null })
    ).toEqual({ count: "3", active: "true", missing: "" });
  });

  it("produces keys that match what transformVariablesForSes references", () => {
    // The two halves of the SES contract: the template references
    // {{contactFirstName}}, the data provides contactFirstName.
    const transformed = transformVariablesForSes("{{contact.firstName}}");
    const data = flattenVariablesForSes({ contact: { firstName: "Jo" } });
    const refName = transformed.replace(/[{}]/g, "");
    expect(data[refName]).toBe("Jo");
  });
});
