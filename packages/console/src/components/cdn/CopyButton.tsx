import { Check, Copy, Loader2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  label?: string;
};

export function CopyButton({
  value,
  className,
  variant = "outline",
  size = "icon",
  label,
}: CopyButtonProps) {
  const [state, setState] = React.useState<"idle" | "copying" | "copied">(
    "idle"
  );

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setState("copying");

    try {
      // Run copy with minimum spinner time to avoid flicker
      await Promise.all([
        navigator.clipboard.writeText(value),
        new Promise((resolve) => setTimeout(resolve, 150)),
      ]);
      setState("copied");
      toast.success("Copied to clipboard");

      // Reset after 2 seconds
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Button
      className={cn(
        "transition-all",
        state === "copied" && "text-green-500",
        className
      )}
      disabled={state === "copying"}
      onClick={handleCopy}
      size={size}
      variant={variant}
    >
      {state === "copying" ? (
        <Loader2
          className={cn("animate-spin", label ? "mr-2 h-4 w-4" : "h-4 w-4")}
        />
      ) : state === "copied" ? (
        <Check className={cn(label ? "mr-2 h-4 w-4" : "h-4 w-4")} />
      ) : (
        <Copy className={cn(label ? "mr-2 h-4 w-4" : "h-4 w-4")} />
      )}
      {label}
    </Button>
  );
}
