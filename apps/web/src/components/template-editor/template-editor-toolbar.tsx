"use client";

import type { Editor } from "@tiptap/react";
import type { EmailType } from "@wraps/db";
import {
  BookOpen,
  Braces,
  Cloud,
  CloudOff,
  Code2,
  Copy,
  Eye,
  History,
  Import,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Redo2,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RainbowButton } from "@/components/ui/rainbow-button";
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
import { BrandKitSelector } from "./brand-kit-selector";
import { SubjectEditDialog } from "./subject-edit-dialog";

type TemplateEditorToolbarProps = {
  editor: Editor | null;
  orgSlug: string;
  templateName?: string;
  isSaving?: boolean;
  isPublishing?: boolean;
  subject?: string | null;
  previewText?: string | null;
  emailType?: EmailType;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  onImport?: () => void;
  onSave?: () => void;
  onSaveBlock?: () => void;
  onSendTest?: () => void;
  onSubjectChange?: (
    subject: string,
    previewText: string,
    emailType: EmailType
  ) => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

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

export function TemplateEditorToolbar({
  editor,
  orgSlug,
  templateName,
  isSaving,
  isPublishing,
  subject,
  previewText,
  emailType = "marketing",
  status = "DRAFT",
  onImport,
  onSave,
  onSaveBlock,
  onSendTest,
  onSubjectChange,
  onPublish,
  onUnpublish,
  onDuplicate,
  onDelete,
}: TemplateEditorToolbarProps) {
  const {
    view,
    showBlockLibrary,
    showPropertiesPanel,
    showAIPanel,
    showVersionHistory,
  } = useTemplateStore((state) => state.localState);
  const {
    setView,
    toggleBlockLibrary,
    togglePropertiesPanel,
    toggleAIPanel,
    toggleVersionHistory,
  } = useTemplateStore((state) => state.actions);

  const [showSubjectDialog, setShowSubjectDialog] = useState(false);

  if (!editor) {
    return null;
  }

  const displaySubject = subject || "No subject";
  const displayPreviewText = previewText || "Add preview text...";

  return (
    <TooltipProvider>
      <div className="border-b">
        {/* Row 1: Brand Kit + Subject/Preview + Status */}
        <div className="flex items-center gap-3 border-b px-3 py-2">
          {/* Brand Kit Selector */}
          <BrandKitSelector orgSlug={orgSlug} />

          <Separator className="h-5" orientation="vertical" />

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
          </div>

          {/* Status Badge */}
          <Badge
            className={cn("shrink-0", statusConfig[status].className)}
            variant="outline"
          >
            {statusConfig[status].label}
          </Badge>
        </div>

        {/* Row 2: Sidebar Toggles + Edit Controls + View Tabs + Actions */}
        <div className="flex items-center gap-1 bg-muted/30 px-2 py-1.5">
          {/* Sidebar Toggles */}
          <div className="flex items-center gap-0.5">
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
          </div>

          <Separator className="mx-1 h-6" orientation="vertical" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
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
          </div>

          <Separator className="mx-1 h-6" orientation="vertical" />

          {/* Insert Variable */}
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
              <TabsTrigger
                className="h-7 gap-1.5 px-2.5 text-xs"
                value="preview"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </TabsTrigger>
              <TabsTrigger className="h-7 gap-1.5 px-2.5 text-xs" value="code">
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Code</span>
              </TabsTrigger>
              <TabsTrigger className="h-7 gap-1.5 px-2.5 text-xs" value="usage">
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Usage</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Spacer */}
          <div className="flex-1" />

          {/* AI Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <RainbowButton
                className="h-8 gap-1.5 px-2.5"
                onClick={toggleAIPanel}
                size="sm"
                variant={showAIPanel ? "default" : "outline"}
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden text-xs sm:inline">AI</span>
              </RainbowButton>
            </TooltipTrigger>
            <TooltipContent>AI Assistant</TooltipContent>
          </Tooltip>

          {/* More Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={toggleVersionHistory}>
                <History className="mr-2 h-4 w-4" />
                Version History
                {showVersionHistory && (
                  <span className="ml-auto text-muted-foreground text-xs">
                    On
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onImport && view === "edit" && (
                <DropdownMenuItem onClick={onImport}>
                  <Import className="mr-2 h-4 w-4" />
                  Import HTML
                </DropdownMenuItem>
              )}
              {onSaveBlock && view === "edit" && (
                <DropdownMenuItem onClick={onSaveBlock}>
                  <Package className="mr-2 h-4 w-4" />
                  Save as Block
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate Template
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Template
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator className="mx-1 h-6" orientation="vertical" />

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Save button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-8 gap-1.5 px-2"
                  disabled={isSaving}
                  onClick={onSave}
                  size="sm"
                  variant="outline"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden text-xs sm:inline">
                    {isSaving ? "Saving" : "Save"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save template (Cmd+S)</TooltipContent>
            </Tooltip>

            {/* Test button */}
            {onSendTest && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8 gap-1.5 px-2"
                    onClick={onSendTest}
                    size="sm"
                    variant="outline"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span className="hidden text-xs sm:inline">Test</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send test email</TooltipContent>
              </Tooltip>
            )}

            {/* Publish/Update button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-8 gap-1.5 px-2"
                  disabled={isPublishing || !subject}
                  onClick={onPublish}
                  size="sm"
                >
                  {isPublishing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Cloud className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden text-xs sm:inline">
                    {isPublishing
                      ? "Publishing"
                      : status === "PUBLISHED"
                        ? "Update"
                        : "Publish"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {subject
                  ? status === "PUBLISHED"
                    ? "Update template on AWS SES"
                    : "Publish to AWS SES"
                  : "Add a subject line to publish"}
              </TooltipContent>
            </Tooltip>

            {/* Unpublish button - only shown when published */}
            {status === "PUBLISHED" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8 w-8 p-0"
                    disabled={isPublishing}
                    onClick={onUnpublish}
                    size="sm"
                    variant="ghost"
                  >
                    {isPublishing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CloudOff className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove from AWS SES</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Subject Edit Dialog */}
      <SubjectEditDialog
        emailType={emailType}
        isOpen={showSubjectDialog}
        onClose={() => setShowSubjectDialog(false)}
        onSave={(newSubject, newPreviewText, newEmailType) => {
          onSubjectChange?.(newSubject, newPreviewText, newEmailType);
        }}
        previewText={previewText ?? ""}
        subject={subject ?? ""}
      />
    </TooltipProvider>
  );
}
