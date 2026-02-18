import { transform } from "sucrase";

type CompileResult = {
  compiledHtml: string;
  compiledText: string;
  variables: Array<{ name: string; fallback?: string }>;
  subject: string;
  emailType: string;
  previewText?: string;
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

  if (typeof Component !== "function") {
    throw new Error(
      "Template must have a default export (React component function)"
    );
  }

  // Step 5: Render with proxy props that produce {{handlebars}} placeholders
  const props = new Proxy({} as Record<string, string>, {
    get: (_target, prop) => {
      if (typeof prop === "symbol") {
        return;
      }
      return `{{${prop}}}`;
    },
  });

  const { render } = await import("@react-email/render");
  const element = Component(props);
  const compiledHtml = await render(element as React.ReactElement);
  const compiledText = await render(element as React.ReactElement, {
    plainText: true,
  });

  // Step 6: Extract {{variable}} patterns from rendered HTML
  const variables = extractVariables(compiledHtml);

  return {
    compiledHtml,
    compiledText,
    variables,
    subject: exportedSubject,
    emailType: exportedEmailType,
    previewText: exportedPreviewText,
  };
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
