"use client";

import { CodeTemplateAIPanel } from "./code-template-ai-panel";

type CodeTemplateDesignViewProps = {
  orgSlug: string;
  templateId: string;
  currentSource: string;
  onApply: (source: string, compiledHtml: string) => void;
};

export function CodeTemplateDesignView({
  orgSlug,
  templateId,
  currentSource,
  onApply,
}: CodeTemplateDesignViewProps) {
  return (
    <CodeTemplateAIPanel
      currentSource={currentSource}
      onApply={onApply}
      orgSlug={orgSlug}
      templateId={templateId}
    />
  );
}
