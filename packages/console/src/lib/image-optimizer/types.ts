/**
 * Image Optimizer Types
 * Browser-based image optimization using jSquash WASM codecs
 */

export type ImageFormat = "webp" | "avif" | "jpeg" | "png" | "original";

export type OptimizeOptions = {
  /** Output format */
  format: ImageFormat;
  /** Quality 1-100 (higher = better quality, larger file) */
  quality: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Target file size in KB (will iteratively adjust quality to hit) */
  targetSize?: number;
};

export type OptimizedResult = {
  /** Optimized image blob */
  blob: Blob;
  /** Data URL for preview */
  dataUrl: string;
  /** Output width */
  width: number;
  /** Output height */
  height: number;
  /** Original file size in bytes */
  originalSize: number;
  /** Optimized file size in bytes */
  optimizedSize: number;
  /** Percentage saved (0-100) */
  savings: number;
  /** Output format used */
  format: ImageFormat;
};

export interface PreviewResult extends OptimizedResult {
  /** Original image data URL for comparison */
  originalDataUrl: string;
}

export type Preset = {
  /** Preset identifier */
  name: string;
  /** Display label */
  label: string;
  /** Description for users */
  description: string;
  /** Preset options */
  options: Partial<OptimizeOptions>;
};

export type SizeWarningLevel = "info" | "warning" | "error";

export type SizeWarning = {
  /** Warning severity */
  level: SizeWarningLevel;
  /** Warning message */
  message: string;
  /** Suggested action */
  suggestion?: string;
};

export type BrowserSupport = {
  /** WebP encode/decode support */
  webp: boolean;
  /** AVIF encode/decode support */
  avif: boolean;
  /** OffscreenCanvas support (required for Web Worker) */
  offscreenCanvas: boolean;
  /** Web Worker support */
  webWorker: boolean;
  /** WebAssembly support */
  wasm: boolean;
};

export type WorkerMessageType = "optimize" | "preview" | "cancel";

export type WorkerMessage = {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: WorkerMessageType;
  /** File to process */
  file?: File;
  /** Optimization options */
  options: OptimizeOptions;
};

export type WorkerResponse = {
  /** Message ID this response is for */
  id: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Optimization result */
  result?: OptimizedResult;
  /** Error message if failed */
  error?: string;
};

export type GifInfo = {
  /** Whether the GIF is animated */
  isAnimated: boolean;
  /** Frame count (1 for static) */
  frameCount: number;
  /** File size in bytes */
  size: number;
};
