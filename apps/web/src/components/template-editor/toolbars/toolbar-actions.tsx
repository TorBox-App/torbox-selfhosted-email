"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wraps/ui/components/ui/dropdown-menu";
import { Separator } from "@wraps/ui/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wraps/ui/components/ui/tooltip";
import {
  Cloud,
  CloudOff,
  Copy,
  History,
  Import,
  Loader2,
  MoreHorizontal,
  Package,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useTemplateStore } from "@/stores/template-store";
import { useEditorContext } from "../core/editor-context";

/**
 * Props for standalone template actions
 */
export type TemplateToolbarActionsProps = {
  isSaving?: boolean;
  isPublishing?: boolean;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  subject?: string;
  onSave?: () => void;
  onSendTest?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onImport?: () => void;
  onSaveBlock?: () => void;
};

/**
 * Action buttons for standalone template editor.
 * Includes: AI toggle, More menu, Save, Test, Publish/Update, Unpublish
 */
export function TemplateToolbarActions({
  isSaving,
  isPublishing,
  status = "DRAFT",
  subject,
  onSave,
  onSendTest,
  onPublish,
  onUnpublish,
  onDuplicate,
  onDelete,
  onImport,
  onSaveBlock,
}: TemplateToolbarActionsProps) {
  const { features } = useEditorContext();
  const { view, showAIPanel, showVersionHistory } = useTemplateStore(
    (state) => state.localState
  );
  const { toggleAIPanel, toggleVersionHistory } = useTemplateStore(
    (state) => state.actions
  );

  return (
    <>
      {/* AI Button */}
      {features.ai && (
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
      )}

      {/* More Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {features.versionHistory && (
            <DropdownMenuItem onClick={toggleVersionHistory}>
              <History className="mr-2 h-4 w-4" />
              Version History
              {showVersionHistory && (
                <span className="ml-auto text-muted-foreground text-xs">
                  On
                </span>
              )}
            </DropdownMenuItem>
          )}
          {features.versionHistory && <DropdownMenuSeparator />}

          {features.import && onImport && view === "edit" && (
            <DropdownMenuItem onClick={onImport}>
              <Import className="mr-2 h-4 w-4" />
              Import HTML
            </DropdownMenuItem>
          )}
          {features.saveBlock && onSaveBlock && view === "edit" && (
            <DropdownMenuItem onClick={onSaveBlock}>
              <Package className="mr-2 h-4 w-4" />
              Save as Block
            </DropdownMenuItem>
          )}
          {features.duplicate && onDuplicate && (
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate Template
            </DropdownMenuItem>
          )}
          {features.delete && onDelete && (
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
        {features.sendTest && onSendTest && (
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
        {features.publish && (
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
        )}

        {/* Unpublish button - only shown when published */}
        {features.publish && status === "PUBLISHED" && (
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
    </>
  );
}

/**
 * Props for inline editor actions
 */
export type InlineToolbarActionsProps = {
  isSaving?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
};

/**
 * Action buttons for inline template editor (used in dialogs).
 * Includes: AI toggle, Cancel, Save Template
 */
export function InlineToolbarActions({
  isSaving,
  onSave,
  onCancel,
  saveLabel = "Save Template",
  cancelLabel = "Cancel",
}: InlineToolbarActionsProps) {
  const { features } = useEditorContext();
  const { showAIPanel } = useTemplateStore((state) => state.localState);
  const { toggleAIPanel } = useTemplateStore((state) => state.actions);

  return (
    <div className="flex items-center gap-2">
      {/* AI Button */}
      {features.ai && (
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
      )}

      <Separator className="mx-1 h-6" orientation="vertical" />

      {onCancel && (
        <Button
          className="h-8 gap-1.5 px-3"
          onClick={onCancel}
          size="sm"
          variant="outline"
        >
          <X className="h-3.5 w-3.5" />
          <span className="text-xs">{cancelLabel}</span>
        </Button>
      )}

      {onSave && (
        <Button
          className="h-8 gap-1.5 px-3"
          disabled={isSaving}
          onClick={onSave}
          size="sm"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="text-xs">{isSaving ? "Saving..." : saveLabel}</span>
        </Button>
      )}
    </div>
  );
}
