/**
 * Image Optimizer
 * Browser-based image optimization using jSquash WASM codecs
 *
 * @example
 * ```typescript
 * import { optimizeImage, PRESETS, getEmailSizeWarning } from '@/lib/image-optimizer';
 *
 * // Optimize with preset
 * const result = await optimizeImage(file, PRESETS.email.options);
 * console.log(`Saved ${result.savings}%`);
 *
 * // Check for email warnings
 * const warning = getEmailSizeWarning(result.optimizedSize);
 * if (warning) {
 *   console.warn(warning.message);
 * }
 * ```
 */

// Browser compatibility
export {
  canUseOptimizer,
  detectBrowserSupport,
  getBrowserSupport,
  getFallbackStrategy,
  getSupportedFormats,
  getSupportMessage,
  isFormatSupported,
} from "./compat";
// GIF handling
export {
  analyzeGif,
  getGifRecommendation,
  isGifFile,
  shouldSkipOptimization,
} from "./gif";
// Main optimizer
export {
  ImageOptimizer,
  imageOptimizer,
  optimizeImage,
  previewOptimization,
} from "./optimizer";
// Presets
export {
  DEFAULT_OPTIONS,
  FORMAT_OPTIONS,
  getPreset,
  getPresetNames,
  MAX_WIDTH_OPTIONS,
  mergeWithDefaults,
  PIXEL_DENSITY_OPTIONS,
  PRESETS,
  TARGET_SIZE_OPTIONS,
} from "./presets";
// Types
export type {
  BrowserSupport,
  GifInfo,
  ImageFormat,
  OptimizedResult,
  OptimizeOptions,
  Preset,
  PreviewResult,
  SizeWarning,
  SizeWarningLevel,
} from "./types";
// Utilities
export {
  blobToDataUrl,
  calculateDimensions,
  calculateSavings,
  fileToDataUrl,
  formatBytes,
  getExtension,
  getImageDimensions,
  getMimeType,
  ImageSizeError,
  isImageFile,
  validateImageSize,
} from "./utils";
// Size warnings
export {
  getEmailSizeWarning,
  getRecommendedTargetSize,
  getSizeStatus,
  getWarningBgColor,
  getWarningColor,
  shouldBlockUpload,
} from "./warnings";
