/**
 * Extract TSX code from an AI response string.
 *
 * Tries three strategies:
 * 1. ```tsx code block
 * 2. ```typescript or ```ts code block
 * 3. Generic code block containing an import statement
 */
export function extractTsxCode(content: string): string | null {
  // Strategy 1: ```tsx code block
  const tsxMatch = content.match(/```tsx\s*([\s\S]*?)\s*```/);
  if (tsxMatch) {
    return tsxMatch[1].trim();
  }

  // Strategy 2: ```typescript or ```ts code block
  const tsMatch = content.match(/```(?:typescript|ts)\s*([\s\S]*?)\s*```/);
  if (tsMatch) {
    return tsMatch[1].trim();
  }

  // Strategy 3: generic code block containing import
  const genericMatch = content.match(/```\s*([\s\S]*?)\s*```/);
  if (genericMatch?.[1].includes("import")) {
    return genericMatch[1].trim();
  }

  return null;
}
