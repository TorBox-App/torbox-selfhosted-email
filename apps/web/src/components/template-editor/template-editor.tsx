"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTemplate } from "@/hooks/use-template-queries";
import { cn } from "@/lib/utils";

// Dynamic import for code template editor (React Email TSX templates)
const CodeTemplateEditor = dynamic(
  () => import("./code-template-editor").then((m) => m.CodeTemplateEditor),
  { ssr: false }
);

// Dynamic import for SMS template editor
const SmsTemplateEditor = dynamic(
  () => import("./sms-template-editor").then((m) => m.SmsTemplateEditor),
  { ssr: false }
);

const PANEL_HEIGHT =
  "h-[calc(100dvh-var(--header-height)-1rem)] md:h-[calc(100dvh-var(--header-height)-1.5rem)]";

type TemplateEditorProps = {
  orgSlug: string;
  templateId: string;
  className?: string;
};

/**
 * Wrapper component that handles data loading.
 * Only renders the actual editor once template data is available.
 */
export function TemplateEditor({
  orgSlug,
  templateId,
  className,
}: TemplateEditorProps) {
  // Load template with TanStack Query
  const {
    data: template,
    isLoading,
    isError,
    error,
  } = useTemplate(orgSlug, templateId);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          PANEL_HEIGHT,
          className
        )}
      >
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading template...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          PANEL_HEIGHT,
          className
        )}
      >
        <div className="text-center text-destructive">
          <p className="mb-2 font-semibold">Failed to load template</p>
          <p className="text-sm">{error?.message}</p>
        </div>
      </div>
    );
  }

  // No template data
  if (!template) {
    return null;
  }

  // SMS templates get a lightweight textarea editor
  if (template.channel === "sms") {
    return (
      <SmsTemplateEditor
        className={className}
        key={template.id}
        orgSlug={orgSlug}
        template={template}
      />
    );
  }

  // React Email templates — AI + Code editor
  return (
    <CodeTemplateEditor
      className={className}
      key={template.id}
      orgSlug={orgSlug}
      template={template}
      templateId={templateId}
    />
  );
}
