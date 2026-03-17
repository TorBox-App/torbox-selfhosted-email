import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import type { HTMLAttributes } from "react";
import {
  type BundledLanguage,
  type CodeOptionsMultipleThemes,
  createHighlighter,
  type Highlighter,
} from "shiki";

// Only load the languages and themes actually used in the codebase
// This significantly reduces bundle size compared to loading all languages
const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "bash",
  "shell",
  "json",
  "text",
] as const;
const SUPPORTED_THEMES = ["vitesse-light", "vitesse-dark"] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Singleton highlighter instance - created once and reused
let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [...SUPPORTED_THEMES],
      langs: [...SUPPORTED_LANGUAGES],
    });
  }
  return highlighterPromise;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export type CodeBlockContentProps = HTMLAttributes<HTMLDivElement> & {
  themes?: CodeOptionsMultipleThemes["themes"];
  language?: BundledLanguage;
  children: string;
  syntaxHighlighting?: boolean;
};

export const CodeBlockContent = async ({
  children,
  themes,
  language,
  syntaxHighlighting = true,
  ...props
}: CodeBlockContentProps) => {
  let html: string;

  if (syntaxHighlighting) {
    const highlighter = await getHighlighter();

    // Normalize language to supported one, fallback to text
    let lang: SupportedLanguage = "text";
    if (language) {
      const normalizedLang = language.toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(normalizedLang as SupportedLanguage)) {
        lang = normalizedLang as SupportedLanguage;
      } else if (normalizedLang === "ts") {
        lang = "typescript";
      } else if (normalizedLang === "js") {
        lang = "javascript";
      } else if (normalizedLang === "sh" || normalizedLang === "zsh") {
        lang = "bash";
      }
    }

    html = highlighter.codeToHtml(children as string, {
      lang,
      themes: themes ?? {
        light: "vitesse-light",
        dark: "vitesse-dark",
      },
      transformers: [
        transformerNotationDiff({
          matchAlgorithm: "v3",
        }),
        transformerNotationHighlight({
          matchAlgorithm: "v3",
        }),
        transformerNotationWordHighlight({
          matchAlgorithm: "v3",
        }),
        transformerNotationFocus({
          matchAlgorithm: "v3",
        }),
        transformerNotationErrorLevel({
          matchAlgorithm: "v3",
        }),
      ],
    });
  } else {
    html = escapeHtml(children);
  }

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: "Kinda how Shiki works"
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
};
