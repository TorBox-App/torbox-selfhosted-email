"use client";

import type { Editor } from "@tiptap/react";
import {
  Braces,
  Code2,
  Eye,
  LayoutGrid,
  Pencil,
  Redo2,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTemplateStore } from "@/stores/template-store";
import { BrandKitSelector } from "../brand-kit-selector";
import { SubjectEditDialog } from "../subject-edit-dialog";
import { useEditorContext } from "../core/editor-context";

type ViewMode = "edit" | "preview" | "code" | "usage";

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  },
};

export type BaseToolbarProps = {
  /**
   * TipTap editor instance
   */
  editor: Editor;

  /**
   * Subject line for the email
   */
  subject?: string;

  /**
   * Preview text for the email
   */
  previewText?: string;

  /**
   * Template status (only shown in standalone mode)
   */
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";

  /**
   * Callback when subject/preview changes
   */
  onSubjectChange?: (subject: string, previewText: string) => void;

  /**
   * Slot for context-specific action buttons (right side)
   */
  actions?: ReactNode;

  /**
   * Slot for additional menu items in the more menu
   */
  moreMenuContent?: ReactNode;
};

/**
 * Base toolbar component with core editing controls.
 * Accepts action buttons via the `actions` prop for context-specific functionality.
 *
 * Usage:
 * ```tsx
 * <BaseToolbar
 *   editor={editor}
 *   subject={subject}
 *   actions={<TemplateToolbarActions />}
 * />
 * ```
 */
export function BaseToolbar({
  editor,
  subject,
  previewText,
  status,
  onSubjectChange,
  actions,
  moreMenuContent,
}: BaseToolbarProps) {
  const { orgSlug, mode, features } = useEditorContext();

  const { view, showBlockLibrary, showPropertiesPanel } = useTemplateStore(
    (state) => state.localState
  );
  const { setView, toggleBlockLibrary, togglePropertiesPanel } =
    useTemplateStore((state) => state.actions);

  const [showSubjectDialog, setShowSubjectDialog] = useState(false);

  const displaySubject = subject || "No subject";
  const displayPreviewText = previewText || "Add preview text...";

  // Determine which view tabs to show based on features
  const showCodeTab = features.code;
  const showUsageTab = features.usage && mode === "standalone";

  return (
    <TooltipProvider>
      <div className="border-b">
        {/* Row 1: Brand Kit + Subject/Preview + Status */}
        <div className="flex items-center gap-3 border-b px-3 py-2">
          {/* Brand Kit Selector */}
          {features.brandKit && <BrandKitSelector orgSlug={orgSlug} />}

          {features.brandKit && (
            <Separator className="h-5" orientation="vertical" />
          )}

          {/* Subject and Preview Display */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "truncate font-medium text-sm",
                    !subject && "text-muted-foreground italic"
                  )}
                >
                  {displaySubject}
                </span>
              </div>
              <p
                className={cn(
                  "truncate text-muted-foreground text-xs",
                  !previewText && "italic"
                )}
              >
                {displayPreviewText}
              </p>
            </div>

            {/* Edit button */}
            {onSubjectChange && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-7 w-7 shrink-0 p-0"
                    onClick={() => setShowSubjectDialog(true)}
                    size="sm"
                    variant="ghost"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit subject & preview</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Status Badge (only in standalone mode) */}
          {mode === "standalone" && status && (
            <Badge
              className={cn("shrink-0", statusConfig[status].className)}
              variant="outline"
            >
              {statusConfig[status].label}
            </Badge>
          )}
        </div>

        {/* Row 2: Sidebar Toggles + Edit Controls + View Tabs + Actions */}
        <div className="flex items-center gap-1 bg-muted/30 px-2 py-1.5">
          {/* Sidebar Toggles */}
          <div className="flex items-center gap-0.5">
            {features.blocks && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8 w-8 p-0"
                    onClick={toggleBlockLibrary}
                    size="sm"
                    variant={showBlockLibrary ? "secondary" : "ghost"}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Blocks Panel</TooltipContent>
              </Tooltip>
            )}

            {features.properties && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8 w-8 p-0"
                    onClick={togglePropertiesPanel}
                    size="sm"
                    variant={showPropertiesPanel ? "secondary" : "ghost"}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Properties Panel</TooltipContent>
              </Tooltip>
            )}
          </div>

          <Separator className="mx-1 h-6" orientation="vertical" />

          {/* Undo/Redo */}
          {(features.undo || features.redo) && (
            <>
              <div className="flex items-center gap-0.5">
                {features.undo && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="h-8 w-8 p-0"
                        disabled={!editor.can().undo()}
                        onClick={() => editor.chain().focus().undo().run()}
                        size="sm"
                        variant="ghost"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Undo (Cmd+Z)</TooltipContent>
                  </Tooltip>
                )}

                {features.redo && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="h-8 w-8 p-0"
                        disabled={!editor.can().redo()}
                        onClick={() => editor.chain().focus().redo().run()}
                        size="sm"
                        variant="ghost"
                      >
                        <Redo2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Redo (Cmd+Shift+Z)</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <Separator className="mx-1 h-6" orientation="vertical" />
            </>
          )}

          {/* Insert Variable */}
          {features.variables && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8 w-8 p-0"
                    onClick={() => editor.commands.insertContent("{{")}
                    size="sm"
                    variant="ghost"
                  >
                    <Braces className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert Variable</TooltipContent>
              </Tooltip>

              <Separator className="mx-1 h-6" orientation="vertical" />
            </>
          )}

          {/* View Mode Tabs */}
          <Tabs
            onValueChange={(value) => setView(value as ViewMode)}
            value={view}
          >
            <TabsList className="h-8">
              <TabsTrigger className="h-7 gap-1.5 px-2.5 text-xs" value="edit">
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </TabsTrigger>
              {features.preview && (
                <TabsTrigger
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  value="preview"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </TabsTrigger>
              )}
              {showCodeTab && (
                <TabsTrigger
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  value="code"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Code</span>
                </TabsTrigger>
              )}
              {showUsageTab && (
                <TabsTrigger
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  value="usage"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Usage</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Context-specific actions slot */}
          {actions}
        </div>
      </div>

      {/* Subject Edit Dialog */}
      {onSubjectChange && (
        <SubjectEditDialog
          isOpen={showSubjectDialog}
          onClose={() => setShowSubjectDialog(false)}
          onSave={(newSubject, newPreviewText) => {
            onSubjectChange(newSubject, newPreviewText);
          }}
          previewText={previewText ?? ""}
          subject={subject ?? ""}
        />
      )}
    </TooltipProvider>
  );
}
