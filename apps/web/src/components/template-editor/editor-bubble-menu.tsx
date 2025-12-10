"use client";

import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Check,
  ChevronDown,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  Palette,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type EditorBubbleMenuProps = {
  editor: Editor;
};

// Common text colors for emails
const TEXT_COLORS = [
  { name: "Default", color: null },
  { name: "Black", color: "#000000" },
  { name: "Dark Gray", color: "#374151" },
  { name: "Gray", color: "#6b7280" },
  { name: "Red", color: "#dc2626" },
  { name: "Orange", color: "#ea580c" },
  { name: "Yellow", color: "#ca8a04" },
  { name: "Green", color: "#16a34a" },
  { name: "Blue", color: "#2563eb" },
  { name: "Purple", color: "#9333ea" },
  { name: "Pink", color: "#db2777" },
];

// Common highlight/background colors
const HIGHLIGHT_COLORS = [
  { name: "None", color: null },
  { name: "Yellow", color: "#fef08a" },
  { name: "Green", color: "#bbf7d0" },
  { name: "Blue", color: "#bfdbfe" },
  { name: "Purple", color: "#e9d5ff" },
  { name: "Pink", color: "#fbcfe8" },
  { name: "Red", color: "#fecaca" },
  { name: "Orange", color: "#fed7aa" },
  { name: "Gray", color: "#e5e7eb" },
];

// Font sizes
const FONT_SIZES = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "14px" },
  { label: "Medium", value: "16px" },
  { label: "Large", value: "18px" },
  { label: "XL", value: "20px" },
  { label: "2XL", value: "24px" },
  { label: "3XL", value: "30px" },
];

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  // Set up the bubble menu plugin
  useEffect(() => {
    if (!(editor && menuRef.current)) return;

    const plugin = BubbleMenuPlugin({
      pluginKey: "bubbleMenu",
      editor,
      element: menuRef.current,
      updateDelay: 100,
      shouldShow: ({ editor: ed, state }) => {
        // Don't show for empty selections
        const { from, to, empty } = state.selection;
        if (empty) {
          setIsVisible(false);
          return false;
        }

        // Don't show if selection includes nodes (images, buttons, etc.)
        const hasNodeSelection = ed.state.doc.nodesBetween(from, to, (node) => {
          if (node.isBlock && node.type.name !== "paragraph") {
            return false;
          }
          return true;
        });

        // Only show for text selections (not node selections like images)
        const isTextSelection =
          !(state.selection instanceof NodeSelection) &&
          ed.state.doc.textBetween(from, to).length > 0;

        setIsVisible(isTextSelection);
        return isTextSelection;
      },
    });

    editor.registerPlugin(plugin);

    return () => {
      editor.unregisterPlugin("bubbleMenu");
    };
  }, [editor]);

  const isLinkActive = editor.isActive("link");

  const handleSetLink = useCallback(() => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
    }
    setLinkUrl("");
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const handleRemoveLink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
    setLinkPopoverOpen(false);
  }, [editor]);

  const handleOpenLinkPopover = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href as string;
    setLinkUrl(previousUrl || "");
    setLinkPopoverOpen(true);
  }, [editor]);

  const clearFormatting = useCallback(() => {
    editor.chain().focus().unsetAllMarks().run();
  }, [editor]);

  // Get current font size from editor
  const currentFontSize = editor.getAttributes("textStyle").fontSize as
    | string
    | undefined;
  const currentFontSizeLabel =
    FONT_SIZES.find((s) => s.value === currentFontSize)?.label || "Size";

  // Get current text color
  const currentColor = editor.getAttributes("textStyle").color as
    | string
    | undefined;

  // Get current highlight color
  const currentHighlight = editor.getAttributes("highlight").color as
    | string
    | undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-lg",
        !isVisible && "invisible"
      )}
      ref={menuRef}
      style={{ position: "absolute" }}
    >
      <TooltipProvider delayDuration={300}>
        {/* Bold */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 w-8 p-0"
              onClick={() => editor.chain().focus().toggleBold().run()}
              size="sm"
              variant={editor.isActive("bold") ? "secondary" : "ghost"}
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Bold</TooltipContent>
        </Tooltip>

        {/* Italic */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 w-8 p-0"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              size="sm"
              variant={editor.isActive("italic") ? "secondary" : "ghost"}
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Italic</TooltipContent>
        </Tooltip>

        {/* Underline */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 w-8 p-0"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              size="sm"
              variant={editor.isActive("underline") ? "secondary" : "ghost"}
            >
              <Underline className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Underline</TooltipContent>
        </Tooltip>

        {/* Strikethrough */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 w-8 p-0"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              size="sm"
              variant={editor.isActive("strike") ? "secondary" : "ghost"}
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Strikethrough</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Link */}
        <Popover onOpenChange={setLinkPopoverOpen} open={linkPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  className="h-8 w-8 p-0"
                  onClick={handleOpenLinkPopover}
                  size="sm"
                  variant={isLinkActive ? "secondary" : "ghost"}
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Link</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-72" side="bottom">
            <div className="space-y-3">
              <div className="font-medium text-sm">
                {isLinkActive ? "Edit Link" : "Add Link"}
              </div>
              <Input
                autoFocus
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSetLink();
                  }
                }}
                placeholder="https://example.com"
                value={linkUrl}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!linkUrl}
                  onClick={handleSetLink}
                  size="sm"
                >
                  {isLinkActive ? "Update" : "Add"}
                </Button>
                {isLinkActive && (
                  <Button
                    onClick={handleRemoveLink}
                    size="sm"
                    variant="outline"
                  >
                    <Link2Off className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Text Color */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  className="h-8 gap-0.5 px-1.5"
                  size="sm"
                  variant="ghost"
                >
                  <Palette className="h-4 w-4" />
                  <div
                    className="h-2 w-4 rounded-sm border"
                    style={{ backgroundColor: currentColor || "currentColor" }}
                  />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Text Color</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-48" side="bottom">
            <div className="space-y-2">
              <div className="font-medium text-sm">Text Color</div>
              <div className="grid grid-cols-6 gap-1">
                {TEXT_COLORS.map((item) => (
                  <button
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded border transition-all hover:scale-110",
                      currentColor === item.color &&
                        "ring-2 ring-primary ring-offset-1"
                    )}
                    key={item.name}
                    onClick={() => {
                      if (item.color) {
                        editor.chain().focus().setColor(item.color).run();
                      } else {
                        editor.chain().focus().unsetColor().run();
                      }
                    }}
                    style={{ backgroundColor: item.color || "transparent" }}
                    title={item.name}
                    type="button"
                  >
                    {!item.color && (
                      <RemoveFormatting className="h-3 w-3 text-muted-foreground" />
                    )}
                    {currentColor === item.color && item.color && (
                      <Check className="h-3 w-3 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight/Background Color */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  className="h-8 gap-0.5 px-1.5"
                  size="sm"
                  variant="ghost"
                >
                  <Highlighter className="h-4 w-4" />
                  <div
                    className="h-2 w-4 rounded-sm border"
                    style={{
                      backgroundColor: currentHighlight || "transparent",
                    }}
                  />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Highlight</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-48" side="bottom">
            <div className="space-y-2">
              <div className="font-medium text-sm">Highlight</div>
              <div className="grid grid-cols-5 gap-1">
                {HIGHLIGHT_COLORS.map((item) => (
                  <button
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded border transition-all hover:scale-110",
                      currentHighlight === item.color &&
                        "ring-2 ring-primary ring-offset-1"
                    )}
                    key={item.name}
                    onClick={() => {
                      if (item.color) {
                        editor
                          .chain()
                          .focus()
                          .toggleHighlight({ color: item.color })
                          .run();
                      } else {
                        editor.chain().focus().unsetHighlight().run();
                      }
                    }}
                    style={{ backgroundColor: item.color || "transparent" }}
                    title={item.name}
                    type="button"
                  >
                    {!item.color && (
                      <RemoveFormatting className="h-3 w-3 text-muted-foreground" />
                    )}
                    {currentHighlight === item.color && item.color && (
                      <Check className="h-3 w-3" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Font Size */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button className="h-8 gap-0.5 px-2" size="sm" variant="ghost">
                  <span className="text-xs">{currentFontSizeLabel}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Font Size</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-32 p-1" side="bottom">
            <div className="flex flex-col">
              {FONT_SIZES.map((size) => (
                <button
                  className={cn(
                    "flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                    currentFontSize === size.value && "bg-muted"
                  )}
                  key={size.value}
                  onClick={() =>
                    editor.chain().focus().setFontSize(size.value).run()
                  }
                  type="button"
                >
                  <span>{size.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {size.value}
                  </span>
                </button>
              ))}
              {currentFontSize && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <button
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => editor.chain().focus().unsetFontSize().run()}
                    type="button"
                  >
                    <RemoveFormatting className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Clear Formatting */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 w-8 p-0"
              onClick={clearFormatting}
              size="sm"
              variant="ghost"
            >
              <RemoveFormatting className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Clear Formatting</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
