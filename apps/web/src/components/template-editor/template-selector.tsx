"use client";

import { Code, Copy, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDuplicateTemplate,
  useTemplates,
} from "@/hooks/use-template-queries";
import { cn } from "@/lib/utils";

export type TemplateSelectorProps = {
  orgSlug: string;
  selectedTemplateId?: string;
  onTemplateChange: (
    templateId: string,
    template?: { subject?: string | null; previewText?: string | null }
  ) => void;
  createLabel?: string;
  className?: string;
};

type TemplatePreviewCardProps = {
  template: {
    name: string;
    subject: string | null;
    compiledHtml: string | null;
    sourceFormat: string | null;
  };
  onEdit: () => void;
};

function TemplatePreviewCard({ template, onEdit }: TemplatePreviewCardProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{template.name}</p>
          {template.subject && (
            <p className="truncate text-muted-foreground text-xs">
              Subject: {template.subject}
            </p>
          )}
          {template.sourceFormat === "react-email" && (
            <p className="mt-0.5 text-xs">
              <Code className="mr-1 inline h-3 w-3" />
              <span className="text-muted-foreground">Code template</span>
            </p>
          )}
        </div>
        <Button
          className="ml-2 shrink-0"
          onClick={onEdit}
          size="sm"
          type="button"
          variant="outline"
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
      {template.compiledHtml && (
        <div className="overflow-hidden rounded border bg-background">
          <iframe
            className="pointer-events-none h-[200px] w-full origin-top-left"
            sandbox=""
            srcDoc={template.compiledHtml}
            title="Template preview"
          />
        </div>
      )}
    </div>
  );
}

export function TemplateSelector({
  orgSlug,
  selectedTemplateId,
  onTemplateChange,
  createLabel = "Create New",
  className,
}: TemplateSelectorProps) {
  const { data: templatesData } = useTemplates(orgSlug);
  const templates = templatesData ?? [];

  const [showEditChoiceDialog, setShowEditChoiceDialog] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const duplicateMutation = useDuplicateTemplate(orgSlug);

  const selectedTemplate = templatesData?.find(
    (t) => t.id === selectedTemplateId
  );

  const openTemplateInNewTab = (templateId: string) => {
    window.open(`/${orgSlug}/emails/templates/${templateId}`, "_blank");
  };

  const handleCreateNew = () => {
    window.open(`/${orgSlug}/emails/templates/new`, "_blank");
  };

  const handleEditClick = () => {
    setShowEditChoiceDialog(true);
  };

  const handleEditOriginal = () => {
    setShowEditChoiceDialog(false);
    if (selectedTemplateId) {
      openTemplateInNewTab(selectedTemplateId);
    }
  };

  const handleDuplicateAndEdit = async () => {
    if (!selectedTemplateId) return;
    setIsDuplicating(true);
    try {
      const duplicated =
        await duplicateMutation.mutateAsync(selectedTemplateId);
      onTemplateChange(duplicated.id, {
        subject: duplicated.subject ?? null,
        previewText: duplicated.previewText ?? null,
      });
      setShowEditChoiceDialog(false);
      openTemplateInNewTab(duplicated.id);
    } catch (error) {
      toast.error("Failed to duplicate template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleSelectChange = (templateId: string) => {
    const tmpl = templatesData?.find((t) => t.id === templateId);
    onTemplateChange(templateId, {
      subject: tmpl?.subject ?? null,
      previewText: tmpl?.previewText ?? null,
    });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {templates.length > 0 ? (
        <>
          <Select onValueChange={handleSelectChange} value={selectedTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTemplateId && selectedTemplate && (
            <TemplatePreviewCard
              onEdit={handleEditClick}
              template={selectedTemplate}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleCreateNew}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {createLabel}
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-muted-foreground text-sm">No templates yet</p>
          <Button
            className="mt-2"
            onClick={handleCreateNew}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create Your First Template
          </Button>
        </div>
      )}

      <AlertDialog
        onOpenChange={setShowEditChoiceDialog}
        open={showEditChoiceDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Template</AlertDialogTitle>
            <AlertDialogDescription>
              How would you like to edit this template?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              className="justify-start"
              disabled={isDuplicating}
              onClick={handleEditOriginal}
              variant="outline"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Original
              <span className="ml-auto text-muted-foreground text-xs">
                Changes affect all broadcasts using this template
              </span>
            </Button>
            <Button
              className="justify-start"
              disabled={isDuplicating}
              onClick={handleDuplicateAndEdit}
              variant="outline"
            >
              <Copy className="mr-2 h-4 w-4" />
              {isDuplicating ? "Duplicating…" : "Duplicate & Edit"}
              <span className="ml-auto text-muted-foreground text-xs">
                Create a copy for this broadcast only
              </span>
            </Button>
          </div>
          <AlertDialogFooter>
            <Button
              disabled={isDuplicating}
              onClick={() => setShowEditChoiceDialog(false)}
              variant="ghost"
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
