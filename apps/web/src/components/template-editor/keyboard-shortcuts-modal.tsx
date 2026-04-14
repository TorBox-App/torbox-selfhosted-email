"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@wraps/ui/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";

type ShortcutItem = {
  keys: string[];
  description: string;
};

type ShortcutCategory = {
  name: string;
  shortcuts: ShortcutItem[];
};

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    name: "General",
    shortcuts: [
      { keys: ["⌘", "S"], description: "Save template" },
      { keys: ["⌘", "Z"], description: "Undo" },
      { keys: ["⌘", "⇧", "Z"], description: "Redo" },
      { keys: ["⌘", "/"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    name: "Text Formatting",
    shortcuts: [
      { keys: ["⌘", "B"], description: "Bold" },
      { keys: ["⌘", "I"], description: "Italic" },
      { keys: ["⌘", "U"], description: "Underline" },
      { keys: ["⌘", "⇧", "X"], description: "Strikethrough" },
      { keys: ["⌘", "K"], description: "Insert link" },
    ],
  },
  {
    name: "Blocks",
    shortcuts: [
      { keys: ["/"], description: "Open slash commands" },
      { keys: ["{{"], description: "Insert variable" },
      { keys: ["Enter"], description: "New paragraph" },
      { keys: ["⌘", "Enter"], description: "Exit current block" },
    ],
  },
  {
    name: "Navigation",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Move between blocks" },
      { keys: ["Tab"], description: "Indent list item" },
      { keys: ["⇧", "Tab"], description: "Outdent list item" },
      { keys: ["Esc"], description: "Deselect / Close panel" },
    ],
  },
];

type KeyboardShortcutsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Quick actions to speed up your workflow
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.name}>
              <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {category.name}
              </h4>
              <div className="space-y-1.5">
                {category.shortcuts.map((shortcut) => (
                  <div
                    className="flex items-center justify-between py-1"
                    key={shortcut.description}
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <kbd
                          className="inline-flex h-6 min-w-6 items-center justify-center rounded border bg-muted px-1.5 font-mono text-xs"
                          key={`${key}-${index}`}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t pt-4">
          <p className="text-center text-muted-foreground text-xs">
            Press{" "}
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-xs">
              ⌘
            </kbd>{" "}
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-xs">
              /
            </kbd>{" "}
            anytime to open this panel
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage keyboard shortcuts modal with Cmd+/ trigger
 */
export function useKeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+/ or Cmd+? to open shortcuts
      if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    setIsOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
