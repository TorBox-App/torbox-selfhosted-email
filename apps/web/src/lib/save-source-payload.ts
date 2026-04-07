/**
 * Build the request body for POST /api/[orgSlug]/emails/templates/[id]/save-source.
 *
 * Centralized so handleSave (manual save) and handleAIApply (AI apply)
 * can't drift — the AI path used to forget `variables` and `testData`,
 * silently wiping them on every apply.
 */

export type CompiledTemplateForSave = {
  compiledHtml: string;
  compiledText: string;
  variables: Array<{ name: string; fallback?: string }>;
  testData: Record<string, unknown>;
};

export type SaveSourcePayload = {
  source: string;
  compiledHtml: string;
  compiledText: string;
  variables: Array<{ name: string; fallback?: string }>;
  testData: Record<string, unknown>;
};

export function buildSaveSourcePayload(
  source: string,
  compiled: CompiledTemplateForSave
): SaveSourcePayload {
  return {
    source,
    compiledHtml: compiled.compiledHtml,
    compiledText: compiled.compiledText,
    variables: compiled.variables,
    testData: compiled.testData,
  };
}
