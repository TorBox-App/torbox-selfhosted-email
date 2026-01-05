"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useBrandKits } from "@/hooks/use-brand-kit-queries";
import { useTemplateEditor } from "@/hooks/use-template-editor";
import {
  useDeleteTemplate,
  useDuplicateTemplate,
  usePublishTemplate,
  useTemplate,
  useUnpublishTemplate,
  useUpdateTemplate,
} from "@/hooks/use-template-queries";
import { cn } from "@/lib/utils";
import { useTemplateStore } from "@/stores/template-store";
import { CodeView } from "./code-view";
import { EditorDndProvider } from "./dnd-context";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { EditorErrorBoundary } from "./editor-error-boundary";
import { ImportModal } from "./import-modal";
import { LeftPanel } from "./left-panel";
import { PreviewPanel } from "./preview-panel";
import { PropertiesPanel } from "./properties-panel";
import { SaveBlockModal } from "./save-block-modal";
import { SendTestModal } from "./send-test-modal";
import { TemplateEditorToolbar } from "./template-editor-toolbar";
import { TestDataPanel } from "./test-data-panel";
import { UsagePanel } from "./usage-panel";
import { VersionHistoryPanel } from "./version-history-panel";

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
          "flex h-[calc(100dvh-var(--header-height)-1rem)] items-center justify-center md:h-[calc(100dvh-var(--header-height)-1.5rem)]",
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
          "flex h-[calc(100dvh-var(--header-height)-1rem)] items-center justify-center md:h-[calc(100dvh-var(--header-height)-1.5rem)]",
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

  // Template loaded - render the editor
  // Key forces complete remount when navigating between templates
  return (
    <TemplateEditorContent
      className={className}
      key={template.id}
      orgSlug={orgSlug}
      template={template}
      templateId={templateId}
    />
  );
}

type TemplateEditorContentProps = {
  orgSlug: string;
  templateId: string;
  template: NonNullable<ReturnType<typeof useTemplate>["data"]>;
  className?: string;
};

/**
 * Inner component that creates the editor.
 * Only mounted when template data is guaranteed to be available.
 */
function TemplateEditorContent({
  orgSlug,
  templateId,
  template,
  className,
}: TemplateEditorContentProps) {
  const router = useRouter();
  const [showSendTestModal, setShowSendTestModal] = useState(false);
  const [showSaveBlockModal, setShowSaveBlockModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [subject, setSubject] = useState(template.subject ?? "");
  const [previewText, setPreviewText] = useState(template.description ?? "");
  const [emailType, setEmailType] = useState(template.emailType);

  const {
    view,
    showLeftPanel,
    showPropertiesPanel,
    showTestDataPanel,
    showVersionHistory,
    selectedBrandKitId,
  } = useTemplateStore((state) => state.localState);
  const { setDocument, updateTemplate: updateTemplateStore } = useTemplateStore(
    (state) => state.actions
  );

  // Update template mutation
  const updateMutation = useUpdateTemplate(orgSlug, templateId);

  // Publish/unpublish mutations
  const publishMutation = usePublishTemplate(orgSlug, templateId);
  const unpublishMutation = useUnpublishTemplate(orgSlug, templateId);

  // Delete and duplicate mutations
  const deleteMutation = useDeleteTemplate(orgSlug);
  const duplicateMutation = useDuplicateTemplate(orgSlug);

  // Track last saved subject to avoid redundant saves
  const lastSavedSubjectRef = useRef(template.subject ?? "");

  // Handle save
  const handleSave = useCallback(
    async (content: JSONContent) => {
      await updateMutation.mutateAsync({ content });
    },
    [updateMutation]
  );

  // Initialize editor - template.content is guaranteed to be available here
  const { editor, saveNow } = useTemplateEditor({
    templateId,
    initialContent: template.content as JSONContent,
    onSave: handleSave,
    onUpdate: setDocument,
  });

  // Fetch brand kits for DnD context
  const { data: brandKits } = useBrandKits(orgSlug);
  const brandKit = useMemo(() => {
    if (!brandKits?.length) {
      return null;
    }
    if (selectedBrandKitId) {
      return brandKits.find((kit) => kit.id === selectedBrandKitId) ?? null;
    }
    return brandKits.find((kit) => kit.isDefault) ?? brandKits[0] ?? null;
  }, [brandKits, selectedBrandKitId]);

  // Update store with template metadata
  useEffect(() => {
    updateTemplateStore({
      id: template.id,
      name: template.name,
      status: template.status,
      updatedAt: template.updatedAt.toString(),
    });
  }, [template, updateTemplateStore]);

  // Sync subject from template when it changes (e.g., after publish)
  useEffect(() => {
    if (template.subject !== null && template.subject !== subject) {
      setSubject(template.subject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only sync when template.subject changes from server
  }, [template.subject, subject]);

  // Debounced subject save - waits 1s after last keystroke
  useEffect(() => {
    // Don't save if subject hasn't changed from last saved value
    if (subject === lastSavedSubjectRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      lastSavedSubjectRef.current = subject;
      updateMutation.mutate({ subject });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [subject, updateMutation]);

  // Handle subject and preview text change from dialog
  const handleSubjectChange = useCallback(
    (
      newSubject: string,
      newPreviewText: string,
      newEmailType: "marketing" | "transactional"
    ) => {
      setSubject(newSubject);
      setPreviewText(newPreviewText);
      setEmailType(newEmailType);
      // Save description and emailType immediately
      const updates: {
        description?: string;
        emailType?: "marketing" | "transactional";
      } = {};
      if (newPreviewText !== template.description) {
        updates.description = newPreviewText;
      }
      if (newEmailType !== template.emailType) {
        updates.emailType = newEmailType;
      }
      if (Object.keys(updates).length > 0) {
        updateMutation.mutate(updates);
      }
    },
    [template.description, template.emailType, updateMutation]
  );

  // Handle publish
  const handlePublish = useCallback(async () => {
    try {
      // Save any pending changes first (including subject)
      await saveNow();
      await updateMutation.mutateAsync({ subject });
      lastSavedSubjectRef.current = subject;

      // Then publish to SES
      const result = await publishMutation.mutateAsync({});
      toast.success("Template published to AWS SES", {
        description: result.message,
      });
    } catch (error) {
      toast.error("Failed to publish template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [saveNow, updateMutation, subject, publishMutation]);

  // Handle unpublish
  const handleUnpublish = useCallback(async () => {
    try {
      const result = await unpublishMutation.mutateAsync();
      toast.success("Template unpublished", {
        description: result.message,
      });
    } catch (error) {
      toast.error("Failed to unpublish template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [unpublishMutation]);

  const handleManualSave = useCallback(async () => {
    try {
      await saveNow();
      toast.success("Template saved");
    } catch (error) {
      toast.error("Failed to save template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [saveNow]);

  const handleEditorReset = useCallback(() => {
    if (editor && template?.content && editor.isEditable) {
      setTimeout(() => {
        editor.commands.setContent(template.content as JSONContent);
        toast.info("Editor reset to last saved state");
      }, 0);
    }
  }, [editor, template?.content]);

  // Handle duplicate
  const handleDuplicate = useCallback(async () => {
    try {
      const duplicatedTemplate =
        await duplicateMutation.mutateAsync(templateId);
      toast.success("Template duplicated", {
        description: `Created "${duplicatedTemplate.name}"`,
      });
      router.push(`/${orgSlug}/emails/templates/${duplicatedTemplate.id}`);
    } catch (error) {
      toast.error("Failed to duplicate template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [duplicateMutation, templateId, router, orgSlug]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this template? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(templateId);
      toast.success("Template deleted");
      router.push(`/${orgSlug}/emails/templates`);
    } catch (error) {
      toast.error("Failed to delete template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [deleteMutation, templateId, router, orgSlug]);

  // Handle rename
  const handleRename = useCallback(
    async (name: string, description?: string) => {
      try {
        await updateMutation.mutateAsync({ name, description });
        toast.success("Template renamed");
      } catch (error) {
        toast.error("Failed to rename template", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [updateMutation]
  );

  // Editor not ready yet
  if (!editor) {
    return (
      <div
        className={cn(
          "flex h-[calc(100dvh-var(--header-height)-1rem)] items-center justify-center md:h-[calc(100dvh-var(--header-height)-1.5rem)]",
          className
        )}
      >
        <p className="text-muted-foreground">Initializing editor...</p>
      </div>
    );
  }

  return (
    <EditorErrorBoundary onReset={handleEditorReset}>
      <EditorDndProvider brandKit={brandKit} editor={editor}>
        <div
          className={cn(
            "flex h-[calc(100dvh-var(--header-height)-1rem)] flex-col bg-background md:h-[calc(100dvh-var(--header-height)-1.5rem)]",
            className
          )}
        >
          {/* Toolbar */}
          <TemplateEditorToolbar
            editor={editor}
            emailType={emailType}
            isPublishing={
              publishMutation.isPending || unpublishMutation.isPending
            }
            isSaving={updateMutation.isPending}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onImport={() => setShowImportModal(true)}
            onPublish={handlePublish}
            onRename={handleRename}
            onSave={handleManualSave}
            onSaveBlock={() => setShowSaveBlockModal(true)}
            onSendTest={() => setShowSendTestModal(true)}
            onSubjectChange={handleSubjectChange}
            onUnpublish={handleUnpublish}
            orgSlug={orgSlug}
            previewText={previewText}
            status={template.status}
            subject={subject}
            templateDescription={template.description ?? undefined}
            templateName={template.name}
          />

          {/* Main Content Area */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left Panel - AI + Blocks tabs */}
            {showLeftPanel && view === "edit" && (
              <LeftPanel
                editor={editor}
                orgSlug={orgSlug}
                templateId={templateId}
              />
            )}

            {/* Center - Editor/Preview/Code/Usage */}
            <div className={cn("flex-1 overflow-auto")}>
              {/* Editor - always mounted, hidden with CSS to prevent flushSync issues */}
              <div className={cn(view !== "edit" && "hidden")}>
                <div className="mx-auto max-w-3xl p-6">
                  <div className="min-h-[600px] rounded-lg border bg-white text-gray-900 shadow-sm">
                    <EditorContent className="p-6" editor={editor} />
                    {/* Bubble menu for text formatting */}
                    <EditorBubbleMenu editor={editor} />
                  </div>
                </div>
              </div>

              {view === "preview" && <PreviewPanel editor={editor} />}

              {view === "code" && (
                <CodeView editor={editor} previewText={previewText} />
              )}

              {view === "usage" && <UsagePanel template={template} />}
            </div>

            {/* Right Panel - Properties (always rendered in edit mode to detect selection) */}
            {view === "edit" && (
              <div className={showPropertiesPanel ? "" : "hidden"}>
                <PropertiesPanel editor={editor} />
              </div>
            )}

            {/* Right Panel - Test Data (shown when toggled) */}
            {showTestDataPanel && (view === "edit" || view === "preview") && (
              <TestDataPanel editor={editor} />
            )}

            {/* Right Panel - Version History (shown when toggled) */}
            {showVersionHistory && (
              <VersionHistoryPanel
                editor={editor}
                orgSlug={orgSlug}
                templateId={templateId}
              />
            )}
          </div>

          {/* Send Test Modal */}
          <SendTestModal
            editor={editor}
            isOpen={showSendTestModal}
            onClose={() => setShowSendTestModal(false)}
            orgSlug={orgSlug}
            templateId={templateId}
          />

          {/* Save Block Modal */}
          <SaveBlockModal
            editor={editor}
            isOpen={showSaveBlockModal}
            onClose={() => setShowSaveBlockModal(false)}
            orgSlug={orgSlug}
          />

          {/* Import Modal */}
          <ImportModal
            editor={editor}
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
          />
        </div>
      </EditorDndProvider>
    </EditorErrorBoundary>
  );
}
