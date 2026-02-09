"use client";

import { ImageIcon, Palette, X } from "lucide-react";
import type { ImageAttachment } from "./ai-image-url-popover";

type AIAttachmentChipsProps = {
  imageAttachment: ImageAttachment | null;
  selectedBrandKit: { name: string; primaryColor: string | null } | null;
  onRemoveImage: () => void;
  onRemoveBrandKit: () => void;
};

export function AIAttachmentChips({
  imageAttachment,
  selectedBrandKit,
  onRemoveImage,
  onRemoveBrandKit,
}: AIAttachmentChipsProps) {
  if (!(imageAttachment || selectedBrandKit)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-black/5 px-3 py-1.5 dark:bg-white/5">
      {imageAttachment && (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
          <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="max-w-[120px] truncate">
            {imageAttachment.filename}
          </span>
          <button
            className="ml-0.5 rounded-sm p-0.5 hover:bg-background"
            onClick={onRemoveImage}
            type="button"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </span>
      )}
      {selectedBrandKit && (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
          <Palette className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="max-w-[120px] truncate">
            {selectedBrandKit.name}
          </span>
          <button
            className="ml-0.5 rounded-sm p-0.5 hover:bg-background"
            onClick={onRemoveBrandKit}
            type="button"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </span>
      )}
    </div>
  );
}
