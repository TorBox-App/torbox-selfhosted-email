"use client";

import { useDebouncer } from "@tanstack/react-pacer";
import { type JSONContent, Node } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import BulletList from "@tiptap/extension-bullet-list";
import { Color } from "@tiptap/extension-color";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useRef } from "react";

// Import custom extensions
import {
  ConditionalNode,
  EmailAvatarNode,
  EmailButtonNode,
  EmailCodeBlockNode,
  EmailCodeInlineMark,
  EmailColumnNode,
  EmailDividerNode,
  EmailIconNode,
  EmailImageNode,
  EmailPreviewNode,
  EmailRowNode,
  EmailSectionNode,
  EmailSocialLinksNode,
  EmailSpacerNode,
  FontSize,
  KeyboardShortcuts,
  VariableNode,
  VariableSuggestion,
} from "@/components/template-editor/extensions";
import {
  getVariablesForContext,
  toSuggestionFormat,
} from "../variables/variable-definitions";
import type { VariableContext } from "./editor-context";

/**
 * Custom Document extension that stores Body/Container classNames
 * as attributes on the doc node. This allows wrapper styling to persist
 * through save/reload cycles since doc attrs are included in getJSON().
 */
const EmailDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "block+",
  addAttributes() {
    return {
      bodyClassName: { default: null },
      containerClassName: { default: null },
    };
  },
});

export type UseEditorInstanceOptions = {
  /**
   * Initial content for the editor
   */
  initialContent?: JSONContent;

  /**
   * Callback when content should be saved
   */
  onSave?: (content: JSONContent) => Promise<void>;

  /**
   * Callback when content updates (for real-time sync)
   */
  onUpdate?: (content: JSONContent) => void;

  /**
   * Callback when block library should toggle
   */
  onToggleBlockLibrary?: () => void;

  /**
   * Enable auto-save (default: true)
   */
  autoSave?: boolean;

  /**
   * Auto-save delay in milliseconds (default: 60000 = 1 minute)
   */
  autoSaveDelay?: number;

  /**
   * Placeholder text for empty editor
   */
  placeholder?: string;

  /**
   * Variable context for context-aware variable suggestions
   */
  variableContext?: VariableContext;
};

// Default empty document structure with Preview for inbox preview text
const defaultContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "emailPreview",
      attrs: {
        text: "Preview text shown in inbox",
      },
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Start typing or add blocks..." }],
    },
  ],
};

/**
 * Core hook for creating a TipTap editor instance with all email extensions.
 * This is a context-agnostic hook that can be used in any email editing scenario.
 */
export function useEditorInstance({
  initialContent,
  onSave,
  onUpdate,
  onToggleBlockLibrary,
  autoSave = true,
  autoSaveDelay = 60_000,
  placeholder = "Start typing or use the block palette to add email components...",
  variableContext = "broadcast",
}: UseEditorInstanceOptions = {}) {
  const lastSavedContentRef = useRef<string>("");

  // Save function that checks for changes
  const saveContent = useCallback(
    async (content: JSONContent) => {
      const contentStr = JSON.stringify(content);

      // Only save if content has changed
      if (contentStr !== lastSavedContentRef.current) {
        lastSavedContentRef.current = contentStr;
        await onSave?.(content);
      }
    },
    [onSave]
  );

  // Use TanStack Pacer for debounced auto-save
  const saveDebouncer = useDebouncer(saveContent, {
    wait: autoSaveDelay,
  });

  // Memoize initial content to prevent unnecessary re-renders
  const content = useMemo(
    () => initialContent || defaultContent,
    [initialContent]
  );

  const editor = useEditor({
    // Required for Next.js SSR compatibility
    immediatelyRender: false,

    extensions: [
      StarterKit.configure({
        // Use custom EmailDocument with wrapper className attrs
        document: false,
        // Disable extensions we're replacing with draggable versions
        paragraph: false,
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        // Disable code extensions we don't need
        codeBlock: false,
        code: false,
      }),

      // Custom Document with bodyClassName/containerClassName attrs
      EmailDocument,

      // Text blocks with draggable enabled
      Paragraph.extend({ draggable: true }),
      Heading.extend({ draggable: true }),
      Blockquote.extend({ draggable: true }),
      BulletList.extend({ draggable: true }),
      OrderedList.extend({ draggable: true }),

      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
      }),

      // Text styling extensions
      TextStyle,
      Color,
      FontSize,
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),

      // Link extension for text links
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),

      // React Email nodes
      EmailButtonNode,
      EmailSectionNode,
      EmailImageNode,
      EmailDividerNode,
      EmailSpacerNode,
      EmailRowNode,
      EmailColumnNode,
      EmailPreviewNode,
      EmailAvatarNode,
      EmailIconNode,
      EmailCodeBlockNode,
      EmailSocialLinksNode,

      // Marks
      EmailCodeInlineMark,

      // Dynamic content
      VariableNode,
      ConditionalNode,

      // Variable autocomplete (type {{ to trigger)
      // Context-aware variables based on email type (broadcast, confirmation, automation)
      VariableSuggestion.configure({
        variables: toSuggestionFormat(getVariablesForContext(variableContext)),
      }),

      // Keyboard shortcuts (Cmd+S to save, Cmd+K for block palette)
      KeyboardShortcuts.configure({
        onSave: (editorInstance) => {
          if (onSave) {
            const editorContent = editorInstance.getJSON();
            onSave(editorContent);
          }
        },
        onToggleBlockLibrary,
      }),
    ],

    content,

    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[400px]",
      },
    },

    onUpdate: ({ editor: editorInstance }) => {
      const editorContent = editorInstance.getJSON();
      onUpdate?.(editorContent);

      // Trigger auto-save via Pacer debouncer
      if (autoSave && onSave) {
        saveDebouncer.maybeExecute(editorContent);
      }
    },

    onSelectionUpdate: ({ editor: _editorInstance }) => {
      // Could emit selected node info here for properties panel
      // const { from, to } = editorInstance.state.selection;
      // const node = editorInstance.state.doc.nodeAt(from);
    },
  });

  // Initialize lastSavedContentRef when editor is ready
  useEffect(() => {
    if (editor && initialContent) {
      lastSavedContentRef.current = JSON.stringify(initialContent);
    }
  }, [editor, initialContent]);

  // Manual save function - flushes any pending debounced save and saves immediately
  const saveNow = useCallback(async () => {
    if (!(editor && onSave)) {
      return;
    }

    // Cancel any pending debounced save
    saveDebouncer.cancel();

    const editorContent = editor.getJSON();
    lastSavedContentRef.current = JSON.stringify(editorContent);
    await onSave(editorContent);
  }, [editor, onSave, saveDebouncer]);

  // Helper to insert blocks
  const insertBlock = useCallback(
    (
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
    ) => {
      if (!editor) {
        return;
      }

      switch (type) {
        case "emailButton":
          editor.commands.insertEmailButton(attrs);
          break;
        case "emailSection":
          editor.commands.insertEmailSection(attrs);
          break;
        case "emailImage":
          editor.commands.insertEmailImage(attrs);
          break;
        case "emailDivider":
          editor.commands.insertEmailDivider(attrs);
          break;
        case "emailSpacer":
          editor.commands.insertEmailSpacer(attrs);
          break;
        case "emailRow":
          editor.commands.insertEmailRow(attrs, 2);
          break;
        case "conditional":
          editor.commands.insertConditional(attrs);
          break;
        case "variable":
          editor.commands.insertVariable(
            attrs as { name?: string; label?: string }
          );
          break;
      }
    },
    [editor]
  );

  // Get current content
  const getContent = useCallback(() => editor?.getJSON() ?? null, [editor]);

  // Set content
  const setContent = useCallback(
    (newContent: JSONContent) => {
      if (editor?.isEditable) {
        editor.commands.setContent(newContent);
      }
    },
    [editor]
  );

  // Cancel any pending saves (useful for cleanup)
  const cancelPendingSave = useCallback(() => {
    saveDebouncer.cancel();
  }, [saveDebouncer]);

  return {
    editor,
    saveNow,
    insertBlock,
    getContent,
    setContent,
    cancelPendingSave,
    isReady: !!editor,
  };
}
