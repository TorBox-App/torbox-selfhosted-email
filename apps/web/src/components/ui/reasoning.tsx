"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { Brain, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type ReasoningContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isStreaming: boolean;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoningContext() {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within <Reasoning>");
  }
  return context;
}

type ReasoningProps = {
  children: ReactNode;
  className?: string;
  isStreaming?: boolean;
  defaultOpen?: boolean;
};

function Reasoning({
  children,
  className,
  isStreaming = false,
  defaultOpen = false,
}: ReasoningProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Auto-open when streaming starts
  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    }
  }, [isStreaming]);

  return (
    <ReasoningContext.Provider value={{ isOpen, setIsOpen, isStreaming }}>
      <CollapsiblePrimitive.Root
        className={cn("w-full", className)}
        onOpenChange={setIsOpen}
        open={isOpen}
      >
        {children}
      </CollapsiblePrimitive.Root>
    </ReasoningContext.Provider>
  );
}

function ReasoningTrigger({ className }: { className?: string }) {
  const { isOpen, isStreaming } = useReasoningContext();

  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        isOpen && "bg-muted/30",
        className
      )}
    >
      <Brain
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isStreaming && "animate-pulse text-primary"
        )}
      />
      <span className="flex-1 text-left font-medium">
        {isStreaming ? "Thinking..." : "View reasoning"}
      </span>
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </motion.div>
    </CollapsiblePrimitive.Trigger>
  );
}

function ReasoningContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isOpen, isStreaming } = useReasoningContext();

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <CollapsiblePrimitive.Content asChild forceMount>
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div
              className={cn(
                "mt-1.5 max-h-48 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-2.5 text-muted-foreground text-xs leading-relaxed",
                isStreaming && "border-primary/20",
                className
              )}
            >
              <div className="whitespace-pre-wrap">{children}</div>
              {isStreaming && (
                <span className="inline-block h-3 w-0.5 animate-pulse bg-primary" />
              )}
            </div>
          </motion.div>
        </CollapsiblePrimitive.Content>
      )}
    </AnimatePresence>
  );
}

export { Reasoning, ReasoningTrigger, ReasoningContent };
