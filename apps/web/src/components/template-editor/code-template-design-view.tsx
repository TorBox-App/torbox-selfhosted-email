"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodeTemplateAIPanel } from "./code-template-ai-panel";

type DeviceType = "desktop" | "tablet" | "mobile";

const deviceWidths: Record<DeviceType, number> = {
  desktop: 600,
  tablet: 480,
  mobile: 375,
};

type CodeTemplateDesignViewProps = {
  orgSlug: string;
  templateId: string;
  currentSource: string;
  compiledHtml: string;
  onApply: (source: string, compiledHtml: string) => void;
};

export function CodeTemplateDesignView({
  orgSlug,
  templateId,
  currentSource,
  compiledHtml,
  onApply,
}: CodeTemplateDesignViewProps) {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [iframeHeight, setIframeHeight] = useState(600);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const adjustIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow?.document?.body) return;
    const contentHeight = iframe.contentWindow.document.body.scrollHeight;
    setIframeHeight(Math.max(contentHeight + 32, 400));
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!(iframe && compiledHtml)) return;

    let resizeObserver: ResizeObserver | undefined;

    const handleLoad = () => {
      adjustIframeHeight();
      const body = iframe.contentWindow?.document?.body;
      if (body) {
        resizeObserver = new ResizeObserver(() => adjustIframeHeight());
        resizeObserver.observe(body);
      }
    };

    iframe.addEventListener("load", handleLoad);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserver?.disconnect();
    };
  }, [compiledHtml, adjustIframeHeight]);

  return (
    <ResizablePanelGroup direction="horizontal">
      {/* AI Chat Panel */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <CodeTemplateAIPanel
          currentSource={currentSource}
          onApply={onApply}
          orgSlug={orgSlug}
          templateId={templateId}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Preview Panel */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex h-full flex-col">
          {/* Preview Header */}
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
            <span className="text-muted-foreground text-xs font-medium">
              Preview
            </span>
            <TooltipProvider>
              <ToggleGroup
                onValueChange={(value) => {
                  if (value) setDevice(value as DeviceType);
                }}
                size="sm"
                type="single"
                value={device}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      className="h-6 w-6 p-0"
                      value="desktop"
                    >
                      <Monitor className="h-3 w-3" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Desktop (600px)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      className="h-6 w-6 p-0"
                      value="tablet"
                    >
                      <Tablet className="h-3 w-3" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Tablet (480px)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      className="h-6 w-6 p-0"
                      value="mobile"
                    >
                      <Smartphone className="h-3 w-3" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Mobile (375px)</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            </TooltipProvider>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-auto bg-muted/20 p-4">
            <div
              className="mx-auto transition-all duration-300"
              style={{ maxWidth: deviceWidths[device] }}
            >
              {compiledHtml ? (
                <iframe
                  className="w-full rounded-md border bg-white shadow-sm"
                  ref={iframeRef}
                  sandbox="allow-same-origin"
                  srcDoc={compiledHtml}
                  style={{
                    height: iframeHeight,
                    minHeight: 400,
                  }}
                  title="Email preview"
                />
              ) : (
                <div className="flex h-[400px] items-center justify-center rounded-md border bg-white text-muted-foreground text-sm">
                  No preview available — use the AI assistant to generate a
                  template
                </div>
              )}
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
