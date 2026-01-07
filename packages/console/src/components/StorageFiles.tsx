import {
  AlertCircle,
  Check,
  CheckCircle2,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ImageOptimizeDialog } from "@/components/image-optimizer";
import {
  type FilterOptions,
  ImageDetailModal,
  LibraryBulkActions,
  LibraryFilters,
  LibraryGridView,
  LibrarySearch,
  LibraryTableView,
  LibraryViewToggle,
  type StorageFile,
  type StorageInfo,
  type ViewMode,
} from "@/components/storage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Upload state
 */
type UploadState = {
  file: File | Blob;
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  cdnUrl?: string;
  error?: string;
};

/**
 * Copy URL button with checkmark feedback
 */
function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button onClick={handleCopy} size="sm" variant="outline">
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <span className="text-xs">Copy</span>
      )}
    </Button>
  );
}

/**
 * Loading skeleton
 */
function FilesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card className="overflow-hidden" key={i}>
            <Skeleton className="aspect-video w-full" />
            <div className="p-3">
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * No storage setup message
 */
function NoStorageSetup() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <HardDrive className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
      <h2 className="mb-2 font-semibold text-xl">No Storage Configured</h2>
      <p className="mb-6 max-w-md text-center text-muted-foreground">
        Storage infrastructure has not been deployed yet. Run{" "}
        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
          wraps storage init
        </code>{" "}
        to get started.
      </p>
    </div>
  );
}

/**
 * Empty state
 */
function EmptyFiles({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FolderOpen className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
      <h3 className="mb-2 font-semibold text-lg">No Files Yet</h3>
      <p className="mb-6 max-w-md text-center text-muted-foreground">
        Upload your first file to get started with your CDN library
      </p>
      <Button onClick={onUploadClick}>
        <Upload className="mr-2 h-4 w-4" />
        Upload Files
      </Button>
    </div>
  );
}

/**
 * Upload progress item
 */
function UploadItem({
  upload,
  onRemove,
}: {
  upload: UploadState;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="truncate font-medium text-sm">
            {upload.filename}
          </span>
          <div className="flex items-center gap-2">
            {upload.status === "uploading" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            {upload.status === "success" && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {upload.status === "error" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <Button
              className="h-6 w-6"
              onClick={onRemove}
              size="icon"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {upload.status === "uploading" && (
          <Progress className="h-1" value={upload.progress} />
        )}
        {upload.status === "success" && upload.cdnUrl && (
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-muted-foreground text-xs">
              {upload.cdnUrl}
            </span>
            <CopyUrlButton url={upload.cdnUrl} />
          </div>
        )}
        {upload.status === "error" && (
          <span className="text-red-500 text-xs">{upload.error}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Upload area with drag and drop
 */
function UploadArea({
  uploads,
  onFilesSelected,
  onRemoveUpload,
}: {
  uploads: UploadState[];
  onFilesSelected: (files: FileList) => void;
  onRemoveUpload: (index: number) => void;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Files</CardTitle>
        <CardDescription>
          Drag and drop files or click to browse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-1 font-medium text-sm">
            Drop files here or click to upload
          </p>
          <p className="text-muted-foreground text-xs">
            Images will be optimized before uploading
          </p>
          <input
            accept="*/*"
            className="hidden"
            multiple
            onChange={handleFileSelect}
            ref={fileInputRef}
            type="file"
          />
        </div>

        {uploads.length > 0 && (
          <div className="space-y-2">
            {uploads.map((upload, index) => (
              <UploadItem
                key={`${upload.filename}-${index}`}
                onRemove={() => onRemoveUpload(index)}
                upload={upload}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Storage Files Component - CDN Library
 */
export function StorageFiles() {
  // Data state
  const [info, setInfo] = React.useState<StorageInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filters, setFilters] = React.useState<FilterOptions>({
    starred: false,
    formats: [],
  });

  // Selection state
  const [selectedFiles, setSelectedFiles] = React.useState<string[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<StorageFile | null>(
    null
  );

  // Upload state
  const [showUpload, setShowUpload] = React.useState(false);
  const [uploads, setUploads] = React.useState<UploadState[]>([]);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    keys: string[];
    isOpen: boolean;
  }>({ keys: [], isOpen: false });

  // Image optimization state
  const [optimizeDialogFiles, setOptimizeDialogFiles] = React.useState<File[]>(
    []
  );
  const [showOptimizeDialog, setShowOptimizeDialog] = React.useState(false);

  // Fetch files
  const fetchFiles = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = sessionStorage.getItem("wraps-auth-token");
      const response = await fetch(`/api/storage/files?token=${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setInfo(null);
          return;
        }
        throw new Error("Failed to fetch storage files");
      }

      const data = await response.json();
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Toggle star
  const handleToggleStar = React.useCallback(
    async (key: string, starred: boolean) => {
      const token = sessionStorage.getItem("wraps-auth-token");

      try {
        const response = await fetch(
          `/api/storage/files/${encodeURIComponent(key)}/star?token=${token}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ starred }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update star status");
        }

        // Update local state
        setInfo((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            files: prev.files.map((f) =>
              f.key === key ? { ...f, starred } : f
            ),
          };
        });

        // Update selected file if open
        if (selectedFile?.key === key) {
          setSelectedFile((prev) => (prev ? { ...prev, starred } : null));
        }

        toast.success(starred ? "File starred" : "Star removed");
      } catch (err) {
        toast.error("Failed to update star status");
      }
    },
    [selectedFile]
  );

  // Delete file(s)
  const handleDeleteFiles = React.useCallback(
    async (keys: string[]) => {
      const token = sessionStorage.getItem("wraps-auth-token");

      try {
        await Promise.all(
          keys.map((key) =>
            fetch(
              `/api/storage/files/${encodeURIComponent(key)}?token=${token}`,
              {
                method: "DELETE",
              }
            )
          )
        );

        toast.success(
          keys.length === 1 ? "File deleted" : `${keys.length} files deleted`
        );
        setSelectedFiles([]);
        setSelectedFile(null);
        fetchFiles();
      } catch {
        toast.error("Failed to delete file(s)");
      }
    },
    [fetchFiles]
  );

  // Upload file
  const uploadFile = React.useCallback(
    async (fileOrBlob: File | Blob, index: number, customFilename?: string) => {
      const token = sessionStorage.getItem("wraps-auth-token");
      const isFile = fileOrBlob instanceof File;
      const filename =
        customFilename || (isFile ? (fileOrBlob as File).name : "file");
      const contentType = fileOrBlob.type || "application/octet-stream";

      try {
        setUploads((prev) =>
          prev.map((u, i) =>
            i === index
              ? { ...u, status: "uploading" as const, progress: 0 }
              : u
          )
        );

        const urlResponse = await fetch(
          `/api/storage/upload-url?token=${token}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, contentType }),
          }
        );

        if (!urlResponse.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadUrl, cdnUrl } = await urlResponse.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploads((prev) =>
                prev.map((u, i) => (i === index ? { ...u, progress } : u))
              );
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () =>
            reject(new Error("Upload failed"))
          );

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", contentType);
          xhr.send(fileOrBlob);
        });

        setUploads((prev) =>
          prev.map((u, i) =>
            i === index
              ? { ...u, status: "success" as const, progress: 100, cdnUrl }
              : u
          )
        );

        toast.success(`Uploaded ${filename}`);
        fetchFiles();
      } catch (err) {
        setUploads((prev) =>
          prev.map((u, i) =>
            i === index
              ? {
                  ...u,
                  status: "error" as const,
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : u
          )
        );
        toast.error(`Failed to upload ${filename}`);
      }
    },
    [fetchFiles]
  );

  // Handle files selected
  const handleFilesSelected = React.useCallback(
    (files: FileList) => {
      const allFiles = Array.from(files);
      const imageFiles = allFiles.filter((f) => f.type.startsWith("image/"));
      const otherFiles = allFiles.filter((f) => !f.type.startsWith("image/"));

      if (otherFiles.length > 0) {
        const newUploads: UploadState[] = otherFiles.map((file) => ({
          file,
          filename: file.name,
          progress: 0,
          status: "pending" as const,
        }));

        setUploads((prev) => [...prev, ...newUploads]);
        setShowUpload(true);

        const startIndex = uploads.length;
        otherFiles.forEach((file, i) => {
          uploadFile(file, startIndex + i, file.name);
        });
      }

      if (imageFiles.length > 0) {
        setOptimizeDialogFiles(imageFiles);
        setShowOptimizeDialog(true);
      }
    },
    [uploads.length, uploadFile]
  );

  // Handle optimized images
  const handleOptimizedImages = React.useCallback(
    (results: Array<{ file: File | Blob; cdnFilename: string }>) => {
      if (!results || results.length === 0) return;

      const startIndex = uploads.length;

      const newUploads: UploadState[] = results.map((result) => ({
        file: result.file,
        filename: result.cdnFilename,
        progress: 0,
        status: "pending" as const,
      }));

      setUploads((prev) => [...prev, ...newUploads]);
      setShowUpload(true);

      results.forEach((result, i) => {
        uploadFile(result.file, startIndex + i, result.cdnFilename);
      });
    },
    [uploads.length, uploadFile]
  );

  // Selection handlers
  const handleSelectFile = React.useCallback((key: string) => {
    setSelectedFiles((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleSelectAll = React.useCallback(() => {
    if (!info?.files) return;
    const filteredKeys = filteredFiles.map((f) => f.key);
    if (selectedFiles.length === filteredKeys.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredKeys);
    }
  }, [info?.files, selectedFiles.length]);

  // Bulk actions
  const handleBulkStar = React.useCallback(async () => {
    await Promise.all(selectedFiles.map((key) => handleToggleStar(key, true)));
    setSelectedFiles([]);
  }, [selectedFiles, handleToggleStar]);

  const handleBulkDelete = React.useCallback(() => {
    setDeleteConfirm({ keys: selectedFiles, isOpen: true });
  }, [selectedFiles]);

  // Computed values
  const filteredFiles = React.useMemo(() => {
    if (!info?.files) return [];

    return info.files.filter((file) => {
      // Search filter
      if (
        searchQuery &&
        !file.key.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Starred filter
      if (filters.starred && !file.starred) {
        return false;
      }

      // Format filter
      if (filters.formats.length > 0) {
        const ext = file.key.split(".").pop()?.toLowerCase() || "";
        if (!filters.formats.includes(ext)) {
          return false;
        }
      }

      return true;
    });
  }, [info?.files, searchQuery, filters]);

  const availableFormats = React.useMemo(() => {
    if (!info?.files) return [];
    const formats = new Set<string>();
    info.files.forEach((file) => {
      const ext = file.key.split(".").pop()?.toLowerCase();
      if (ext) formats.add(ext);
    });
    return Array.from(formats).sort();
  }, [info?.files]);

  // Render
  if (loading) {
    return <FilesSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!info) {
    return <NoStorageSetup />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">CDN Library</h1>
          <p className="text-muted-foreground">
            {info.fileCount > 0 ? (
              <>
                <span className="text-foreground">{info.fileCount}</span> File
                {info.fileCount !== 1 ? "s" : ""} · Total{" "}
                <span className="text-foreground">
                  {formatSize(info.totalSize)}
                </span>
              </>
            ) : (
              "Manage and organize your files"
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowUpload(!showUpload)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
          <Button onClick={fetchFiles} size="icon" variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <LibraryViewToggle
            onViewModeChange={setViewMode}
            viewMode={viewMode}
          />
        </div>
      </div>

      {/* Upload Area */}
      {showUpload && (
        <UploadArea
          onFilesSelected={handleFilesSelected}
          onRemoveUpload={(index) =>
            setUploads((prev) => prev.filter((_, i) => i !== index))
          }
          uploads={uploads}
        />
      )}

      {/* Search and Filters */}
      {info.files.length > 0 && (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <LibrarySearch onChange={setSearchQuery} value={searchQuery} />
          </div>
          <LibraryFilters
            availableFormats={availableFormats}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      )}

      {/* Bulk Actions */}
      {selectedFiles.length > 0 && (
        <LibraryBulkActions
          onClearSelection={() => setSelectedFiles([])}
          onDelete={handleBulkDelete}
          onStar={handleBulkStar}
          selectedCount={selectedFiles.length}
        />
      )}

      {/* Content */}
      {info.files.length === 0 ? (
        <EmptyFiles onUploadClick={() => setShowUpload(true)} />
      ) : filteredFiles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No files match your search or filters
        </div>
      ) : viewMode === "grid" ? (
        <LibraryGridView
          files={filteredFiles}
          onFileClick={setSelectedFile}
          onSelectFile={handleSelectFile}
          onToggleStar={handleToggleStar}
          selectedFiles={selectedFiles}
        />
      ) : (
        <LibraryTableView
          files={filteredFiles}
          onFileClick={setSelectedFile}
          onSelectAll={handleSelectAll}
          onSelectFile={handleSelectFile}
          onToggleStar={handleToggleStar}
          selectedFiles={selectedFiles}
        />
      )}

      {/* Image Detail Modal */}
      {selectedFile && (
        <ImageDetailModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDelete={(key) => {
            setDeleteConfirm({ keys: [key], isOpen: true });
          }}
          onToggleStar={handleToggleStar}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) =>
          setDeleteConfirm((prev) => ({ ...prev, isOpen: open }))
        }
        open={deleteConfirm.isOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete File{deleteConfirm.keys.length > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {deleteConfirm.keys.length === 1 ? (
                <strong>{deleteConfirm.keys[0].split("/").pop()}</strong>
              ) : (
                <strong>{deleteConfirm.keys.length} files</strong>
              )}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                handleDeleteFiles(deleteConfirm.keys);
                setDeleteConfirm({ keys: [], isOpen: false });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Optimization Dialog */}
      <ImageOptimizeDialog
        files={optimizeDialogFiles}
        onClose={() => {
          setShowOptimizeDialog(false);
          setOptimizeDialogFiles([]);
        }}
        onComplete={handleOptimizedImages}
        open={showOptimizeDialog}
      />
    </div>
  );
}
