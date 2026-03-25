/**
 * Template Variable Extraction Tests
 *
 * Reproduces a bug where the variable extraction pipeline (Proxy props →
 * react-email render → regex scan) fails to detect props that are only used
 * in conditional logic or type checks rather than rendered directly as text
 * or attribute values.
 *
 * Bug: A template with 5 declared props (name, courseTitle, downloadUrl,
 * language, bundleUrl) only extracts 3 variables. The `language` prop is
 * used only in comparisons (e.g. `language === "es"`) and `bundleUrl` is
 * guarded by a URL validation check — neither produces a `{{propName}}`
 * placeholder in the rendered HTML.
 */

import { render } from "@react-email/render";
import React from "react";
import { describe, expect, it } from "vitest";

// ── Extraction pipeline (mirrors push.ts internals) ──

const INTERNAL_PROPS = new Set([
  "$$typeof",
  "_owner",
  "_store",
  "_self",
  "_source",
  "key",
  "ref",
  "children",
  "type",
  "props",
  "__esModule",
  "default",
  "toString",
  "valueOf",
  "toJSON",
  "then",
  "constructor",
  "prototype",
  "__proto__",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "nodeType",
  "tagName",
]);

function createProxyProps(): {
  props: Record<string, string>;
  accessedProps: Set<string>;
} {
  const accessedProps = new Set<string>();
  const props = new Proxy({} as Record<string, string>, {
    get: (_target, prop) => {
      if (typeof prop === "symbol") return;
      const name = String(prop);
      accessedProps.add(name);
      return `{{${name}}}`;
    },
  });
  return { props, accessedProps };
}

function extractVariables(
  html: string
): Array<{ name: string; fallback?: string }> {
  const vars: Array<{ name: string; fallback?: string }> = [];
  const seen = new Set<string>();
  const regex = /\{\{([a-zA-Z0-9_.]+)(?:\|([^}]*))?\}\}/g;
  let match = regex.exec(html);

  while (match !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      vars.push({ name, fallback: match[2]?.trim() });
    }
    match = regex.exec(html);
  }

  return vars;
}

function mergeVariables(
  htmlVars: Array<{ name: string; fallback?: string }>,
  accessedProps: Set<string>
): Array<{ name: string; fallback?: string }> {
  const seen = new Set(htmlVars.map((v) => v.name));
  const merged = [...htmlVars];

  for (const prop of accessedProps) {
    if (
      !(seen.has(prop) || INTERNAL_PROPS.has(prop)) &&
      /^[a-zA-Z]/.test(prop)
    ) {
      seen.add(prop);
      merged.push({ name: prop });
    }
  }

  return merged;
}

async function extractTemplateVariables(
  Component: (props: Record<string, string>) => React.ReactElement
): Promise<string[]> {
  const { props, accessedProps } = createProxyProps();
  const element = Component(props);
  const html = await render(element);
  const variables = mergeVariables(extractVariables(html), accessedProps);
  return variables.map((v) => v.name);
}

// ── Templates ──

/**
 * Simulates a course-download-confirmation template with 5 props.
 *
 * Props used directly in rendered output (text/attributes):
 *   - name:        rendered as text in greeting
 *   - courseTitle:  rendered as text in body
 *   - downloadUrl: rendered as href attribute
 *
 * Props used only in conditional logic (NOT rendered as {{placeholder}}):
 *   - language:    compared with === to pick locale strings
 *   - bundleUrl:   guarded by .startsWith("http") before rendering
 */
function CourseDownloadConfirmation(props: Record<string, string>) {
  const { name, courseTitle, downloadUrl, language, bundleUrl } = props;

  const isSpanish = language === "es";
  const greeting = isSpanish ? "Hola" : "Hello";
  const downloadText = isSpanish ? "Descargar" : "Download";
  const bundleText = isSpanish ? "Paquete completo" : "Full Bundle";

  const showBundle =
    typeof bundleUrl === "string" && bundleUrl.startsWith("http");

  return React.createElement(
    "html",
    null,
    React.createElement(
      "body",
      null,
      React.createElement("p", null, greeting, " ", name, "!"),
      React.createElement("p", null, "Your course: ", courseTitle),
      React.createElement("a", { href: downloadUrl }, downloadText),
      showBundle
        ? React.createElement("a", { href: bundleUrl }, bundleText)
        : null
    )
  );
}

// ── Tests ──

describe("template variable extraction", () => {
  it("extracts all declared props from a template with conditional logic", async () => {
    const variables = await extractTemplateVariables(
      CourseDownloadConfirmation
    );

    // All 5 props declared in the template interface should be extracted.
    // Currently only 3 are found: name, courseTitle, downloadUrl.
    // Missing: language (used only in === comparison), bundleUrl (guarded by .startsWith("http"))
    expect(variables.sort()).toEqual(
      ["bundleUrl", "courseTitle", "downloadUrl", "language", "name"].sort()
    );
  });

  it("extracts props used only in equality comparisons", async () => {
    // language is compared with === but never rendered as text
    function LocaleTemplate(props: Record<string, string>) {
      const greeting = props.language === "es" ? "Hola" : "Hello";
      return React.createElement(
        "html",
        null,
        React.createElement(
          "body",
          null,
          React.createElement("p", null, greeting, " ", props.name)
        )
      );
    }

    const variables = await extractTemplateVariables(LocaleTemplate);

    expect(variables).toContain("name");
    expect(variables).toContain("language");
  });

  it("extracts props guarded by URL validation", async () => {
    // bundleUrl is checked with .startsWith("http") before use
    function ConditionalLinkTemplate(props: Record<string, string>) {
      const showLink =
        typeof props.url === "string" && props.url.startsWith("http");
      return React.createElement(
        "html",
        null,
        React.createElement(
          "body",
          null,
          React.createElement("p", null, props.label),
          showLink
            ? React.createElement("a", { href: props.url }, "Click")
            : null
        )
      );
    }

    const variables = await extractTemplateVariables(ConditionalLinkTemplate);

    expect(variables).toContain("label");
    expect(variables).toContain("url");
  });
});
