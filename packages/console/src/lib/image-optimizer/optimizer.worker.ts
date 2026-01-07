/**
 * Image Optimizer Web Worker
 * Runs heavy WASM-based image processing off the main thread
 */

/// <reference lib="webworker" />

import type { OptimizeOptions, OptimizedResult, WorkerMessage } from "./types";

// Lazy-loaded codec functions
let webpEncode: ((data: ImageData, options?: { quality?: number }) => Promise<Uint8Array>) | null = null;
let avifEncode: ((data: ImageData, options?: { quality?: number }) => Promise<Uint8Array>) | null = null;
let jpegEncode: ((data: ImageData, options?: { quality?: number }) => Promise<Uint8Array>) | null = null;
let pngEncode: ((data: ImageData) => Promise<Uint8Array>) | null = null;
let resizeImage: ((data: ImageData, options: { width: number; height: number }) => Promise<ImageData>) | null = null;

/**
 * Load codec on demand
 */
async function loadCodec(format: string): Promise<void> {
  switch (format) {
    case "webp":
      if (!webpEncode) {
        const mod = await import("@jsquash/webp");
        webpEncode = mod.encode;
      }
      break;
    case "avif":
      if (!avifEncode) {
        const mod = await import("@jsquash/avif");
        avifEncode = mod.encode;
      }
      break;
    case "jpeg":
      if (!jpegEncode) {
        const mod = await import("@jsquash/jpeg");
        jpegEncode = mod.encode;
      }
      break;
    case "png":
      if (!pngEncode) {
        const mod = await import("@jsquash/png");
        pngEncode = mod.encode;
      }
      break;
  }
}

/**
 * Load resize function
 */
async function loadResize(): Promise<void> {
  if (!resizeImage) {
    const mod = await import("@jsquash/resize");
    resizeImage = mod.default;
  }
}

/**
 * Calculate output dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth?: number,
  maxHeight?: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  if (maxWidth && width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }

  if (maxHeight && height > maxHeight) {
    width = Math.round(width * (maxHeight / height));
    height = maxHeight;
  }

  return { width: Math.max(1, width), height: Math.max(1, height) };
}

/**
 * Convert blob to data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Get MIME type for format
 */
function getMimeType(format: string): string {
  switch (format) {
    case "webp": return "image/webp";
    case "avif": return "image/avif";
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    default: return "application/octet-stream";
  }
}

/**
 * Encode ImageData to specified format
 */
async function encode(
  imageData: ImageData,
  format: string,
  quality: number
): Promise<Uint8Array> {
  // Load codec if needed
  await loadCodec(format);

  switch (format) {
    case "webp":
      if (!webpEncode) throw new Error("WebP encoder not loaded");
      return webpEncode(imageData, { quality });
    case "avif":
      if (!avifEncode) throw new Error("AVIF encoder not loaded");
      return avifEncode(imageData, { quality });
    case "jpeg":
      if (!jpegEncode) throw new Error("JPEG encoder not loaded");
      return jpegEncode(imageData, { quality });
    case "png":
      if (!pngEncode) throw new Error("PNG encoder not loaded");
      return pngEncode(imageData);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Process an image file
 */
async function processImage(
  file: File,
  options: OptimizeOptions,
  sendProgress: (progress: number) => void
): Promise<OptimizedResult> {
  // Step 1: Load the image
  sendProgress(10);
  const bitmap = await createImageBitmap(file);

  // Step 2: Calculate dimensions
  sendProgress(20);
  const { width, height } = calculateDimensions(
    bitmap.width,
    bitmap.height,
    options.maxWidth,
    options.maxHeight
  );

  // Step 3: Draw to OffscreenCanvas
  sendProgress(30);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close(); // Free memory

  // Step 4: Get ImageData
  sendProgress(40);
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Step 5: Resize if needed
  sendProgress(50);
  if (width !== canvas.width || height !== canvas.height) {
    await loadResize();
    if (resizeImage) {
      imageData = await resizeImage(imageData, { width, height });
    }
  }

  // Step 6: Skip encoding if original format requested
  if (options.format === "original") {
    sendProgress(100);
    const dataUrl = await blobToDataUrl(file);
    return {
      blob: file,
      dataUrl,
      width: bitmap.width,
      height: bitmap.height,
      originalSize: file.size,
      optimizedSize: file.size,
      savings: 0,
      format: "original",
    };
  }

  // Step 7: Load codec and encode
  sendProgress(60);
  await loadCodec(options.format);

  sendProgress(70);
  const encoded = await encode(imageData, options.format, options.quality);

  sendProgress(90);

  // Step 8: Create result
  const blob = new Blob([encoded], { type: getMimeType(options.format) });
  const dataUrl = await blobToDataUrl(blob);

  sendProgress(100);

  return {
    blob,
    dataUrl,
    width,
    height,
    originalSize: file.size,
    optimizedSize: encoded.byteLength,
    savings: Math.round((1 - encoded.byteLength / file.size) * 100),
    format: options.format,
  };
}

/**
 * Handle incoming messages
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, type, file, options } = e.data;

  if (type === "cancel") {
    // Cancel not implemented yet - could add AbortController
    return;
  }

  if (!file) {
    self.postMessage({ id, error: "No file provided" });
    return;
  }

  try {
    const result = await processImage(file, options, (progress) => {
      self.postMessage({ id, progress });
    });

    self.postMessage({ id, result, progress: 100 });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Export empty object for TypeScript module resolution
export {};
