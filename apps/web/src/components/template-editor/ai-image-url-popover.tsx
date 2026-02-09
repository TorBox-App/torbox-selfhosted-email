"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ImageAttachment = {
  url: string;
  filename: string;
  contentType: string;
};

type AIImageUrlPopoverProps = {
  orgSlug: string;
  onAttach: (attachment: ImageAttachment) => void;
  disabled?: boolean;
};

export function AIImageUrlPopover({
  orgSlug,
  onAttach,
  disabled,
}: AIImageUrlPopoverProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAttach = async () => {
    if (!url.trim()) {
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/${orgSlug}/emails/templates/ai/validate-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        }
      );

      const data = await response.json();

      if (!data.valid) {
        setError(data.error || "Invalid image URL");
        return;
      }

      onAttach({
        url: url.trim(),
        filename: data.filename,
        contentType: data.contentType,
      });

      setUrl("");
      setError(null);
      setOpen(false);
    } catch {
      setError("Failed to validate image URL");
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAttach();
    }
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-7 w-7"
          disabled={disabled}
          size="icon"
          title="Attach image URL"
          type="button"
          variant="ghost"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" side="top">
        <div className="space-y-2">
          <p className="font-medium text-sm">Attach image reference</p>
          <p className="text-muted-foreground text-xs">
            Paste a URL to a screenshot or mockup to use as a visual reference.
          </p>
          <Input
            disabled={isValidating}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/screenshot.png"
            value={url}
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end">
            <Button
              disabled={!url.trim() || isValidating}
              onClick={handleAttach}
              size="sm"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Validating...
                </>
              ) : (
                "Attach"
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
