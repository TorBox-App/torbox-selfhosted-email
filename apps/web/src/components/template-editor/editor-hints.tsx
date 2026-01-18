"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Storage key for dismissed hints
const DISMISSED_HINTS_KEY = "wraps:editor:dismissed-hints";

export type HintId =
  | "drag-blocks"
  | "click-to-edit"
  | "use-variables"
  | "ai-assistant"
  | "keyboard-shortcuts";

type HintConfig = {
  id: HintId;
  title: string;
  message: string;
  position?: "top" | "bottom" | "left" | "right";
};

const HINT_CONFIGS: Record<HintId, Omit<HintConfig, "id">> = {
  "drag-blocks": {
    title: "Drag & Drop",
    message: "Drag blocks from the sidebar to add them to your email",
    position: "right",
  },
  "click-to-edit": {
    title: "Click to Edit",
    message: "Click on any text to start editing. Select text to format it.",
    position: "top",
  },
  "use-variables": {
    title: "Personalize",
    message: "Type {{ to insert dynamic variables like names and dates",
    position: "bottom",
  },
  "ai-assistant": {
    title: "AI Assistant",
    message: "Click the sparkle icon to generate emails with AI",
    position: "right",
  },
  "keyboard-shortcuts": {
    title: "Keyboard Shortcuts",
    message: "Press ⌘/ to see all available shortcuts",
    position: "top",
  },
};

/**
 * Hook to manage editor hints
 */
export function useEditorHints() {
  const [dismissedHints, setDismissedHints] = useState<Set<HintId>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load dismissed hints from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_HINTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as HintId[];
        setDismissedHints(new Set(parsed));
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  // Save dismissed hints to localStorage
  const dismissHint = useCallback((id: HintId) => {
    setDismissedHints((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(DISMISSED_HINTS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Dismiss all hints
  const dismissAllHints = useCallback(() => {
    const allIds = Object.keys(HINT_CONFIGS) as HintId[];
    setDismissedHints(new Set(allIds));
    localStorage.setItem(DISMISSED_HINTS_KEY, JSON.stringify(allIds));
  }, []);

  // Reset all hints (for testing)
  const resetHints = useCallback(() => {
    setDismissedHints(new Set());
    localStorage.removeItem(DISMISSED_HINTS_KEY);
  }, []);

  // Check if a hint should be shown
  const shouldShowHint = useCallback(
    (id: HintId) => isLoaded && !dismissedHints.has(id),
    [dismissedHints, isLoaded]
  );

  return {
    dismissHint,
    dismissAllHints,
    resetHints,
    shouldShowHint,
    isLoaded,
  };
}

type EditorHintProps = {
  id: HintId;
  onDismiss: (id: HintId) => void;
  className?: string;
  children?: React.ReactNode;
};

/**
 * A contextual hint tooltip that appears once for first-time users
 */
export function EditorHint({
  id,
  onDismiss,
  className,
  children,
}: EditorHintProps) {
  const config = HINT_CONFIGS[id];
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    // Wait for animation to complete before fully dismissing
    setTimeout(() => onDismiss(id), 200);
  };

  if (!isVisible) {
    return children;
  }

  return (
    <div className={cn("relative", className)}>
      {children}
      <div
        className={cn(
          "absolute z-50 w-64 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
          "rounded-lg border bg-popover p-3 shadow-lg",
          config.position === "top" &&
            "bottom-full left-1/2 mb-2 -translate-x-1/2",
          config.position === "bottom" &&
            "top-full left-1/2 mt-2 -translate-x-1/2",
          config.position === "left" &&
            "right-full top-1/2 mr-2 -translate-y-1/2",
          config.position === "right" &&
            "left-full top-1/2 ml-2 -translate-y-1/2"
        )}
      >
        {/* Arrow */}
        <div
          className={cn(
            "absolute h-2 w-2 rotate-45 border bg-popover",
            config.position === "top" &&
              "bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r",
            config.position === "bottom" &&
              "top-[-5px] left-1/2 -translate-x-1/2 border-l border-t",
            config.position === "left" &&
              "right-[-5px] top-1/2 -translate-y-1/2 border-r border-t",
            config.position === "right" &&
              "left-[-5px] top-1/2 -translate-y-1/2 border-b border-l"
          )}
        />

        {/* Content */}
        <div className="relative">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-sm">{config.title}</span>
            <Button
              className="h-5 w-5 shrink-0 p-0"
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">{config.message}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * A floating hint that can be positioned anywhere
 */
export function FloatingHint({
  id,
  show,
  onDismiss,
  position = { top: 0, left: 0 },
}: {
  id: HintId;
  show: boolean;
  onDismiss: (id: HintId) => void;
  position: { top: number | string; left: number | string };
}) {
  const config = HINT_CONFIGS[id];

  if (!show) return null;

  return (
    <div
      className="fixed z-50 w-64 animate-in fade-in-0 zoom-in-95 rounded-lg border bg-popover p-3 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-sm">{config.title}</span>
        <Button
          className="h-5 w-5 shrink-0 p-0"
          onClick={() => onDismiss(id)}
          size="sm"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{config.message}</p>
    </div>
  );
}
