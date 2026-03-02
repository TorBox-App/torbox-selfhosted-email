"use client";

import MonacoEditor from "@monaco-editor/react";
import type { Template } from "@wraps/db";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { compileTemplate } from "@/lib/compile-template";

type CodeTemplateCodeViewProps = {
  template: Template;
  orgSlug: string;
  templateId: string;
  onSourceSaved?: (updatedTemplate: Template) => void;
  onPreviewUpdate: (html: string) => void;
};

export function CodeTemplateCodeView({
  template,
  orgSlug,
  templateId,
  onSourceSaved,
  onPreviewUpdate,
}: CodeTemplateCodeViewProps) {
  const [copied, setCopied] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedSource, setEditedSource] = useState("");
  const [compileError, setCompileError] = useState<string | null>(null);

  const originalSource = template.source ?? "";
  const filePath = template.cliProjectPath ?? "template.tsx";

  const hasChanges = isEditing && editedSource !== originalSource;

  // Copy source to clipboard
  const handleCopy = async () => {
    const textToCopy = isEditing ? editedSource : originalSource;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Download source file
  const handleDownload = () => {
    const filename = filePath.split("/").pop() ?? "template.tsx";
    const textToDownload = isEditing ? editedSource : originalSource;
    const blob = new Blob([textToDownload], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  // Enter edit mode
  const handleStartEdit = () => {
    setEditedSource(originalSource);
    setIsEditing(true);
    setCompileError(null);
  };

  // Discard changes
  const handleDiscard = () => {
    setIsEditing(false);
    setEditedSource("");
    setCompileError(null);
    onPreviewUpdate(template.compiledHtml ?? "");
  };

  // Save: compile then save
  const handleSave = useCallback(async () => {
    if (!hasChanges || isSaving) {
      return;
    }

    setIsSaving(true);
    setCompileError(null);

    try {
      // Step 1: Compile in-browser (no server-side code execution)
      const compiled = await compileTemplate(editedSource);

      // Step 2: Save
      const saveResp = await fetch(
        `/api/${orgSlug}/emails/templates/${templateId}/save-source`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: editedSource,
            compiledHtml: compiled.compiledHtml,
            compiledText: compiled.compiledText,
            variables: compiled.variables,
          }),
        }
      );

      if (!saveResp.ok) {
        const data = await saveResp.json();
        throw new Error(data.error || "Save failed");
      }

      const { template: updatedTemplate } = await saveResp.json();

      // Update preview via parent
      onPreviewUpdate(compiled.compiledHtml);

      // Exit edit mode
      setIsEditing(false);
      setEditedSource("");

      toast.success("Template saved");

      // Notify parent
      onSourceSaved?.(updatedTemplate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save";
      setCompileError(message);
      toast.error("Failed to save", { description: message });
    } finally {
      setIsSaving(false);
    }
  }, [
    hasChanges,
    isSaving,
    editedSource,
    orgSlug,
    templateId,
    onSourceSaved,
    onPreviewUpdate,
  ]);

  // Cmd+S keyboard shortcut
  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, handleSave]);

  // Error state: missing source
  if (!originalSource) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h3 className="mb-2 font-semibold text-lg">
            Template source not available
          </h3>
          <p className="text-muted-foreground text-sm">
            This template&apos;s source code is missing. Re-push from your CLI
            project:
          </p>
          <code className="mt-3 inline-block rounded bg-muted px-3 py-1.5 font-mono text-sm">
            wraps email templates push --force
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span className="font-mono text-xs">{filePath}</span>
          {hasChanges && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 text-xs">
              Modified
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8"
                    disabled={!hasChanges || isSaving}
                    onClick={handleSave}
                    size="sm"
                    variant="default"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-3.5 w-3.5" />
                    )}
                    Save
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save changes (Cmd+S)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8"
                    disabled={isSaving}
                    onClick={handleDiscard}
                    size="sm"
                    variant="outline"
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Discard
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Discard changes</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-8"
                  onClick={handleStartEdit}
                  size="sm"
                  variant="outline"
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit source code</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 w-8 p-0"
                onClick={handleCopy}
                size="sm"
                variant={copied ? "secondary" : "ghost"}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {copied ? "Copied!" : "Copy to clipboard"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 w-8 p-0"
                onClick={handleDownload}
                size="sm"
                variant="ghost"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download file</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Compile Error Banner */}
      {compileError && (
        <div className="flex items-start gap-2 border-b bg-destructive/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="text-destructive text-xs">{compileError}</p>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          defaultLanguage="typescript"
          height="100%"
          language="typescript"
          onChange={(value) => {
            if (isEditing && value !== undefined) {
              setEditedSource(value);
            }
          }}
          options={{
            automaticLayout: true,
            fontSize: 13,
            fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
            lineNumbers: "on",
            minimap: { enabled: false },
            padding: { top: 16, bottom: 16 },
            readOnly: !isEditing,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            renderLineHighlight: isEditing ? "line" : "none",
            cursorStyle: isEditing ? "line" : "line-thin",
            cursorBlinking: isEditing ? "blink" : "solid",
          }}
          theme="vs-dark"
          value={isEditing ? editedSource : originalSource}
        />
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/30 px-3 py-2">
        <p className="text-muted-foreground text-xs">
          {isEditing ? (
            <>
              Editing — press{" "}
              <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
                Cmd+S
              </kbd>{" "}
              to save
            </>
          ) : (
            <>
              Click <span className="font-medium text-foreground">Edit</span> to
              modify this template
            </>
          )}
        </p>
      </div>
    </div>
  );
}
