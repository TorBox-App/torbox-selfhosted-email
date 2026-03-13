"use client";

import MonacoEditor from "@monaco-editor/react";
import type { JSONContent } from "@tiptap/core";
import type { Editor as TiptapEditor } from "@tiptap/react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileCode2,
  FileJson,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseHTMLToTipTap } from "@/lib/serializers/html-to-tiptap";
import { parseReactEmailToTipTap } from "@/lib/serializers/react-email-to-tiptap";
import {
  extractWrapperConfig,
  generateReactEmailCode,
  renderTipTapToHtml,
} from "@/lib/serializers/tiptap-to-react-email";

type CodeViewProps = {
  editor: TiptapEditor | null;
  previewText?: string;
};

type CodeFormat = "react-email" | "json" | "html";

// Get Monaco language for format
function getMonacoLanguage(format: CodeFormat): "typescript" | "json" | "html" {
  switch (format) {
    case "react-email":
      return "typescript";
    case "json":
      return "json";
    case "html":
      return "html";
  }
}

export function CodeView({ editor: tiptapEditor, previewText }: CodeViewProps) {
  const [format, setFormat] = useState<CodeFormat>("react-email");
  const [originalCode, setOriginalCode] = useState<string>("");
  const [editedCode, setEditedCode] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isGeneratingHtml, setIsGeneratingHtml] = useState(false);

  // Generate code from TipTap content (sync for React Email and JSON)
  const generateCodeSync = useCallback((): string | null => {
    if (!tiptapEditor) {
      return "";
    }

    const content = tiptapEditor.getJSON();

    switch (format) {
      case "react-email":
        // Wrapper classNames are stored in doc attrs and read by generateReactEmailCode
        return generateReactEmailCode(content, 0, {
          previewText,
        });
      case "json":
        return JSON.stringify(content, null, 2);
      case "html":
        // HTML is generated asynchronously
        return null;
    }
  }, [tiptapEditor, format, previewText]);

  // Update code when editor content or format changes (sync formats)
  useEffect(() => {
    if (format === "html") {
      return; // HTML is handled separately
    }
    const code = generateCodeSync();
    if (code !== null) {
      setOriginalCode(code);
      if (!isEditing) {
        setEditedCode(code);
      }
    }
  }, [format, generateCodeSync, isEditing]);

  // Generate HTML asynchronously using @react-email/render
  useEffect(() => {
    if (format !== "html" || !tiptapEditor || isEditing) {
      return;
    }

    let cancelled = false;
    setIsGeneratingHtml(true);

    const generateHtml = async () => {
      try {
        const content = tiptapEditor.getJSON();
        // Use keepVariablesAsPlaceholders to show {{name}} like it will appear in SES
        const html = await renderTipTapToHtml(
          content,
          {},
          {
            keepVariablesAsPlaceholders: true,
            previewText,
          }
        );
        if (!cancelled) {
          setOriginalCode(html);
          setEditedCode(html);
          setIsGeneratingHtml(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to render HTML:", err);
          setOriginalCode("<!-- Error rendering HTML -->");
          setEditedCode("<!-- Error rendering HTML -->");
          setIsGeneratingHtml(false);
        }
      }
    };

    generateHtml();

    return () => {
      cancelled = true;
    };
  }, [tiptapEditor?.state.doc, format, tiptapEditor, isEditing, previewText]);

  const hasChanges = editedCode !== originalCode;

  // Handle code changes in editor
  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditedCode(value);
      setParseError(null);
    }
  };

  // Apply changes to TipTap editor
  const applyChanges = () => {
    if (!(tiptapEditor && hasChanges)) {
      return;
    }

    setIsApplying(true);
    setParseError(null);

    try {
      // Parse content first (synchronous, may throw)
      let parsed: JSONContent;
      let wrapperConfig: {
        bodyClassName?: string;
        containerClassName?: string;
      } | null = null;

      if (format === "json") {
        parsed = JSON.parse(editedCode) as JSONContent;
      } else if (format === "html") {
        parsed = parseHTMLToTipTap(editedCode);
      } else {
        wrapperConfig = extractWrapperConfig(editedCode);
        parsed = parseReactEmailToTipTap(editedCode);
      }

      // Defer TipTap operations to avoid flushSync-inside-lifecycle errors.
      // TipTap internally uses flushSync when updating content, which conflicts
      // with React's render cycle if called during a state update.
      queueMicrotask(() => {
        tiptapEditor.commands.setContent(parsed);

        if (wrapperConfig) {
          // setContent only replaces doc children, not doc-level attrs.
          // Use ProseMirror's setDocAttribute to persist wrapper classNames.
          const { tr } = tiptapEditor.state;
          tr.setDocAttribute(
            "bodyClassName",
            wrapperConfig.bodyClassName || null
          );
          tr.setDocAttribute(
            "containerClassName",
            wrapperConfig.containerClassName || null
          );
          tiptapEditor.view.dispatch(tr);
        }

        setIsEditing(false);
        setOriginalCode(editedCode);
        setIsApplying(false);
        toast.success(
          `${format === "react-email" ? "React Email" : format === "json" ? "JSON" : "HTML"} changes applied to editor`
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid code";
      setParseError(message);
      toast.error(`Failed to apply changes: ${message}`);
      setIsApplying(false);
    }
  };

  // Discard changes
  const discardChanges = () => {
    setEditedCode(originalCode);
    setIsEditing(false);
    setParseError(null);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedCode);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Download file
  const handleDownload = () => {
    const extensions: Record<CodeFormat, string> = {
      "react-email": "tsx",
      json: "json",
      html: "html",
    };

    const filename = `email-template.${extensions[format]}`;
    const blob = new Blob([editedCode], { type: "text/plain" });
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

  if (!tiptapEditor) {
    return null;
  }

  const formatLabels: Record<CodeFormat, string> = {
    "react-email": "React Email",
    json: "JSON",
    html: "HTML",
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header Controls */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        {/* Left: Format selector and status */}
        <div className="flex items-center gap-2">
          <Select
            onValueChange={(v) => {
              if (hasChanges) {
                toast.error("Please apply or discard changes first");
                return;
              }
              setFormat(v as CodeFormat);
              setIsEditing(false);
            }}
            value={format}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="react-email">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-3.5 w-3.5" />
                  React Email
                </div>
              </SelectItem>
              <SelectItem value="html">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-3.5 w-3.5" />
                  HTML
                </div>
              </SelectItem>
              <SelectItem value="json">
                <div className="flex items-center gap-2">
                  <FileJson className="h-3.5 w-3.5" />
                  JSON
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {hasChanges && (
            <Badge className="text-xs" variant="default">
              Modified
            </Badge>
          )}
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8"
                    disabled={!hasChanges || isApplying}
                    onClick={applyChanges}
                    size="sm"
                    variant="default"
                  >
                    {isApplying ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-3.5 w-3.5" />
                    )}
                    Apply
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Apply changes to editor</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-8"
                    onClick={discardChanges}
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
                  onClick={() => setIsEditing(true)}
                  size="sm"
                  variant="outline"
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit {formatLabels[format]} code</TooltipContent>
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

      {/* Error Alert */}
      {parseError && (
        <Alert className="mx-3 mt-3" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          defaultLanguage={getMonacoLanguage(format)}
          height="100%"
          language={getMonacoLanguage(format)}
          onChange={handleCodeChange}
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
            renderLineHighlight: isEditing ? "all" : "none",
            cursorStyle: isEditing ? "line" : "line-thin",
            cursorBlinking: isEditing ? "blink" : "solid",
          }}
          theme="vs-dark"
          value={editedCode}
        />
      </div>

      {/* Footer Info */}
      <div className="border-t bg-muted/30 px-3 py-2">
        <p className="text-muted-foreground text-xs">
          {format === "react-email" &&
            "React Email JSX - edit and apply to update the visual editor"}
          {format === "json" &&
            "TipTap JSON document - edit and apply to update the visual editor"}
          {format === "html" &&
            (isGeneratingHtml
              ? "Generating production-ready HTML..."
              : "Production-ready email HTML - edit and apply to update the visual editor")}
        </p>
      </div>
    </div>
  );
}
