/**
 * GIF Detection and Handling
 * Detect animated GIFs and provide recommendations
 */

import type { GifInfo } from "./types";

/**
 * Check if a file is an animated GIF
 * Reads the file header to detect multiple frames
 */
export async function analyzeGif(file: File): Promise<GifInfo> {
  // Not a GIF
  if (file.type !== "image/gif") {
    return {
      isAnimated: false,
      frameCount: 1,
      size: file.size,
    };
  }

  try {
    const buffer = await file.arrayBuffer();
    const view = new Uint8Array(buffer);

    // Count graphic control extension blocks (indicates frames)
    let frameCount = 0;

    for (let i = 0; i < view.length - 2; i++) {
      // GIF89a graphic control extension: 0x21 0xF9
      if (view[i] === 0x21 && view[i + 1] === 0xf9) {
        frameCount++;
      }
    }

    // A GIF is animated if it has more than one frame
    return {
      isAnimated: frameCount > 1,
      frameCount: Math.max(1, frameCount),
      size: file.size,
    };
  } catch {
    // If we can't read the file, assume it's not animated
    return {
      isAnimated: false,
      frameCount: 1,
      size: file.size,
    };
  }
}

/**
 * Quick check if file is a GIF
 */
export function isGifFile(file: File): boolean {
  return file.type === "image/gif";
}

/**
 * Get recommendation for GIF handling
 */
export function getGifRecommendation(
  gifInfo: GifInfo
): {
  canOptimize: boolean;
  message: string;
  suggestion?: string;
} {
  if (!gifInfo.isAnimated) {
    return {
      canOptimize: true,
      message: "Static GIF can be converted to WebP for better compression",
    };
  }

  // Animated GIF
  const sizeMb = gifInfo.size / (1024 * 1024);

  if (sizeMb > 2) {
    return {
      canOptimize: false,
      message: `Animated GIF (${gifInfo.frameCount} frames) cannot be optimized`,
      suggestion:
        "Consider converting to MP4/WebM video for ~80% smaller size. Most modern email clients support video.",
    };
  }

  if (sizeMb > 1) {
    return {
      canOptimize: false,
      message: `Animated GIF (${gifInfo.frameCount} frames) is large`,
      suggestion:
        "Animated GIFs cannot be compressed without losing animation. Consider reducing frame count or dimensions.",
    };
  }

  return {
    canOptimize: false,
    message: `Animated GIF (${gifInfo.frameCount} frames) will be uploaded as-is`,
    suggestion: "Animation will be preserved",
  };
}

/**
 * Check if we should skip optimization for this file
 */
export async function shouldSkipOptimization(
  file: File
): Promise<{ skip: boolean; reason?: string }> {
  if (!isGifFile(file)) {
    return { skip: false };
  }

  const gifInfo = await analyzeGif(file);

  if (gifInfo.isAnimated) {
    return {
      skip: true,
      reason: `Animated GIF (${gifInfo.frameCount} frames) - optimization would remove animation`,
    };
  }

  return { skip: false };
}
