/**
 * Image Optimizer Utilities
 * Memory management, dimension calculations, and helper functions
 */

// Browser limits vary, but 16384x16384 is a safe max for most browsers
const MAX_DIMENSION = 16_384;
const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
// Conservative memory limit for image processing (512MB)
const MAX_MEMORY_MB = 512;

/**
 * Error thrown when image is too large for browser processing
 */
export class ImageSizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageSizeError";
  }
}

/**
 * Validate that image dimensions are within browser limits
 * @throws ImageSizeError if image is too large
 */
export function validateImageSize(width: number, height: number): void {
  const pixels = width * height;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ImageSizeError(
      `Image dimensions (${width}x${height}) exceed maximum supported (${MAX_DIMENSION}x${MAX_DIMENSION})`
    );
  }

  if (pixels > MAX_PIXELS) {
    throw new ImageSizeError(
      `Image too large (${width}x${height} = ${pixels.toLocaleString()} pixels). Maximum supported: ~268M pixels.`
    );
  }

  // Estimate memory: 4 bytes per pixel (RGBA) * 2 (source + destination)
  const estimatedMB = (pixels * 4 * 2) / (1024 * 1024);
  if (estimatedMB > MAX_MEMORY_MB) {
    throw new ImageSizeError(
      `Image requires ~${Math.round(estimatedMB)}MB memory. Consider reducing dimensions first.`
    );
  }
}

/**
 * Calculate output dimensions while maintaining aspect ratio
 */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth?: number,
  maxHeight?: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Apply user constraints
  if (maxWidth && width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }

  if (maxHeight && height > maxHeight) {
    width = Math.round(width * (maxHeight / height));
    height = maxHeight;
  }

  // Apply safety limits if still too large
  const pixels = width * height;
  if (pixels > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / pixels);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }

  // Ensure minimum dimensions
  width = Math.max(1, width);
  height = Math.max(1, height);

  return { width, height };
}

/**
 * Convert Blob to data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert File to data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return blobToDataUrl(file);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get MIME type for image format
 */
export function getMimeType(
  format: "webp" | "avif" | "jpeg" | "png" | "original"
): string {
  switch (format) {
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

/**
 * Get file extension for image format
 */
export function getExtension(
  format: "webp" | "avif" | "jpeg" | "png" | "original"
): string {
  switch (format) {
    case "webp":
      return ".webp";
    case "avif":
      return ".avif";
    case "jpeg":
      return ".jpg";
    case "png":
      return ".png";
    default:
      return "";
  }
}

/**
 * Calculate savings percentage
 */
export function calculateSavings(
  originalSize: number,
  optimizedSize: number
): number {
  if (originalSize === 0) {
    return 0;
  }
  return Math.round((1 - optimizedSize / originalSize) * 100);
}

/**
 * Check if a file is an image based on MIME type
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Get image dimensions from a File
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
