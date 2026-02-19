"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { SenderDefaults } from "@/actions/organizations";
import { getSenderDefaultsAction } from "@/actions/organizations";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
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
import {
  useEditorView,
  useLastSavedAt,
  useSaveStatus,
  useSelectedBrandKitId,
  useShowLeftPanel,
  useShowPropertiesPanel,
  useShowTestDataPanel,
  useShowVersionHistory,
  useTemplateStore,
} from "@/stores/template-store";
import { CodeView } from "./code-view";
import { EditorDndProvider } from "./dnd-context";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { EditorEmptyState, isEditorEmpty } from "./editor-empty-state";
import { EditorErrorBoundary } from "./editor-error-boundary";
import { FloatingHint, useEditorHints } from "./editor-hints";
import { useKeyboardShortcutsModal } from "./keyboard-shortcuts-modal";
import { LeftPanel } from "./left-panel";
import { PreviewPanel } from "./preview-panel";
import { PropertiesPanel } from "./properties-panel";
import { TemplateEditorToolbar } from "./template-editor-toolbar";
import { TestDataPanel } from "./test-data-panel";
import { UsagePanel } from "./usage-panel";
import { VersionHistoryPanel } from "./version-history-panel";

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

// Dynamic imports for modals - only loaded when opened
const SendTestModal = dynamic(
  () => import("./send-test-modal").then((m) => m.SendTestModal),
  { ssr: false }
);
const SaveBlockModal = dynamic(
  () => import("./save-block-modal").then((m) => m.SaveBlockModal),
  { ssr: false }
);
const ImportModal = dynamic(
  () => import("./import-modal").then((m) => m.ImportModal),
  { ssr: false }
);
const KeyboardShortcutsModal = dynamic(
  () =>
    import("./keyboard-shortcuts-modal").then((m) => m.KeyboardShortcutsModal),
  { ssr: false }
);
const SuccessCelebration = dynamic(
  () => import("./success-celebration").then((m) => m.SuccessCelebration),
  { ssr: false }
);

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

  // Code templates (pushed via CLI) get a dedicated editor experience
  if (template.sourceFormat === "react-email") {
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

  // TipTap templates get the full visual editor
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

  // Sender defaults for test email modal
  const [senderDefaults, setSenderDefaults] = useState<SenderDefaults | null>(
    null
  );
  useEffect(() => {
    getSenderDefaultsAction(orgSlug).then((result) => {
      if (result.success) {
        setSenderDefaults(result.defaults);
      }
    });
  }, [orgSlug]);

  // Keyboard shortcuts modal
  const { isOpen: showKeyboardShortcuts, setIsOpen: setShowKeyboardShortcuts } =
    useKeyboardShortcutsModal();

  // Editor hints for first-time users
  const { shouldShowHint, dismissHint } = useEditorHints();

  // Track if editor is empty for showing empty state
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Success celebration for first publish
  const [showCelebration, setShowCelebration] = useState(false);

  // Use individual selectors to prevent re-renders when unrelated state changes
  const view = useEditorView();
  const showLeftPanel = useShowLeftPanel();
  const showPropertiesPanel = useShowPropertiesPanel();
  const showTestDataPanel = useShowTestDataPanel();
  const showVersionHistory = useShowVersionHistory();
  const selectedBrandKitId = useSelectedBrandKitId();
  const saveStatus = useSaveStatus();
  const lastSavedAt = useLastSavedAt();
  const {
    setDocument,
    updateTemplate: updateTemplateStore,
    markSaving,
    markSaved,
    markUnsaved,
  } = useTemplateStore((state) => state.actions);

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

  // Handle save with status tracking
  const handleSave = useCallback(
    async (content: JSONContent) => {
      markSaving();
      try {
        await updateMutation.mutateAsync({ content });
        markSaved();
      } catch {
        // Keep as unsaved on error - the mutation error will be handled elsewhere
        markUnsaved();
        throw new Error("Failed to save");
      }
    },
    [updateMutation, markSaving, markSaved, markUnsaved]
  );

  // Initialize editor - template.content is guaranteed to be available here
  const { editor, saveNow } = useTemplateEditor({
    templateId,
    initialContent: template.content as JSONContent,
    onSave: handleSave,
    onUpdate: (content) => {
      setDocument(content);
      // Mark as unsaved when content changes
      markUnsaved();
    },
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

  // Track if editor is empty and show empty state
  useEffect(() => {
    if (!editor) {
      return;
    }

    const checkEmpty = () => {
      setShowEmptyState(isEditorEmpty(editor));
    };

    // Check initially
    checkEmpty();

    // Listen for content changes
    editor.on("update", checkEmpty);
    return () => {
      editor.off("update", checkEmpty);
    };
  }, [editor]);

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
    const isFirstPublish = template.status === "DRAFT";

    try {
      // Save any pending changes first (including subject)
      await saveNow();
      await updateMutation.mutateAsync({ subject });
      lastSavedSubjectRef.current = subject;

      // Then publish to SES
      const result = await publishMutation.mutateAsync({});

      // Show celebration for first publish
      if (isFirstPublish) {
        setShowCelebration(true);
      } else {
        toast.success("Template updated on AWS SES", {
          description: result.message,
        });
      }
    } catch (error) {
      toast.error("Failed to publish template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [saveNow, updateMutation, subject, publishMutation, template.status]);

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
    markSaving();
    try {
      await saveNow();
      markSaved();
      toast.success("Template saved");
    } catch (error) {
      markUnsaved();
      toast.error("Failed to save template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [saveNow, markSaving, markSaved, markUnsaved]);

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
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
    <>
      <EditorErrorBoundary onReset={handleEditorReset}>
        <EditorDndProvider brandKit={brandKit} editor={editor}>
          {/* Skip navigation links for keyboard users */}
          <a
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            href="#editor-canvas"
          >
            Skip to editor
          </a>
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
              lastSavedAt={lastSavedAt ?? undefined}
              onDelete={() => setDeleteDialogOpen(true)}
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
              saveStatus={saveStatus}
              status={template.status}
              subject={subject}
              templateDescription={template.description ?? undefined}
              templateName={template.name}
            />

            {/* Main Content Area */}
            <div
              aria-label="Template editor workspace"
              className="flex min-h-0 flex-1 overflow-hidden"
              role="main"
            >
              {/* Left Panel - AI + Blocks tabs - with slide animation */}
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out",
                  showLeftPanel && view === "edit"
                    ? "w-80 opacity-100"
                    : "w-0 overflow-hidden opacity-0"
                )}
              >
                {view === "edit" && (
                  <LeftPanel
                    editor={editor}
                    orgSlug={orgSlug}
                    templateId={templateId}
                  />
                )}
              </div>

              {/* Center - Editor/Preview/Code/Usage */}
              <div
                aria-label="Email content editor"
                className={cn("flex-1 overflow-auto")}
                role="region"
              >
                {/* Editor - always mounted, hidden with CSS to prevent flushSync issues */}
                <div className={cn(view !== "edit" && "hidden")}>
                  <div className="mx-auto max-w-3xl p-6">
                    <div
                      className="relative min-h-[600px] rounded-lg border bg-white text-gray-900 shadow-sm"
                      id="editor-canvas"
                      tabIndex={-1}
                    >
                      {/* Empty state overlay */}
                      {showEmptyState && (
                        <EditorEmptyState
                          editor={editor}
                          onOpenAI={() => {
                            const { toggleLeftPanelWithTab } =
                              useTemplateStore.getState().actions;
                            toggleLeftPanelWithTab("ai");
                            setShowEmptyState(false);
                          }}
                        />
                      )}
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

              {/* Right Panel - Properties - with slide animation */}
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out",
                  view === "edit" && showPropertiesPanel
                    ? "w-72 opacity-100"
                    : "w-0 overflow-hidden opacity-0"
                )}
              >
                {view === "edit" && <PropertiesPanel editor={editor} />}
              </div>

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
              defaultFrom={senderDefaults?.defaultFrom}
              defaultFromName={senderDefaults?.defaultFromName}
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

            {/* Keyboard Shortcuts Modal */}
            <KeyboardShortcutsModal
              onOpenChange={setShowKeyboardShortcuts}
              open={showKeyboardShortcuts}
            />

            {/* First-time user hints */}
            {view === "edit" && showLeftPanel && (
              <FloatingHint
                id="drag-blocks"
                onDismiss={dismissHint}
                position={{ top: 200, left: 290 }}
                show={shouldShowHint("drag-blocks") && !showEmptyState}
              />
            )}
            <FloatingHint
              id="keyboard-shortcuts"
              onDismiss={dismissHint}
              position={{ top: 120, left: "50%" }}
              show={
                shouldShowHint("keyboard-shortcuts") &&
                !shouldShowHint("drag-blocks") &&
                !showEmptyState
              }
            />

            {/* Success celebration for first publish */}
            <SuccessCelebration
              message="Template Published!"
              onComplete={() => setShowCelebration(false)}
              show={showCelebration}
            />
          </div>
        </EditorDndProvider>
      </EditorErrorBoundary>

      <DeleteConfirmDialog
        description="Are you sure you want to delete this template? This action cannot be undone."
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
        title="Delete Template"
      />
    </>
  );
}
