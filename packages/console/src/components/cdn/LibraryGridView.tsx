import {
  ExternalLink,
  File as FileIcon,
  FileImage,
} from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "./CopyButton";
import { StarButton } from "./StarButton";
import type { CdnFile } from "./types";

interface LibraryGridViewProps {
  files: CdnFile[];
  selectedFiles: string[];
  onSelectFile: (key: string) => void;
  onToggleStar: (key: string, starred: boolean) => void;
  onFileClick: (file: CdnFile) => void;
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
  const handleOpenExternal = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, "_blank");
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {files.map((file) => {
        const filename = file.key.split("/").pop() || file.key;
        const ext = getFileExtension(filename);
        const isImage = isImageFile(file.contentType, filename);
        const isSelected = selectedFiles.includes(file.key);

        return (
          <div
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-muted shadow-sm transition-shadow hover:shadow-md"
            key={file.key}
            onClick={() => onFileClick(file)}
          >
            {/* Image Preview Area */}
            <div className="flex aspect-square items-center justify-center">
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
            </div>

            {/* Star Button - Top Right */}
            <StarButton
              starred={file.starred}
              onToggle={() => onToggleStar(file.key, !file.starred)}
              className="absolute top-2 right-2 rounded-full bg-background/80 hover:bg-background/90"
            />

            {/* Card Content Below Image */}
            <Card className="gap-2 rounded-t-none border-none py-3 shadow-none">
              <CardHeader className="gap-1 px-3 py-0">
                <div className="flex items-center gap-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onSelectFile(file.key)}
                    />
                  </div>
                  <CardTitle className="min-w-0 flex-1 truncate text-sm">
                    {filename}
                  </CardTitle>
                </div>
                <CardDescription className="flex items-center gap-2 pl-6">
                  <Badge variant="outline" className="rounded-sm text-[10px]">
                    {ext.toUpperCase()}
                  </Badge>
                  <span className="text-xs">{formatSize(file.size)}</span>
                </CardDescription>
              </CardHeader>

              <CardFooter className="justify-end gap-1 px-3 py-0 opacity-0 transition-opacity group-hover:opacity-100">
                <CopyButton
                  className="h-7 px-2"
                  label="Copy"
                  size="sm"
                  value={file.url}
                  variant="ghost"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={(e) => handleOpenExternal(e, file.url)}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Open
                </Button>
              </CardFooter>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
