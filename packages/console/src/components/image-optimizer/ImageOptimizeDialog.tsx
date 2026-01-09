/**
 * Image Optimize Dialog
 * Clean, progressive UX for image optimization before upload
 */

import {
  Check,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  analyzeGif,
  FORMAT_OPTIONS,
  fileToDataUrl,
  formatBytes,
  getBrowserSupport,
  getEmailSizeWarning,
  getImageDimensions,
  getSizeStatus,
  type ImageFormat,
  isGifFile,
  type OptimizeOptions,
  PIXEL_DENSITY_OPTIONS,
  type PreviewResult,
  previewOptimization,
} from "@/lib/image-optimizer";

/**
 * Width presets with descriptions
 * These are CSS pixel widths - multiply by pixel density for actual output
 */
const WIDTH_PRESETS = [
  {
    value: "none",
    label: "Original size",
    description: "Keep original dimensions",
  },
  { value: "600", label: "Email (600px)", description: "Standard email width" },
  { value: "800", label: "Medium (800px)", description: "Blog posts, cards" },
  { value: "1200", label: "Large (1200px)", description: "Full-width content" },
  { value: "1440", label: "Hero (1440px)", description: "Banner images" },
  { value: "1920", label: "Full HD (1920px)", description: "Desktop screens" },
] as const;

type ImageOptimizeDialogProps = {
  files: File[];
  onComplete: (
    results: Array<{ file: File | Blob; cdnFilename: string }>
  ) => void;
  onClose: () => void;
  open: boolean;
};

type FileStatus = "pending" | "processing" | "ready" | "done" | "skipped";

type FileEntry = {
  id: string;
  file: File;
  status: FileStatus;
  thumbnailUrl?: string;
  preview?: PreviewResult;
  isAnimatedGif?: boolean;
};

export function ImageOptimizeDialog({
  files,
  onComplete,
  onClose,
  open,
}: ImageOptimizeDialogProps) {
  // === Core State ===
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = React.useState(false);

  // Derived values
  const totalOriginalSize = entries.reduce((sum, e) => sum + e.file.size, 0);
  const totalOptimizedSize = entries.reduce(
    (sum, e) => sum + (e.preview?.optimizedSize ?? e.file.size),
    0
  );
  const totalSavings =
    totalOriginalSize > 0
      ? Math.round((1 - totalOptimizedSize / totalOriginalSize) * 100)
      : 0;

  // Check if all files are optimized (ready or animated gif)
  const allOptimized =
    entries.length > 0 &&
    entries.every(
      (e) => e.status === "ready" || e.status === "done" || e.isAnimatedGif
    );

  // Check if any files need optimization (pending, not animated gif)
  const hasFilesToOptimize = entries.some(
    (e) => e.status === "pending" && !e.isAnimatedGif
  );

  const someProcessing = entries.some((e) => e.status === "processing");

  // === Settings ===
  const [optimizeEnabled, setOptimizeEnabled] = React.useState(true);
  const [showOptions, setShowOptions] = React.useState(false);
  const [options, setOptions] = React.useState<OptimizeOptions>({
    format: "webp",
    quality: 85,
  });
  const [qualityDisplay, setQualityDisplay] = React.useState(85);
  // Width preset (CSS pixels) - default to "none" (no resize)
  const [widthPreset, setWidthPreset] = React.useState<string>("none");
  // Pixel density multiplier
  const [pixelDensity, setPixelDensity] = React.useState<number>(2);

  // === Browser Support ===
  const [canOptimize, setCanOptimize] = React.useState(true);

  React.useEffect(() => {
    getBrowserSupport().then((support) => {
      setCanOptimize(
        support.wasm && support.webWorker && support.offscreenCanvas
      );
    });
  }, []);

  // === Initialize entries when dialog opens ===
  React.useEffect(() => {
    if (!open || files.length === 0) {
      return;
    }

    const newEntries: FileEntry[] = files.map((file, index) => ({
      id: `${file.name}-${index}-${Date.now()}`,
      file,
      status: "pending" as FileStatus,
    }));

    setEntries(newEntries);
    setCurrentId(newEntries[0]?.id ?? null);
    setShowOptions(false);
    setIsOptimizing(false);

    // Generate thumbnails
    for (const entry of newEntries) {
      fileToDataUrl(entry.file).then((url) => {
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, thumbnailUrl: url } : e))
        );
      });

      // Check for animated GIFs
      if (isGifFile(entry.file)) {
        analyzeGif(entry.file).then((info) => {
          if (info.isAnimated) {
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entry.id
                  ? { ...e, isAnimatedGif: true, status: "ready" }
                  : e
              )
            );
          }
        });
      }
    }
  }, [open, files]);

  // === Process all pending files sequentially ===
  const processAllFiles = React.useCallback(async () => {
    // Get current entries at start - we'll use state updater functions to track progress
    const entriesToProcess = entries.filter(
      (e) => e.status === "pending" && !e.isAnimatedGif
    );

    if (entriesToProcess.length === 0) {
      setIsOptimizing(false);
      return;
    }

    // Process each file sequentially
    for (const entry of entriesToProcess) {
      // Mark as processing
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, status: "processing" } : e
        )
      );

      try {
        // Calculate maxWidth based on settings
        let maxWidth: number | undefined;
        if (widthPreset === "none") {
          // "Original size" - scale down by pixel density
          // 1x = keep original, 2x = half, 3x = third
          if (pixelDensity > 1) {
            const dims = await getImageDimensions(entry.file);
            maxWidth = Math.round(dims.width / pixelDensity);
          }
          // else: pixelDensity === 1, keep original (maxWidth = undefined)
        } else {
          // Width preset selected - multiply by density
          maxWidth = Number(widthPreset) * pixelDensity;
        }

        const processOptions: OptimizeOptions = {
          ...options,
          maxWidth,
        };

        const preview = await previewOptimization(entry.file, processOptions);
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, status: "ready", preview } : e
          )
        );
      } catch {
        // On error, mark as ready (will upload original)
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, status: "ready" } : e))
        );
      }
    }

    setIsOptimizing(false);
  }, [entries, options, widthPreset, pixelDensity]);

  // === Reset to pending when options change ===
  const optionsKey = `${options.format}-${options.quality}-${widthPreset}-${pixelDensity}`;
  const prevOptionsKey = React.useRef(optionsKey);

  React.useEffect(() => {
    if (prevOptionsKey.current === optionsKey) {
      return;
    }
    prevOptionsKey.current = optionsKey;

    // Reset non-animated entries to pending (user must click Optimize again)
    setEntries((prev) =>
      prev.map((e) =>
        e.isAnimatedGif ? e : { ...e, status: "pending", preview: undefined }
      )
    );
    setIsOptimizing(false);
  }, [optionsKey]);

  // === Helpers ===
  const getOutputFilename = (file: File) => {
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const ext =
      options.format === "original"
        ? file.name.split(".").pop()
        : options.format;
    return `${baseName}.${ext}`;
  };

  // === Actions ===
  const handleOptimize = () => {
    setIsOptimizing(true);
    processAllFiles();
  };

  const handleUpload = () => {
    const results = entries.map((entry) => {
      if (!optimizeEnabled || entry.isAnimatedGif || !entry.preview) {
        return { file: entry.file, cdnFilename: entry.file.name };
      }
      return {
        file: entry.preview.blob,
        cdnFilename: getOutputFilename(entry.file),
      };
    });
    onComplete(results);
    onClose();
  };

  const handleSkipOptimization = () => {
    const results = entries.map((entry) => ({
      file: entry.file,
      cdnFilename: entry.file.name,
    }));
    onComplete(results);
    onClose();
  };

  // === Render ===
  if (!open) {
    return null;
  }

  const isSingleFile = entries.length === 1;
  const singleEntry = isSingleFile ? entries[0] : null;

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSingleFile ? (
              <>
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <span className="truncate">{singleEntry?.file.name}</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                {entries.length} images selected
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Thumbnail Grid (multi-file) */}
          {!isSingleFile && (
            <div className="grid grid-cols-6 gap-2">
              {entries.slice(0, 11).map((entry) => (
                <Tooltip key={entry.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`relative aspect-square overflow-hidden rounded-md border bg-muted ${
                        entry.id === currentId ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {entry.thumbnailUrl ? (
                        <img
                          alt={entry.file.name}
                          className="h-full w-full object-cover"
                          src={entry.thumbnailUrl}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      {entry.status === "processing" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </div>
                      )}
                      {entry.status === "ready" && entry.preview && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      {entry.isAnimatedGif && (
                        <Badge className="absolute right-0.5 bottom-0.5 h-4 px-1 text-[10px]">
                          GIF
                        </Badge>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-medium text-xs">{entry.file.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatBytes(entry.file.size)}
                      {entry.preview &&
                        ` → ${formatBytes(entry.preview.optimizedSize)}`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {entries.length > 11 && (
                <div className="flex aspect-square items-center justify-center rounded-md border bg-muted text-muted-foreground text-xs">
                  +{entries.length - 11}
                </div>
              )}
            </div>
          )}

          {/* Single Image Preview */}
          {isSingleFile && singleEntry && (
            <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
              {singleEntry.thumbnailUrl ? (
                <img
                  alt={singleEntry.file.name}
                  className="h-full w-full object-contain"
                  src={singleEntry.thumbnailUrl}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {singleEntry.status === "processing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              {singleEntry.status === "ready" && singleEntry.preview && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-500/10">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
              )}
            </div>
          )}

          {/* Size Summary */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">
                  <span className={getSizeStatus(totalOriginalSize).color}>
                    {formatBytes(totalOriginalSize)}
                  </span>
                  {optimizeEnabled && allOptimized && totalSavings > 0 && (
                    <>
                      <span className="mx-2">→</span>
                      <span
                        className={`font-medium ${getSizeStatus(totalOptimizedSize).color}`}
                      >
                        {formatBytes(totalOptimizedSize)}
                      </span>
                    </>
                  )}
                </p>
                {someProcessing && (
                  <p className="text-muted-foreground text-xs">Optimizing...</p>
                )}
                {/* Size warning hint */}
                {!someProcessing &&
                  getEmailSizeWarning(
                    allOptimized ? totalOptimizedSize : totalOriginalSize
                  ) && (
                    <p
                      className={`text-xs ${getSizeStatus(allOptimized ? totalOptimizedSize : totalOriginalSize).color}`}
                    >
                      {
                        getEmailSizeWarning(
                          allOptimized ? totalOptimizedSize : totalOriginalSize
                        )?.suggestion
                      }
                    </p>
                  )}
              </div>
              {optimizeEnabled && allOptimized && totalSavings > 0 && (
                <Badge
                  className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  variant="secondary"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Save {totalSavings}%
                </Badge>
              )}
            </div>

            {/* Progress bar while processing */}
            {someProcessing && (
              <Progress
                className="mt-3 h-1"
                value={
                  (entries.filter(
                    (e) => e.status === "ready" || e.isAnimatedGif
                  ).length /
                    entries.length) *
                  100
                }
              />
            )}
          </div>

          {/* Optimize Toggle */}
          {canOptimize && (
            <div className="flex items-center justify-between">
              <Label className="cursor-pointer" htmlFor="optimize-toggle">
                Optimize before uploading
              </Label>
              <Switch
                checked={optimizeEnabled}
                id="optimize-toggle"
                onCheckedChange={setOptimizeEnabled}
              />
            </div>
          )}

          {/* Options (Collapsible) */}
          {optimizeEnabled && canOptimize && (
            <Collapsible onOpenChange={setShowOptions} open={showOptions}>
              <CollapsibleTrigger asChild>
                <Button
                  className="w-full justify-start text-muted-foreground"
                  size="sm"
                  variant="ghost"
                >
                  {showOptions ? (
                    <ChevronDown className="mr-2 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4" />
                  )}
                  Options
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* Format and Quality Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">
                      Format
                    </Label>
                    <Select
                      onValueChange={(v) =>
                        setOptions({ ...options, format: v as ImageFormat })
                      }
                      value={options.format || "webp"}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quality */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-xs">
                        Quality
                      </Label>
                      <span className="text-muted-foreground text-xs">
                        {qualityDisplay}%
                      </span>
                    </div>
                    <Slider
                      className="mt-2"
                      max={100}
                      min={50}
                      onValueChange={([v]) => setQualityDisplay(v)}
                      onValueCommit={([v]) =>
                        setOptions({ ...options, quality: v })
                      }
                      step={5}
                      value={[qualityDisplay]}
                    />
                  </div>
                </div>

                {/* Resize Section */}
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-xs">Resize Image</Label>
                    <span className="text-muted-foreground text-xs">
                      Maintains aspect ratio
                    </span>
                  </div>

                  {/* Width Preset + Pixel Density Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        Max Width
                      </Label>
                      <Select
                        onValueChange={setWidthPreset}
                        value={widthPreset}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WIDTH_PRESETS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              <div className="flex flex-col">
                                <span>{preset.label}</span>
                                <span className="text-muted-foreground text-xs">
                                  {preset.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        Pixel Density
                      </Label>
                      <Select
                        onValueChange={(v) => setPixelDensity(Number(v))}
                        value={String(pixelDensity)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PIXEL_DENSITY_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={String(opt.value)}
                            >
                              <div className="flex flex-col">
                                <span>{opt.label}</span>
                                <span className="text-muted-foreground text-xs">
                                  {opt.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Output size hint */}
                  <p className="text-muted-foreground text-xs">
                    {widthPreset === "none"
                      ? pixelDensity === 1
                        ? "Original dimensions preserved"
                        : `Scales to 1/${pixelDensity} original size`
                      : `Output: ${Number(widthPreset) * pixelDensity}px actual width`}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          {optimizeEnabled && canOptimize ? (
            <>
              <Button onClick={handleSkipOptimization} variant="outline">
                Upload originals
              </Button>
              {allOptimized ? (
                <Button onClick={handleUpload}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload{totalSavings > 0 && ` (save ${totalSavings}%)`}
                </Button>
              ) : (
                <Button
                  disabled={isOptimizing || !hasFilesToOptimize}
                  onClick={handleOptimize}
                >
                  {isOptimizing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  {isOptimizing ? "Optimizing..." : "Optimize"}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={handleSkipOptimization}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
