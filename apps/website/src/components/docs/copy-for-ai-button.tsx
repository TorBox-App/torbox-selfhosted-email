"use client";

import { Check, ChevronDown, ChevronUp, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CopyForAIButtonProps = {
  markdown: string;
  slashCommand: string;
};

export function CopyForAIButton({
  markdown,
  slashCommand,
}: CopyForAIButtonProps) {
  const [copied, setCopied] = useState<"markdown" | "slash" | null>(null);
  const [open, setOpen] = useState(false);

  const handleCopy = async (type: "markdown" | "slash") => {
    const content = type === "markdown" ? markdown : slashCommand;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(type);
      // Close menu after showing the copied state
      setTimeout(() => {
        setOpen(false);
      }, 450);
      setTimeout(() => {
        setCopied(null);
      }, 550);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" size="sm" variant="outline">
          <Copy className="h-4 w-4" />
          <span className="hidden sm:inline">Copy page</span>
          {open ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem
          className="flex items-start gap-3 p-3"
          onClick={() => handleCopy("markdown")}
          onSelect={(e) => e.preventDefault()}
        >
          <div className="mt-0.5 rounded-md border bg-background p-1.5">
            {copied === "markdown" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Copy page</span>
            <span className="text-muted-foreground text-xs">
              Copy page as Markdown for LLMs
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-start gap-3 p-3"
          onClick={() => handleCopy("slash")}
          onSelect={(e) => e.preventDefault()}
        >
          <div className="mt-0.5 rounded-md border bg-background p-1.5">
            {copied === "slash" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Terminal className="h-4 w-4" />
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Copy as Skill</span>
            <span className="text-muted-foreground text-xs">
              Copy as Claude Code slash command
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
