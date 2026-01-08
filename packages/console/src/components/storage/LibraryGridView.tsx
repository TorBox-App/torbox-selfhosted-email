import {
  Copy,
  ExternalLink,
  File as FileIcon,
  FileImage,
  Star,
} from "lucide-react";
import type React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { StorageFile } from "./types";

interface LibraryGridViewProps {
  files: StorageFile[];
  selectedFiles: string[];
  onSelectFile: (key: string) => void;
  onToggleStar: (key: string, starred: boolean) => void;
  onFileClick: (file: StorageFile) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function isImageFile(contentType?: string, filename?: string): boolean {
  if (contentType?.startsWith("image/")) return true;
  const ext = filename ? getFileExtension(filename) : "";
  return [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "avif",
    "svg",
    "bmp",
    "ico",
  ].includes(ext);
}

export function LibraryGridView({
  files,
  selectedFiles,
  onSelectFile,
  onToggleStar,
  onFileClick,
}: LibraryGridViewProps) {
  const handleCopyUrl = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  const handleOpenExternal = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, "_blank");
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {files.map((file) => {
        const filename = file.key.split("/").pop() || file.key;
        const ext = getFileExtension(filename);
        const isImage = isImageFile(file.contentType, filename);

        return (
          <Card
            className="group relative cursor-pointer overflow-hidden transition-colors hover:border-primary/50"
            key={file.key}
            onClick={() => onFileClick(file)}
          >
            {/* Image Preview Area */}
            <div className="relative aspect-video overflow-hidden bg-muted">
              {isImage && file.url.startsWith("https://") ? (
                <img
                  alt={filename}
                  className="h-full w-full object-cover"
                  src={file.url}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {isImage ? (
                    <FileImage className="h-12 w-12 text-muted-foreground/50" />
                  ) : (
                    <FileIcon className="h-12 w-12 text-muted-foreground/50" />
                  )}
                </div>
              )}

              {/* Selection Checkbox */}
              <div
                className="absolute top-2 left-2 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedFiles.includes(file.key)}
                  className="bg-background/80 backdrop-blur-sm"
                  onCheckedChange={() => onSelectFile(file.key)}
                />
              </div>

              {/* Star Button */}
              <Button
                className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(file.key, !file.starred);
                }}
                size="icon"
                variant="ghost"
              >
                <Star
                  className={`h-4 w-4 ${
                    file.starred ? "fill-yellow-500 text-yellow-500" : ""
                  }`}
                />
              </Button>

              {/* Quick Actions Overlay */}
              <div className="absolute right-2 bottom-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  className="h-8 w-8"
                  onClick={(e) => handleCopyUrl(e, file.url)}
                  size="icon"
                  variant="secondary"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  className="h-8 w-8"
                  onClick={(e) => handleOpenExternal(e, file.url)}
                  size="icon"
                  variant="secondary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* File Info */}
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 truncate font-medium text-sm">
                  {filename}
                </p>
                <Badge className="shrink-0 text-xs" variant="secondary">
                  {ext.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <span>{formatSize(file.size)}</span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
