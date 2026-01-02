"use client";

import type { JSONContent } from "@tiptap/core";
import { createContext, useContext, useMemo, type ReactNode } from "react";

// Editor modes
export type EditorMode = "standalone" | "inline";

// Variable contexts for different email types
export type VariableContext = "broadcast" | "confirmation" | "automation";

// Feature flags for toolbar and panels
export type ToolbarFeatures = {
  // Always available
  undo: boolean;
  redo: boolean;
  formatting: boolean;
  blocks: boolean;
  variables: boolean;
  preview: boolean;

  // Context-specific
  code: boolean;
  usage: boolean;
  publish: boolean;
  versionHistory: boolean;
  sendTest: boolean;
  ai: boolean;
  testData: boolean;
  properties: boolean;
  brandKit: boolean;
  import: boolean;
  saveBlock: boolean;
  duplicate: boolean;
  delete: boolean;
};

// Metadata for editor save operations
export type EditorMetadata = {
  subject?: string;
  previewText?: string;
  name?: string;
};

// Editor context value
export type EditorContextValue = {
  // Mode and context
  mode: EditorMode;
  variableContext: VariableContext;

  // Organization
  orgSlug: string;

  // Template reference (optional for inline mode creating new)
  templateId?: string;
  templateName?: string;

  // Content
  initialContent?: JSONContent;
  subject?: string;
  previewText?: string;

  // Callbacks
  onSave?: (content: JSONContent, metadata: EditorMetadata) => Promise<void>;
  onCancel?: () => void;
  onTemplateCreated?: (templateId: string) => void;

  // Feature flags
  features: ToolbarFeatures;

  // Auto-save configuration
  autoSave: boolean;
  autoSaveDelay: number;
};

// Default features per mode
const standaloneFeatures: ToolbarFeatures = {
  undo: true,
  redo: true,
  formatting: true,
  blocks: true,
  variables: true,
  preview: true,
  code: true,
  usage: true,
  publish: true,
  versionHistory: true,
  sendTest: true,
  ai: true,
  testData: true,
  properties: true,
  brandKit: true,
  import: true,
  saveBlock: true,
  duplicate: true,
  delete: true,
};

const inlineFeatures: ToolbarFeatures = {
  undo: true,
  redo: true,
  formatting: true,
  blocks: true,
  variables: true,
  preview: true,
  code: false,
  usage: false,
  publish: false,
  versionHistory: false,
  sendTest: false,
  ai: true,
  testData: true,
  properties: true,
  brandKit: true,
  import: true,
  saveBlock: false,
  duplicate: false,
  delete: false,
};

export const defaultFeaturesByMode: Record<EditorMode, ToolbarFeatures> = {
  standalone: standaloneFeatures,
  inline: inlineFeatures,
};

// Context
const EditorContext = createContext<EditorContextValue | null>(null);

// Hook to use editor context
export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return context;
}

// Optional hook that returns null if not in context (for conditional usage)
export function useEditorContextOptional() {
  return useContext(EditorContext);
}

// Provider props
export type EditorProviderProps = {
  children: ReactNode;

  // Required
  orgSlug: string;

  // Mode (defaults to standalone)
  mode?: EditorMode;
  variableContext?: VariableContext;

  // Template info (required for standalone, optional for inline)
  templateId?: string;
  templateName?: string;

  // Content
  initialContent?: JSONContent;
  subject?: string;
  previewText?: string;

  // Callbacks
  onSave?: (content: JSONContent, metadata: EditorMetadata) => Promise<void>;
  onCancel?: () => void;
  onTemplateCreated?: (templateId: string) => void;

  // Feature overrides
  features?: Partial<ToolbarFeatures>;

  // Auto-save
  autoSave?: boolean;
  autoSaveDelay?: number;
};

export function EditorProvider({
  children,
  orgSlug,
  mode = "standalone",
  variableContext = "broadcast",
  templateId,
  templateName,
  initialContent,
  subject,
  previewText,
  onSave,
  onCancel,
  onTemplateCreated,
  features: featureOverrides,
  autoSave,
  autoSaveDelay,
}: EditorProviderProps) {
  const value = useMemo<EditorContextValue>(() => {
    // Determine auto-save based on mode
    const effectiveAutoSave = autoSave ?? mode === "standalone";
    const effectiveAutoSaveDelay = autoSaveDelay ?? 60_000; // 1 minute default

    // Merge default features with overrides
    const baseFeatures = defaultFeaturesByMode[mode];
    const mergedFeatures: ToolbarFeatures = {
      ...baseFeatures,
      ...featureOverrides,
    };

    return {
      mode,
      variableContext,
      orgSlug,
      templateId,
      templateName,
      initialContent,
      subject,
      previewText,
      onSave,
      onCancel,
      onTemplateCreated,
      features: mergedFeatures,
      autoSave: effectiveAutoSave,
      autoSaveDelay: effectiveAutoSaveDelay,
    };
  }, [
    mode,
    variableContext,
    orgSlug,
    templateId,
    templateName,
    initialContent,
    subject,
    previewText,
    onSave,
    onCancel,
    onTemplateCreated,
    featureOverrides,
    autoSave,
    autoSaveDelay,
  ]);

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}
