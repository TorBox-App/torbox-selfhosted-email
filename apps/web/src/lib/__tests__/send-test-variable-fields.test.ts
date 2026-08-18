/**
 * Pins the field-naming contract the send-test modal depends on.
 *
 * TanStack Form treats a dotted `name` as a deep path, so a field named
 * "contact.firstName" writes to `values.contact.firstName` — NOT to the flat
 * key `values["contact.firstName"]` that the modal reads when it builds
 * preview and send data. Dotted template variables therefore silently arrived
 * empty in both the preview and the test email.
 *
 * The modal now keys its form by `toSesVariableName(name)`, which is
 * single-level by construction and is also the name the transformed template
 * references. These tests fail if either half of that contract regresses.
 */

import { FormApi } from "@tanstack/react-form";
import {
  buildSesRenderData,
  renderTemplateStrict,
  toSesVariableName,
  transformVariablesForSes,
} from "@wraps/template-render";
import { describe, expect, it } from "vitest";

// `useForm` wraps FormApi; drive FormApi directly so this stays a plain
// unit test with no renderer involved.
type FormApiLike = {
  mount: () => void;
  setFieldValue: (name: string, value: unknown) => void;
  state: { values: Record<string, unknown> };
};

function makeForm(defaultValues: Record<string, unknown>): FormApiLike {
  const form = new (FormApi as unknown as new (opts: unknown) => FormApiLike)({
    defaultValues,
  });
  form.mount();
  return form;
}

describe("send-test form field naming", () => {
  it("loses the value when a dotted name is used as a field name", () => {
    // This is the bug, pinned: writing through the dotted name does NOT
    // populate the flat key the modal reads.
    const form = makeForm({ "contact.firstName": "" });
    form.setFieldValue("contact.firstName", "Jane");

    expect(form.state.values["contact.firstName"]).toBe("");
    expect(form.state.values.contact).toEqual({ firstName: "Jane" });
  });

  it("round-trips the value when keyed by the SES-flattened name", () => {
    const fieldName = toSesVariableName("contact.firstName");
    expect(fieldName).toBe("contactFirstName");

    const form = makeForm({ [fieldName]: "" });
    form.setFieldValue(fieldName, "Jane");

    expect(form.state.values[fieldName]).toBe("Jane");
  });

  it("renders the template with the value the flattened field collected", () => {
    const fieldName = toSesVariableName("contact.firstName");
    const form = makeForm({ [fieldName]: "" });
    form.setFieldValue(fieldName, "Jane");

    const testData = { [fieldName]: String(form.state.values[fieldName]) };
    const html = renderTemplateStrict(
      transformVariablesForSes("Hi {{contact.firstName}}!"),
      buildSesRenderData(testData)
    );

    expect(html).toBe("Hi Jane!");
  });

  it("leaves non-dotted variable names untouched", () => {
    expect(toSesVariableName("firstName")).toBe("firstName");
    expect(toSesVariableName("content")).toBe("content");
  });
});
