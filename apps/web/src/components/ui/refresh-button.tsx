"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type RefreshButtonProps = {
  onRefresh: () => void | Promise<void>;
  className?: string;
};

export function RefreshButton({ onRefresh, className }: RefreshButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await onRefresh();
    });
  }

  return (
    <Button
      aria-label="Refresh"
      className={className}
      disabled={isPending}
      onClick={handleClick}
      size="sm"
      variant="outline"
    >
      <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
    </Button>
  );
}
