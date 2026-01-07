/**
 * Browser Compatibility Detection
 * Check if browser supports required features for image optimization
 */

import type { BrowserSupport } from "./types";

/**
 * Test if browser can encode to a specific image format
 */
async function testImageFormat(mimeType: string): Promise<boolean> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL(mimeType);
    return dataUrl.startsWith(`data:${mimeType}`);
  } catch {
    return false;
  }
}

/**
 * Detect browser support for optimization features
 */
export async function detectBrowserSupport(): Promise<BrowserSupport> {
  const [webp, avif] = await Promise.all([
    testImageFormat("image/webp"),
    testImageFormat("image/avif"),
  ]);

  return {
    webp,
    avif,
    offscreenCanvas: typeof OffscreenCanvas !== "undefined",
    webWorker: typeof Worker !== "undefined",
    wasm: typeof WebAssembly !== "undefined",
  };
}

/**
 * Check if browser can use the full optimizer (WASM + Worker)
 */
export function canUseOptimizer(support: BrowserSupport): boolean {
  return support.offscreenCanvas && support.webWorker && support.wasm;
}

/**
 * Get fallback strategy based on browser support
 */
export function getFallbackStrategy(
  support: BrowserSupport
): "full" | "canvas" | "none" {
  // Full WASM optimization with Web Worker
  if (support.offscreenCanvas && support.webWorker && support.wasm) {
    return "full";
  }

  // Fallback to canvas-based encoding (limited formats, blocking)
  if (support.webp) {
    return "canvas";
  }

  // No optimization available
  return "none";
}

/**
 * Get list of supported output formats based on browser
 */
export function getSupportedFormats(
  support: BrowserSupport
): Array<"webp" | "avif" | "jpeg" | "png"> {
  const formats: Array<"webp" | "avif" | "jpeg" | "png"> = ["jpeg", "png"];

  if (support.webp) {
    formats.unshift("webp"); // WebP as first/default
  }

  if (support.avif) {
    formats.splice(1, 0, "avif"); // AVIF after WebP
  }

  return formats;
}

/**
 * Get user-friendly message about browser support
 */
export function getSupportMessage(support: BrowserSupport): string | null {
  if (canUseOptimizer(support)) {
    return null; // Everything works
  }

  if (!support.wasm) {
    return "Your browser does not support WebAssembly. Image optimization is not available.";
  }

  if (!support.webWorker) {
    return "Your browser does not support Web Workers. Image optimization may be slow.";
  }

  if (!support.offscreenCanvas) {
    return "Your browser does not support OffscreenCanvas. Using fallback optimization.";
  }

  return "Image optimization may be limited in this browser.";
}

/**
 * Cached browser support (detected once)
 */
let cachedSupport: BrowserSupport | null = null;

/**
 * Get browser support (cached after first call)
 */
export async function getBrowserSupport(): Promise<BrowserSupport> {
  if (cachedSupport) {
    return cachedSupport;
  }

  cachedSupport = await detectBrowserSupport();
  return cachedSupport;
}

/**
 * Check if a specific format is supported
 */
export async function isFormatSupported(
  format: "webp" | "avif" | "jpeg" | "png"
): Promise<boolean> {
  const support = await getBrowserSupport();

  switch (format) {
    case "webp":
      return support.webp;
    case "avif":
      return support.avif;
    case "jpeg":
    case "png":
      return true; // Always supported
    default:
      return false;
  }
}
