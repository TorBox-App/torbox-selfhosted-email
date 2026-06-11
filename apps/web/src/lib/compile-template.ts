// Subpath import on purpose: this file runs in the browser, and the package
// root re-exports the Handlebars-backed renderer. mustache-case is
// dependency-free regex code — the only part safe to ship client-side.
import { normalizePlainTextForSes } from "@wraps/template-render/mustache-case";
import { transform } from "sucrase";
import { extractHandlebarsVariables } from "./handlebars";

export type CompileResult = {
  compiledHtml: string;
  compiledText: string;
  variables: Array<{ name: string; fallback?: string }>;
  subject: string;
  emailType: string;
  previewText?: string;
  testData: Record<string, unknown>;
};

/**
 * Compile a React Email TSX template entirely in the browser.
 *
 * This replaces the old server-side /compile API route which used
 * `new Function()` on the server — a critical RCE vulnerability.
 * Running in the browser is safe because the user can only affect
 * their own session, which they already control.
 */
export async function compileTemplate(source: string): Promise<CompileResult> {
  // Step 1: Transform TSX → CJS using sucrase (browser-safe, ~1MB)
  const { code } = transform(source, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "automatic",
    production: true,
  });

  // Step 2: Set up module shims for require() calls in CJS output
  const React = await import("react");
  const jsxRuntime = await import("react/jsx-runtime");
  const reactEmailComponents = await import("@react-email/components");

  const moduleShim: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@react-email/components": reactEmailComponents,
  };

  const requireShim = (id: string) => {
    if (moduleShim[id]) {
      return moduleShim[id];
    }
    throw new Error(
      `Cannot require "${id}" — only react and @react-email/components are available`
    );
  };

  // Step 3: Execute the compiled CJS code (safe — runs in user's browser)
  const mod: Record<string, unknown> = {};
  const moduleExports: Record<string, unknown> = {};
  mod.exports = moduleExports;

  const fn = new Function("require", "module", "exports", code);
  fn(requireShim, mod, moduleExports);

  // Step 4: Extract exports
  const resolvedExports = (
    mod.exports !== moduleExports ? mod.exports : moduleExports
  ) as Record<string, unknown>;
  const Component = resolvedExports.default as (
    props: Record<string, unknown>
  ) => unknown;
  const exportedSubject = (resolvedExports.subject as string) ?? "";
  const exportedEmailType =
    (resolvedExports.emailType as string) ?? "marketing";
  const exportedPreviewText = resolvedExports.previewText as string | undefined;
  const exportedTestData = coerceTestDataExport(resolvedExports.testData);

  if (typeof Component !== "function") {
    throw new Error(
      "Template must have a default export (React component function)"
    );
  }

  // Step 5: Render with proxy props that produce {{handlebars}} placeholders
  // Track all property accesses — props used only in conditionals (e.g. url.startsWith("http"))
  // won't appear in the rendered HTML, but the Proxy still sees them during destructuring
  const accessedProps = new Set<string>();
  const props = new Proxy({} as Record<string, string>, {
    get: (_target, prop) => {
      if (typeof prop === "symbol") {
        return;
      }
      const name = String(prop);
      accessedProps.add(name);
      return `{{${name}}}`;
    },
  });

  const { render } = await import("@react-email/render");
  const element = Component(props);
  const compiledHtml = await render(element as React.ReactElement);
  // normalizePlainTextForSes: the plain-text render uppercases heading
  // content, corrupting {{#if firstName}} into {{#IF FIRSTNAME}} — SES
  // rejects that text part at send time.
  const compiledText = normalizePlainTextForSes(
    await render(element as React.ReactElement, {
      plainText: true,
    }),
    compiledHtml
  );

  // Step 6: Extract variables from both rendered HTML and Proxy-tracked accesses
  const variables = mergeVariables(
    extractVariables(compiledHtml),
    accessedProps
  );

  return {
    compiledHtml,
    compiledText,
    variables,
    subject: exportedSubject,
    emailType: exportedEmailType,
    previewText: exportedPreviewText,
    testData: exportedTestData,
  };
}

/**
 * Coerce a template's `testData` export into a plain object suitable
 * for Handlebars substitution. Templates may export anything (string,
 * array, null, etc.) — we only accept plain objects and fall back to
 * an empty object otherwise.
 */
export function coerceTestDataExport(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function extractVariables(
  html: string
): Array<{ name: string; fallback?: string }> {
  return extractHandlebarsVariables(html);
}

// Props accessed by React internals or JS runtime — not user template variables
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

/**
 * Merge regex-extracted variables (from rendered HTML) with Proxy-tracked
 * property accesses. HTML extraction provides fallback values; Proxy tracking
 * catches props used only in conditionals that never appear in the output.
 */
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
