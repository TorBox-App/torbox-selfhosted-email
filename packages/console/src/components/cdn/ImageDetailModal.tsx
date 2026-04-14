import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import { Dialog, DialogContent } from "@wraps/ui/components/ui/dialog";
import { Separator } from "@wraps/ui/components/ui/separator";
import { format } from "date-fns";
import {
  Download,
  ExternalLink,
  File as FileIcon,
  FileImage,
  X,
} from "lucide-react";
import { CopyButton } from "./CopyButton";
import { DeleteButton } from "./DeleteButton";
import { StarButton } from "./StarButton";
import type { CdnFile } from "./types";

type ImageDetailModalProps = {
  file: CdnFile;
  onClose: () => void;
  onToggleStar: (key: string, starred: boolean) => void;
  onDelete: (key: string) => void;
};

function formatSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function isImageFile(contentType?: string, filename?: string): boolean {
  if (contentType?.startsWith("image/")) {
    return true;
  }
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

export function ImageDetailModal({
  file,
  onClose,
  onToggleStar,
  onDelete,
}: ImageDetailModalProps) {
  const filename = file.key.split("/").pop() || file.key;
  const ext = getFileExtension(filename);
  const isImage = isImageFile(file.contentType, filename);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = filename;
    link.target = "_blank";
    link.click();
  };

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto [&>button]:hidden">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-bold text-2xl">{filename}</h2>
              {file.key !== filename && (
                <p className="mt-1 text-muted-foreground text-sm">{file.key}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StarButton
                onToggle={() => onToggleStar(file.key, !file.starred)}
                starred={file.starred}
                variant="outline"
              />
              <DeleteButton onDelete={() => onDelete(file.key)} />
              <Button onClick={onClose} size="icon" variant="outline">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="aspect-video overflow-hidden rounded-lg bg-muted">
            {isImage && file.url.startsWith("https://") ? (
              <img
                alt={filename}
                className="h-full w-full object-contain"
                src={file.url}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                {isImage ? (
                  <FileImage className="h-16 w-16 text-muted-foreground/50" />
                ) : (
                  <FileIcon className="h-16 w-16 text-muted-foreground/50" />
                )}
                <p className="text-muted-foreground text-sm">
                  Preview not available
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <CopyButton
              className="flex-1"
              label="Copy CDN URL"
              size="default"
              value={file.url}
              variant="default"
            />
            <Button
              className="flex-1 gap-2 bg-transparent"
              onClick={() => window.open(file.url, "_blank")}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </Button>
            <Button
              className="flex-1 gap-2 bg-transparent"
              onClick={handleDownload}
              variant="outline"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>

          <Separator />

          {/* Details */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold text-sm">File Information</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Format</dt>
                    <dd className="font-medium">
                      <Badge variant="secondary">{ext.toUpperCase()}</Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Size</dt>
                    <dd className="font-medium">{formatSize(file.size)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Content Type</dt>
                    <dd className="font-medium">
                      {file.contentType || "Unknown"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold text-sm">Metadata</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Last Modified</dt>
                    <dd className="font-medium">
                      {format(
                        new Date(file.lastModified),
                        "MMM d, yyyy 'at' h:mm a"
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Starred</dt>
                    <dd className="font-medium">
                      {file.starred ? "Yes" : "No"}
                    </dd>
                  </div>
                  {file.tags.length > 0 && (
                    <div>
                      <dt className="mb-1 text-muted-foreground">Tags</dt>
                      <dd className="flex flex-wrap gap-1">
                        {file.tags
                          .filter((t) => t.key !== "starred")
                          .map((tag) => (
                            <Badge key={tag.key} variant="secondary">
                              {tag.key}: {tag.value}
                            </Badge>
                          ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>

          <Separator />

          {/* CDN URL */}
          <div>
            <h3 className="mb-2 font-semibold text-sm">CDN URL</h3>
            <div className="flex gap-2">
              <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-sm">
                {file.url}
              </code>
              <CopyButton size="sm" value={file.url} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
