"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useActiveBrandKit } from "@/hooks/use-brand-kit-queries";
import { cn } from "@/lib/utils";
import { useTemplateStore } from "@/stores/template-store";
import { CodeView } from "../code-view";
import { EditorDndProvider } from "../dnd-context";
import { EditorBubbleMenu } from "../editor-bubble-menu";
import { EditorErrorBoundary } from "../editor-error-boundary";
import { PreviewPanel } from "../preview-panel";
import { PropertiesPanel } from "../properties-panel";
import { TestDataPanel } from "../test-data-panel";
import { useEditorContext } from "./editor-context";
import { useEditorInstance } from "./use-editor-instance";

// Editor instance context - provides editor to child components
type EditorInstanceContextValue = {
  editor: Editor;
  saveNow: () => Promise<void>;
  insertBlock: (
    type:
      | "emailButton"
      | "emailSection"
      | "emailImage"
      | "emailDivider"
      | "emailSpacer"
      | "emailRow"
      | "conditional"
      | "variable",
    attrs?: Record<string, unknown>
  ) => void;
  getContent: () => JSONContent | null;
  setContent: (content: JSONContent) => void;
};

const EditorInstanceContext = createContext<EditorInstanceContextValue | null>(
  null
);

export function useEditorInstanceContext() {
  const context = useContext(EditorInstanceContext);
  if (!context) {
    throw new Error(
      "useEditorInstanceContext must be used within an EditorCore"
    );
  }
  return context;
}

export type EditorCoreProps = {
  /**
   * Children to render (typically toolbar and action buttons)
   */
  children?: ReactNode;

  /**
   * Additional class name for the container
   */
  className?: string;

  /**
   * Callback when editor content updates
   */
  onUpdate?: (content: JSONContent) => void;

  /**
   * Callback when editor needs reset
   */
  onReset?: () => void;

  /**
   * Preview text for code view
   */
  previewText?: string;

  /**
   * Left panel to render (rendered inside editor context so it has access to editor instance)
   */
  leftPanel?: ReactNode;
};

/**
 * Core editor component that provides the TipTap editor instance
 * and all panels. This component is context-agnostic and can be
 * used in any email editing scenario.
 *
 * Usage:
 * ```tsx
 * <EditorProvider orgSlug={orgSlug} mode="inline">
 *   <EditorCore>
 *     <MyCustomToolbar />
 *   </EditorCore>
 * </EditorProvider>
 * ```
 */
export function EditorCore({
  children,
  className,
  onUpdate,
  onReset,
  previewText = "",
  leftPanel,
}: EditorCoreProps) {
  const {
    orgSlug,
    initialContent,
    onSave,
    autoSave,
    autoSaveDelay,
    features,
    variableContext,
  } = useEditorContext();

  const { view, showPropertiesPanel, showTestDataPanel, selectedBrandKitId } =
    useTemplateStore((state) => state.localState);

  const { setDocument } = useTemplateStore((state) => state.actions);

  // Handle content save
  const handleSave = async (content: JSONContent) => {
    await onSave?.(content, {});
  };

  // Handle content update
  const handleUpdate = (content: JSONContent) => {
    setDocument(content);
    onUpdate?.(content);
  };

  // Create editor instance
  const { editor, saveNow, insertBlock, getContent, setContent } =
    useEditorInstance({
      initialContent,
      onSave: handleSave,
      onUpdate: handleUpdate,
      onToggleBlockLibrary:
        useTemplateStore.getState().actions.toggleBlockLibrary,
      autoSave,
      autoSaveDelay,
      variableContext,
    });

  // Fetch active brand kit for DnD context
  const brandKit = useActiveBrandKit(orgSlug, selectedBrandKitId);

  // Handle editor reset
  const handleEditorReset = () => {
    if (editor && initialContent && editor.isEditable) {
      setTimeout(() => {
        editor.commands.setContent(initialContent);
      }, 0);
    }
    onReset?.();
  };

  // Editor instance context value
  const instanceContextValue = useMemo<EditorInstanceContextValue | null>(
    () =>
      editor
        ? {
            editor,
            saveNow,
            insertBlock,
            getContent,
            setContent,
          }
        : null,
    [editor, saveNow, insertBlock, getContent, setContent]
  );

  // Editor not ready yet
  if (!(editor && instanceContextValue)) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <p className="text-muted-foreground">Initializing editor...</p>
      </div>
    );
  }

  return (
    <EditorInstanceContext.Provider value={instanceContextValue}>
      <EditorErrorBoundary onReset={handleEditorReset}>
        <EditorDndProvider brandKit={brandKit} editor={editor}>
          <div className={cn("flex h-full flex-col bg-background", className)}>
            {/* Toolbar slot - render children here */}
            {children}

            {/* Main Content Area */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Left Panel (rendered via prop to have access to editor context) */}
              {leftPanel}

              {/* Center - Editor/Preview/Code */}
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

                {features.code && view === "code" && (
                  <CodeView editor={editor} previewText={previewText} />
                )}
              </div>

              {/* Right Panel - Properties */}
              {features.properties &&
                showPropertiesPanel &&
                view === "edit" && <PropertiesPanel editor={editor} />}

              {/* Right Panel - Test Data */}
              {features.testData &&
                showTestDataPanel &&
                (view === "edit" || view === "preview") && (
                  <TestDataPanel editor={editor} />
                )}
            </div>
          </div>
        </EditorDndProvider>
      </EditorErrorBoundary>
    </EditorInstanceContext.Provider>
  );
}
