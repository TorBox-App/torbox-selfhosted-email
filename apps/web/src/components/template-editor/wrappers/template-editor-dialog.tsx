"use client";

import type { JSONContent } from "@tiptap/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@wraps/ui/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@wraps/ui/components/ui/sheet";
import type { VariableContext } from "../core";
import { InlineEditor } from "./inline-editor";

export type TemplateEditorDialogProps = {
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
   * Initial subject line for new templates
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
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback to change open state
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Callback when template is saved/selected
   */
  onTemplateSelect?: (templateId: string) => void;

  /**
   * Dialog title
   */
  title?: string;

  /**
   * Use sheet instead of dialog (for full-width editing)
   */
  useSheet?: boolean;
};

/**
 * Dialog/Sheet wrapper for the inline template editor.
 * Provides a modal interface for creating/editing templates.
 *
 * Usage:
 * ```tsx
 * <TemplateEditorDialog
 *   orgSlug={orgSlug}
 *   templateId={selectedTemplateId}
 *   variableContext="broadcast"
 *   open={showEditor}
 *   onOpenChange={setShowEditor}
 *   onTemplateSelect={(id) => {
 *     setSelectedTemplateId(id);
 *     setShowEditor(false);
 *   }}
 * />
 * ```
 */
export function TemplateEditorDialog({
  orgSlug,
  templateId,
  templateName,
  initialContent,
  initialSubject,
  initialPreviewText,
  variableContext = "broadcast",
  open,
  onOpenChange,
  onTemplateSelect,
  title,
  useSheet = true,
}: TemplateEditorDialogProps) {
  const dialogTitle =
    title || (templateId ? "Edit Template" : "Create Template");

  const handleSave = (savedTemplateId: string) => {
    onTemplateSelect?.(savedTemplateId);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const editorContent = (
    <InlineEditor
      className="flex-1"
      height="100%"
      initialContent={initialContent}
      initialPreviewText={initialPreviewText}
      initialSubject={initialSubject}
      onCancel={handleCancel}
      onSave={handleSave}
      orgSlug={orgSlug}
      templateId={templateId}
      templateName={templateName}
      variableContext={variableContext}
    />
  );

  if (useSheet) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          className="flex w-full max-w-6xl flex-col gap-0 p-0 sm:max-w-6xl"
          side="right"
        >
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{dialogTitle}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">{editorContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex h-[90vh] max-w-6xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">{editorContent}</div>
      </DialogContent>
    </Dialog>
  );
}
