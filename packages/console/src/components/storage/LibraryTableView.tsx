import type React from "react";
import { Copy, ExternalLink, File as FileIcon, FileImage, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StorageFile } from "./types";

interface LibraryTableViewProps {
  files: StorageFile[];
  selectedFiles: string[];
  onSelectFile: (key: string) => void;
  onSelectAll: () => void;
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
  return ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "ico"].includes(ext);
}

export function LibraryTableView({
  files,
  selectedFiles,
  onSelectFile,
  onSelectAll,
  onToggleStar,
  onFileClick,
}: LibraryTableViewProps) {
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
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">
              <Checkbox
                checked={selectedFiles.length === files.length && files.length > 0}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead className="w-12" />
            <TableHead>Name</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Modified</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const filename = file.key.split("/").pop() || file.key;
            const ext = getFileExtension(filename);
            const isImage = isImageFile(file.contentType, filename);

            return (
              <TableRow
                className="cursor-pointer hover:bg-muted/50"
                key={file.key}
                onClick={() => onFileClick(file)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedFiles.includes(file.key)}
                    onCheckedChange={() => onSelectFile(file.key)}
                  />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    className="h-8 w-8"
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
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-14 shrink-0 overflow-hidden rounded border bg-muted">
                      {isImage && file.url.startsWith("https://") ? (
                        <img
                          alt={filename}
                          className="h-full w-full object-cover"
                          src={file.url}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {isImage ? (
                            <FileImage className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <FileIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="truncate font-medium">{filename}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{ext.toUpperCase()}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatSize(file.size)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(file.lastModified), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button
                      className="h-8 w-8"
                      onClick={(e) => handleCopyUrl(e, file.url)}
                      size="icon"
                      variant="ghost"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      className="h-8 w-8"
                      onClick={(e) => handleOpenExternal(e, file.url)}
                      size="icon"
                      variant="ghost"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
