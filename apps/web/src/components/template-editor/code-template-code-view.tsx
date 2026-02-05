"use client";

import MonacoEditor from "@monaco-editor/react";
import type { Template } from "@wraps/db";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Lock,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type CodeTemplateCodeViewProps = {
  template: Template;
};

type DeviceType = "desktop" | "tablet" | "mobile";

const deviceWidths: Record<DeviceType, number> = {
  desktop: 600,
  tablet: 480,
  mobile: 375,
};

export function CodeTemplateCodeView({ template }: CodeTemplateCodeViewProps) {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [copied, setCopied] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(600);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const source = template.source ?? "";
  const compiledHtml = template.compiledHtml ?? "";
  const filePath = template.cliProjectPath ?? "template.tsx";

  // Auto-adjust iframe height based on content
  const adjustIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow?.document?.body) {
      return;
    }
    const contentHeight = iframe.contentWindow.document.body.scrollHeight;
    const newHeight = Math.max(400, contentHeight + 40);
    setIframeHeight(newHeight);
  }, []);

  // Use ResizeObserver to adjust iframe height when content changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!(iframe && compiledHtml)) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;

    const setupObserver = () => {
      const body = iframe.contentWindow?.document?.body;
      if (!body) {
        return;
      }
      adjustIframeHeight();
      resizeObserver = new ResizeObserver(() => {
        adjustIframeHeight();
      });
      resizeObserver.observe(body);
    };

    const handleLoad = () => setupObserver();
    iframe.addEventListener("load", handleLoad);
    setupObserver();

    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserver?.disconnect();
    };
  }, [compiledHtml, adjustIframeHeight]);

  // Copy source to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
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
    const blob = new Blob([source], { type: "text/plain" });
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

  // Error state: missing source or compiled HTML
  if (!source || !compiledHtml) {
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
    <ResizablePanelGroup direction="horizontal">
      {/* Left: Monaco Editor */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex h-full flex-col">
          {/* Editor Header */}
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Lock className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">{filePath}</span>
            </div>
            <div className="flex items-center gap-1">
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

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              defaultLanguage="typescript"
              height="100%"
              language="typescript"
              options={{
                automaticLayout: true,
                fontSize: 13,
                fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
                lineNumbers: "on",
                minimap: { enabled: false },
                padding: { top: 16, bottom: 16 },
                readOnly: true,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                renderLineHighlight: "none",
                cursorStyle: "line-thin",
                cursorBlinking: "solid",
              }}
              theme="vs-dark"
              value={source}
            />
          </div>

          {/* Footer */}
          <div className="border-t bg-muted/30 px-3 py-2">
            <p className="text-muted-foreground text-xs">
              Read-only — edit this file in your project and run{" "}
              <code className="rounded bg-muted px-1 font-mono">
                wraps email templates push
              </code>
            </p>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right: Preview */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex h-full flex-col">
          {/* Preview Header */}
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline">{deviceWidths[device]}px</span>
            </div>

            <ToggleGroup
              onValueChange={(value) => value && setDevice(value as DeviceType)}
              size="sm"
              type="single"
              value={device}
              variant="outline"
            >
              <ToggleGroupItem
                aria-label="Desktop"
                className="h-8 w-8 p-0"
                value="desktop"
              >
                <Monitor className="h-3.5 w-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem
                aria-label="Tablet"
                className="h-8 w-8 p-0"
                value="tablet"
              >
                <Tablet className="h-3.5 w-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem
                aria-label="Mobile"
                className="h-8 w-8 p-0"
                value="mobile"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Preview Frame */}
          <div className="flex-1 overflow-auto bg-muted/50">
            <div className="flex min-h-full flex-col items-center py-6">
              <div
                className="rounded-lg bg-white shadow-2xl ring-1 ring-gray-200"
                style={{
                  width: deviceWidths[device],
                  maxWidth: "100%",
                }}
              >
                <iframe
                  className="w-full border-0 transition-[height] duration-200"
                  onLoad={adjustIframeHeight}
                  ref={iframeRef}
                  sandbox="allow-same-origin"
                  srcDoc={compiledHtml}
                  style={{
                    height: iframeHeight,
                    minHeight: "400px",
                  }}
                  title="Email Preview"
                />
              </div>

              <div className="mt-4 text-center">
                <span className="text-muted-foreground text-xs">
                  {device === "desktop" && "Desktop (600px)"}
                  {device === "tablet" && "Tablet (480px)"}
                  {device === "mobile" && "Mobile (375px)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
