"use client";

import type { JSONContent } from "@tiptap/core";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useCreateTemplate,
  useTemplate,
  useUpdateTemplate,
} from "@/hooks/use-template-queries";
import { cn } from "@/lib/utils";
import { useTemplateStore } from "@/stores/template-store";
import {
  EditorCore,
  type EditorMetadata,
  EditorProvider,
  type VariableContext,
} from "../core";
import { useEditorInstanceContext } from "../core/editor-core";
import { LeftPanel } from "../left-panel";
import { BaseToolbar, InlineToolbarActions } from "../toolbars";

export type InlineEditorProps = {
  /**
   * Organization slug
   */
  orgSlug: string;

  /**
   * Template ID to edit (optional - if not provided, creates new)
   */
  templateId?: string;

  /**
   * Template name for new templates
   */
  templateName?: string;

  /**
   * Initial content for new templates
   */
  initialContent?: JSONContent;

  /**
   * Initial subject for new templates
   */
  initialSubject?: string;

  /**
   * Initial preview text for new templates
   */
  initialPreviewText?: string;

  /**
   * Variable context for suggestions
   */
  variableContext?: VariableContext;

  /**
   * Callback when template is saved (returns template ID)
   */
  onSave?: (templateId: string) => void;

  /**
   * Callback when editor is cancelled
   */
  onCancel?: () => void;

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Height of the editor
   */
  height?: string;
};

/**
 * Inline editor wrapper for use in dialogs/sheets.
 * Handles both creating new templates and editing existing ones.
 *
 * Usage:
 * ```tsx
 * <InlineEditor
 *   orgSlug={orgSlug}
 *   templateId={templateId}  // Edit existing
 *   // OR
 *   templateName="My New Template"  // Create new
 *   variableContext="broadcast"
 *   onSave={(id) => console.log('Saved:', id)}
 *   onCancel={() => setOpen(false)}
 * />
 * ```
 */
export function InlineEditor({
  orgSlug,
  templateId,
  templateName,
  initialContent,
  initialSubject,
  initialPreviewText,
  variableContext = "broadcast",
  onSave,
  onCancel,
  className,
  height = "calc(100vh - 200px)",
}: InlineEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [previewText, setPreviewText] = useState(initialPreviewText ?? "");
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(
    null
  );
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Determine which template ID to use (existing or newly created)
  const effectiveTemplateId = createdTemplateId || templateId;

  // Load existing template if ID provided
  // Note: useTemplate will return null data if templateId is empty string
  const {
    data: template,
    isLoading,
    isError,
  } = useTemplate(orgSlug, effectiveTemplateId || "");

  // Skip loading state if no template ID
  const shouldShowLoading = !!effectiveTemplateId && isLoading;
  const shouldShowError = !!effectiveTemplateId && isError;

  // Mutations
  const createMutation = useCreateTemplate(orgSlug);
  const updateMutation = useUpdateTemplate(orgSlug, effectiveTemplateId ?? "");

  // Create template immediately on mount if no templateId (for AI support)
  useEffect(() => {
    if (
      !templateId &&
      templateName &&
      !createdTemplateId &&
      !isCreatingTemplate
    ) {
      setIsCreatingTemplate(true);
      createMutation
        .mutateAsync({
          name: templateName,
          subject: initialSubject,
          description: initialPreviewText,
        })
        .then((newTemplate) => {
          setCreatedTemplateId(newTemplate.id);
          setIsCreatingTemplate(false);
        })
        .catch(() => {
          setIsCreatingTemplate(false);
          toast.error("Failed to create template");
        });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createMutation.mutateAsync,
    createdTemplateId,
    initialPreviewText,
    initialSubject,
    isCreatingTemplate,
    templateId,
    templateName,
    createMutation,
  ]);

  // Sync subject/preview from loaded template
  useEffect(() => {
    if (template) {
      setSubject(template.subject ?? initialSubject ?? "");
      setPreviewText(template.description ?? initialPreviewText ?? "");
    }
  }, [template, initialSubject, initialPreviewText]);

  // Handle subject change
  const handleSubjectChange = useCallback(
    (newSubject: string, newPreviewText: string) => {
      setSubject(newSubject);
      setPreviewText(newPreviewText);
    },
    []
  );

  // Handle save
  const handleSave = useCallback(
    async (content: JSONContent, metadata: EditorMetadata) => {
      setIsSaving(true);

      try {
        let savedTemplateId = effectiveTemplateId;

        // Create template if it doesn't exist yet
        if (!savedTemplateId) {
          const newTemplate = await createMutation.mutateAsync({
            name: templateName || `Untitled ${new Date().toLocaleDateString()}`,
            description: previewText || metadata.previewText,
          });
          savedTemplateId = newTemplate.id;
          setCreatedTemplateId(savedTemplateId);
        }

        // Update template with content and metadata
        // Note: The API auto-compiles HTML on save, so broadcasts work immediately
        await updateMutation.mutateAsync({
          content,
          subject: subject || metadata.subject,
          description: previewText || metadata.previewText,
        });

        toast.success("Template saved");
        onSave?.(savedTemplateId);
      } catch (error) {
        toast.error("Failed to save template", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      effectiveTemplateId,
      createMutation,
      updateMutation,
      templateName,
      subject,
      previewText,
      onSave,
    ]
  );

  // Loading state
  if (shouldShowLoading) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ height }}
      >
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading template...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (shouldShowError) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ height }}
      >
        <div className="text-center text-destructive">
          <p className="mb-2 font-semibold">Failed to load template</p>
          <p className="text-sm">Please try again</p>
        </div>
      </div>
    );
  }

  // Determine initial content
  const editorInitialContent =
    (template?.content as JSONContent) || initialContent;

  return (
    <EditorProvider
      autoSave={false}
      initialContent={editorInitialContent}
      mode="inline"
      onCancel={onCancel}
      onSave={handleSave}
      orgSlug={orgSlug}
      previewText={template?.description ?? previewText}
      subject={template?.subject ?? subject}
      templateId={effectiveTemplateId}
      templateName={templateName}
      variableContext={variableContext}
    >
      <div className={cn("flex flex-col", className)} style={{ height }}>
        <InlineEditorContent
          isSaving={isSaving}
          onCancel={onCancel}
          onSubjectChange={handleSubjectChange}
          orgSlug={orgSlug}
          previewText={template?.description ?? previewText}
          subject={template?.subject ?? subject}
          templateId={effectiveTemplateId}
        />
      </div>
    </EditorProvider>
  );
}

type InlineEditorContentProps = {
  isSaving: boolean;
  subject: string;
  previewText: string;
  onSubjectChange: (subject: string, previewText: string) => void;
  onCancel?: () => void;
  orgSlug: string;
  templateId?: string;
};

/**
 * Inner component that has access to editor context.
 * Renders EditorCore with leftPanel prop for the AI/Blocks panel.
 */
function InlineEditorContent({
  isSaving,
  subject,
  previewText,
  onSubjectChange,
  onCancel,
  orgSlug,
  templateId,
}: InlineEditorContentProps) {
  return (
    <EditorCore
      leftPanel={
        templateId ? (
          <InlineEditorLeftPanel orgSlug={orgSlug} templateId={templateId} />
        ) : undefined
      }
      previewText={previewText}
    >
      <InlineEditorToolbar
        isSaving={isSaving}
        onCancel={onCancel}
        onSubjectChange={onSubjectChange}
        previewText={previewText}
        subject={subject}
      />
    </EditorCore>
  );
}

/**
 * Left panel wrapper that has access to editor instance context
 */
function InlineEditorLeftPanel({
  orgSlug,
  templateId,
}: {
  orgSlug: string;
  templateId?: string;
}) {
  const { showLeftPanel, view } = useTemplateStore((state) => state.localState);
  const { editor } = useEditorInstanceContext();

  if (!showLeftPanel || view !== "edit" || !templateId) {
    return null;
  }

  return (
    <LeftPanel editor={editor} orgSlug={orgSlug} templateId={templateId} />
  );
}

type InlineEditorToolbarProps = {
  isSaving: boolean;
  subject: string;
  previewText: string;
  onSubjectChange: (subject: string, previewText: string) => void;
  onCancel?: () => void;
};

/**
 * Toolbar wrapper that connects to editor instance
 */
function InlineEditorToolbar({
  isSaving,
  subject,
  previewText,
  onSubjectChange,
  onCancel,
}: InlineEditorToolbarProps) {
  const { editor, saveNow, getContent } = useEditorInstanceContext();

  const handleSave = useCallback(async () => {
    const content = getContent();
    if (content) {
      await saveNow();
    }
  }, [getContent, saveNow]);

  return (
    <BaseToolbar
      actions={
        <InlineToolbarActions
          isSaving={isSaving}
          onCancel={onCancel}
          onSave={handleSave}
        />
      }
      editor={editor}
      onSubjectChange={onSubjectChange}
      previewText={previewText}
      subject={subject}
    />
  );
}
