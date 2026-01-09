import { Loader2, Star } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StarButtonProps = {
  starred?: boolean;
  onToggle: () => void | Promise<void>;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  label?: string;
};

export function StarButton({
  starred,
  onToggle,
  className,
  variant = "ghost",
  size = "icon",
  label,
}: StarButtonProps) {
  const [isToggling, setIsToggling] = React.useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsToggling(true);

    try {
      // Run operation with minimum spinner time to avoid flicker
      await Promise.all([
        onToggle(),
        new Promise((resolve) => setTimeout(resolve, 150)),
      ]);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Button
      className={cn("transition-all", className)}
      disabled={isToggling}
      onClick={handleToggle}
      size={size}
      variant={variant}
    >
      {isToggling ? (
        <Loader2
          className={cn("animate-spin", label ? "mr-1.5 h-4 w-4" : "h-4 w-4")}
        />
      ) : (
        <Star
          className={cn(
            "transition-colors",
            label ? "mr-1.5 h-4 w-4" : "h-4 w-4",
            starred
              ? "fill-yellow-500 text-yellow-500"
              : "text-muted-foreground"
          )}
        />
      )}
      {label}
      {!label && <span className="sr-only">{starred ? "Unstar" : "Star"}</span>}
    </Button>
  );
}
