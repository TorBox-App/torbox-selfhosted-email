"use client";

import type { EmailType, Template } from "@wraps/db";
import { Badge } from "@wraps/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wraps/ui/components/ui/dropdown-menu";
import { Separator } from "@wraps/ui/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@wraps/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wraps/ui/components/ui/tooltip";
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  Code2,
  Copy,
  FileSignature,
  Globe,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type SaveStatus, SaveStatusIndicator } from "./save-status-indicator";
import { SubjectEditDialog } from "./subject-edit-dialog";
import { TemplateNameDialog } from "./wrappers/template-name-dialog";

export type CodeTemplateView = "design" | "code";

type CodeTemplateToolbarProps = {
  template: Template;
  orgSlug: string;
  view: CodeTemplateView;
  onViewChange: (view: CodeTemplateView) => void;
  subject: string;
  previewText: string;
  emailType: EmailType;
  isPublishing: boolean;
  saveStatus: SaveStatus;
  lastSavedAt?: Date;
  showVersionHistory: boolean;
  onToggleVersionHistory: () => void;
  onSendTest: () => void;
  onSubjectChange: (
    subject: string,
    previewText: string,
    emailType: EmailType
  ) => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDuplicate: () => void;
  onRename: (name: string, description?: string) => void;
  onDelete: () => void;
};

const statusConfig: Record<
  string,
  { label: string; variant: ComponentProps<typeof Badge>["variant"] }
> = {
  DRAFT: { label: "Draft", variant: "warning" },
  PUBLISHED: { label: "Published", variant: "success" },
  ARCHIVED: { label: "Archived", variant: "secondary" },
};

export function CodeTemplateToolbar({
  template,
  orgSlug,
  view,
  onViewChange,
  subject,
  previewText,
  emailType,
  isPublishing,
  saveStatus,
  lastSavedAt,
  showVersionHistory,
  onToggleVersionHistory,
  onSendTest,
  onSubjectChange,
  onPublish,
  onUnpublish,
  onDuplicate,
  onRename,
  onDelete,
}: CodeTemplateToolbarProps) {
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  const status = template.status ?? "DRAFT";
  const displaySubject = subject || "No subject";
  const displayPreviewText = previewText || "Add preview text...";

  return (
    <TooltipProvider>
      <div
        aria-label="Code template editor toolbar"
        className="border-b"
        role="toolbar"
      >
        {/* Row 1: Back + Template name + Managed badge + Status */}
        <div className="flex items-center gap-3 border-b px-3 py-2">
          {/* Back to templates */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild size="icon-sm" variant="ghost">
                <Link href={`/${orgSlug}/emails/templates`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to templates</TooltipContent>
          </Tooltip>

          <Separator className="h-5" orientation="vertical" />

          {/* Template name */}
          <span className="shrink-0 truncate font-medium text-sm">
            {template.name}
          </span>

          <Separator className="h-5" orientation="vertical" />

          {/* Subject + preview text */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  "truncate font-medium text-sm",
                  !subject && "text-muted-foreground italic"
                )}
              >
                {displaySubject}
              </span>
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
                  className="h-7 w-7 shrink-0"
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

          {/* Source indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className="shrink-0 gap-1.5"
                variant={
                  template.lastEditedFrom === "dashboard" ? "info" : "secondary"
                }
              >
                {template.lastEditedFrom === "dashboard" ? (
                  <>
                    <Globe className="h-3 w-3" />
                    Last edited on dashboard
                  </>
                ) : (
                  <>
                    <Terminal className="h-3 w-3" />
                    Last pushed from CLI
                  </>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {template.lastEditedFrom === "dashboard"
                ? "Template was last modified on the dashboard"
                : template.cliProjectPath
                  ? `Source: ${template.cliProjectPath}`
                  : "Pushed from CLI"}
            </TooltipContent>
          </Tooltip>

          <SaveStatusIndicator
            className="shrink-0"
            lastSavedAt={lastSavedAt}
            status={saveStatus}
          />

          <Separator className="h-5" orientation="vertical" />

          {/* Status Badge */}
          <Badge
            className="shrink-0"
            variant={statusConfig[status]?.variant ?? "outline"}
          >
            {statusConfig[status]?.label ?? status}
          </Badge>
        </div>

        {/* Row 2: View Tabs + Actions */}
        <div className="flex items-center gap-1 bg-muted/30 px-2 py-1.5">
          {/* View Mode Tabs */}
          <Tabs
            onValueChange={(value) => onViewChange(value as CodeTemplateView)}
            value={view}
          >
            <TabsList className="h-8">
              <TabsTrigger className="h-7 gap-1.5" value="design">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Design</span>
              </TabsTrigger>
              <TabsTrigger className="h-7 gap-1.5" value="code">
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Code</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Version History Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-pressed={showVersionHistory}
                onClick={onToggleVersionHistory}
                size="icon-sm"
                variant="ghost"
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showVersionHistory ? "Hide version history" : "Version history"}
            </TooltipContent>
          </Tooltip>

          {/* More Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
                <FileSignature className="mr-2 h-4 w-4" />
                Rename Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator className="mx-1 h-6" orientation="vertical" />

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Test button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-8 gap-1.5"
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

            {/* Publish/Update button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-8 gap-1.5"
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

            {/* Unpublish button */}
            {status === "PUBLISHED" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    disabled={isPublishing}
                    onClick={onUnpublish}
                    size="icon-sm"
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
          onSubjectChange(newSubject, newPreviewText, newEmailType);
        }}
        previewText={previewText}
        subject={subject}
      />

      {/* Rename Template Dialog */}
      <TemplateNameDialog
        defaultDescription={template.description ?? undefined}
        defaultName={template.name}
        description="Update the name and description of your template."
        onConfirm={(name, description) => {
          onRename(name, description);
        }}
        onOpenChange={setShowRenameDialog}
        open={showRenameDialog}
        submitLabel="Save"
        title="Rename Template"
      />
    </TooltipProvider>
  );
}
