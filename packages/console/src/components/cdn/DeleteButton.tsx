import { Button } from "@wraps/ui/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type DeleteButtonProps = {
  onDelete: () => void | Promise<void>;
  className?: string;
  size?: "default" | "sm" | "icon";
  label?: string;
};

export function DeleteButton({
  onDelete,
  className,
  size = "icon",
  label,
}: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);

    try {
      // Run operation with minimum spinner time to avoid flicker
      await Promise.all([
        onDelete(),
        new Promise((resolve) => setTimeout(resolve, 150)),
      ]);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      className={className}
      disabled={isDeleting}
      onClick={handleDelete}
      size={size}
      variant="ghost-destructive"
    >
      {isDeleting ? (
        <Loader2
          className={cn("animate-spin", label ? "mr-1.5 h-4 w-4" : "h-4 w-4")}
        />
      ) : (
        <Trash2 className={cn(label ? "mr-1.5 h-4 w-4" : "h-4 w-4")} />
      )}
      {label}
    </Button>
  );
}
