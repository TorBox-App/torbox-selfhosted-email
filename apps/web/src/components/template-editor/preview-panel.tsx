"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import type { Editor } from "@tiptap/react";
import { Check, Monitor, Settings, Smartphone, Tablet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { renderTipTapToHtml } from "@/lib/serializers/tiptap-to-react-email";
import { useTemplateActions, useTestData } from "@/stores/template-store";

type PreviewPanelProps = {
  editor: Editor | null;
};

type DeviceType = "desktop" | "tablet" | "mobile";

const deviceWidths: Record<DeviceType, number> = {
  desktop: 600,
  tablet: 480,
  mobile: 375,
};

export function PreviewPanel({ editor }: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [iframeHeight, setIframeHeight] = useState(600);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const testData = useTestData();
  const { setTestData } = useTemplateActions();

  // Auto-adjust iframe height based on content
  const adjustIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow?.document?.body) {
      return;
    }

    // Get the content height
    const contentHeight = iframe.contentWindow.document.body.scrollHeight;
    // Set minimum height of 400px, add padding
    const newHeight = Math.max(400, contentHeight + 40);
    setIframeHeight(newHeight);
  }, []);

  // Get current editor content as JSON string for debouncing
  const editorContentJson = useMemo(() => {
    if (!editor) {
      return "";
    }
    return JSON.stringify(editor.getJSON());
  }, [editor?.state.doc, editor]);

  // Debounce preview updates - wait 500ms after user stops typing
  const [debouncedContent] = useDebouncedValue(editorContentJson, {
    wait: 500,
  });

  // Extract variables from editor content
  const variables = useMemo(() => {
    if (!editor) {
      return [];
    }

    const vars: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "variable") {
        const name = node.attrs.name as string;
        if (name && !vars.includes(name)) {
          vars.push(name);
        }
      }
    });
    return vars;
  }, [editor?.state.doc, editor]);

  // Generate preview HTML when debounced content or test data changes
  useEffect(() => {
    if (!debouncedContent) {
      return;
    }

    let cancelled = false;

    const generateHtml = async () => {
      try {
        const content = JSON.parse(debouncedContent);
        // Use the same HTML renderer that's used for SES templates
        const html = await renderTipTapToHtml(content, testData);
        if (!cancelled) {
          setHtmlContent(html);
        }
      } catch (err) {
        console.error("Error generating preview:", err);
        if (!cancelled) {
          setHtmlContent("<p>Error generating preview</p>");
        }
      }
    };

    generateHtml();

    return () => {
      cancelled = true;
    };
  }, [debouncedContent, testData]);

  // Use ResizeObserver to adjust iframe height when content changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!(iframe && htmlContent)) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;

    const setupObserver = () => {
      const body = iframe.contentWindow?.document?.body;
      if (!body) {
        return;
      }

      // Initial height adjustment
      adjustIframeHeight();

      // Observe body size changes
      resizeObserver = new ResizeObserver(() => {
        adjustIframeHeight();
      });
      resizeObserver.observe(body);
    };

    // Wait for iframe to load before setting up observer
    const handleLoad = () => setupObserver();
    iframe.addEventListener("load", handleLoad);

    // Also try immediately in case content is already loaded
    setupObserver();

    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserver?.disconnect();
    };
  }, [htmlContent, adjustIframeHeight]);

  const handleTestDataChange = (key: string, value: string) => {
    setTestData({ ...testData, [key]: value });
  };

  // Device labels for display
  const deviceLabels: Record<DeviceType, string> = {
    desktop: "Desktop",
    tablet: "Tablet",
    mobile: "Mobile",
  };

  const deviceIcons: Record<DeviceType, React.ReactNode> = {
    desktop: <Monitor className="h-4 w-4" />,
    tablet: <Tablet className="h-4 w-4" />,
    mobile: <Smartphone className="h-4 w-4" />,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Preview Controls - Compact Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        {/* Left: Current device indicator */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {deviceIcons[device]}
          <span className="hidden sm:inline">{deviceWidths[device]}px</span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1">
          {/* Device Toggle - Compact */}
          <ToggleGroup
            className="hidden sm:flex"
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

          {/* Settings Dropdown - Device selection for mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Device selection for mobile */}
              <DropdownMenuLabel className="sm:hidden">
                Device
              </DropdownMenuLabel>
              <div className="sm:hidden">
                {(["desktop", "tablet", "mobile"] as DeviceType[]).map((d) => (
                  <DropdownMenuItem key={d} onClick={() => setDevice(d)}>
                    <span className="flex items-center gap-2">
                      {deviceIcons[d]}
                      {deviceLabels[d]}
                    </span>
                    {device === d && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Test Data Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button className="h-8 gap-1.5 px-2" size="sm" variant="outline">
                <span className="text-xs">Test Data</span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Test Data</SheetTitle>
                <SheetDescription>
                  Set values for variables to preview how your email will look
                  with real data.
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="mt-4 h-[calc(100vh-180px)]">
                <div className="space-y-4 pr-4">
                  {variables.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No variables found in your template. Add variables using
                      the Variable block.
                    </p>
                  ) : (
                    variables.map((variable) => (
                      <div className="space-y-2" key={variable}>
                        <Label htmlFor={variable}>{`{{${variable}}}`}</Label>
                        <Input
                          id={variable}
                          onChange={(e) =>
                            handleTestDataChange(variable, e.target.value)
                          }
                          placeholder={`Enter test value for ${variable}`}
                          value={(testData[variable] as string) || ""}
                        />
                      </div>
                    ))
                  )}

                  {/* Common test data suggestions */}
                  <div className="border-t pt-4">
                    <p className="mb-2 font-medium text-sm">Quick Fill</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          setTestData({
                            ...testData,
                            firstName: "John",
                            lastName: "Doe",
                            email: "john@example.com",
                            company: "Acme Inc",
                          })
                        }
                        size="sm"
                        variant="outline"
                      >
                        Sample User
                      </Button>
                      <Button
                        onClick={() =>
                          setTestData({
                            ...testData,
                            orderNumber: "ORD-12345",
                            orderTotal: "$99.00",
                            orderDate: new Date().toLocaleDateString(),
                          })
                        }
                        size="sm"
                        variant="outline"
                      >
                        Sample Order
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex-1 overflow-auto bg-muted/50">
        <div className="flex min-h-full flex-col items-center py-6">
          {/* Email container with device-specific styling */}
          <div
            className="rounded-lg bg-card shadow-2xl ring-1 ring-gray-200"
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
              srcDoc={htmlContent}
              style={{
                height: iframeHeight,
                minHeight: "400px",
              }}
              title="Email Preview"
            />
          </div>

          {/* Device indicator */}
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
  );
}
