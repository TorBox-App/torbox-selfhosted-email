"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@wraps/ui/components/ui/popover";
import { Globe, Loader2, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ImageAttachment = {
  url?: string;
  base64?: string;
  filename: string;
  contentType: string;
};

type AIImagePopoverProps = {
  orgSlug: string;
  onAttach: (attachment: ImageAttachment) => void;
  disabled?: boolean;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

type Tab = "file" | "url";

export function AIImageUrlPopover({
  orgSlug,
  onAttach,
  disabled,
}: AIImagePopoverProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("file");
  const [url, setUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setUrl("");
    setError(null);
    setIsValidating(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Use PNG, JPEG, GIF, or WebP images.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        `Image too large (${Math.round(file.size / 1024 / 1024)}MB). Max 10MB.`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip "data:image/png;base64," prefix to get raw base64
      const base64 = dataUrl.split(",")[1];

      onAttach({
        base64,
        filename: file.name,
        contentType: file.type,
      });

      reset();
      setOpen(false);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleUrlAttach = async () => {
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

      reset();
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
      handleUrlAttach();
    }
  };

  return (
    <Popover
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          reset();
        }
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-label="Attach image"
          className="h-7 w-7"
          disabled={disabled}
          size="icon"
          title="Attach image"
          type="button"
          variant="ghost"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" side="top">
        <div className="space-y-2">
          <p className="font-medium text-sm">Attach image reference</p>

          {/* Tabs */}
          <div className="flex gap-1 rounded-md bg-muted p-0.5">
            <button
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors",
                tab === "file"
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setTab("file");
                setError(null);
              }}
              type="button"
            >
              <Upload className="h-3 w-3" />
              Upload
            </button>
            <button
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors",
                tab === "url"
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setTab("url");
                setError(null);
              }}
              type="button"
            >
              <Globe className="h-3 w-3" />
              URL
            </button>
          </div>

          {tab === "file" ? (
            <>
              <input
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleFileSelect}
                ref={fileInputRef}
                type="file"
              />
              <Button
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                variant="outline"
              >
                <Upload className="mr-1.5 h-3 w-3" />
                Choose image file
              </Button>
              <p className="text-center text-muted-foreground text-xs">
                PNG, JPEG, GIF, or WebP up to 10MB
              </p>
            </>
          ) : (
            <>
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
              <div className="flex justify-end">
                <Button
                  disabled={!url.trim() || isValidating}
                  onClick={handleUrlAttach}
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
            </>
          )}

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
