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

// Types
export type {
  ImageFormat,
  OptimizeOptions,
  OptimizedResult,
  PreviewResult,
  Preset,
  SizeWarning,
  SizeWarningLevel,
  BrowserSupport,
  GifInfo,
} from "./types";

// Main optimizer
export {
  ImageOptimizer,
  imageOptimizer,
  optimizeImage,
  previewOptimization,
} from "./optimizer";

// Presets
export {
  PRESETS,
  DEFAULT_OPTIONS,
  getPreset,
  getPresetNames,
  mergeWithDefaults,
  TARGET_SIZE_OPTIONS,
  FORMAT_OPTIONS,
  MAX_WIDTH_OPTIONS,
  PIXEL_DENSITY_OPTIONS,
} from "./presets";

// Size warnings
export {
  getEmailSizeWarning,
  getWarningColor,
  getWarningBgColor,
  shouldBlockUpload,
  getRecommendedTargetSize,
  getSizeStatus,
} from "./warnings";

// GIF handling
export {
  analyzeGif,
  isGifFile,
  getGifRecommendation,
  shouldSkipOptimization,
} from "./gif";

// Browser compatibility
export {
  detectBrowserSupport,
  canUseOptimizer,
  getFallbackStrategy,
  getSupportedFormats,
  getSupportMessage,
  getBrowserSupport,
  isFormatSupported,
} from "./compat";

// Utilities
export {
  validateImageSize,
  calculateDimensions,
  blobToDataUrl,
  fileToDataUrl,
  formatBytes,
  getMimeType,
  getExtension,
  calculateSavings,
  isImageFile,
  getImageDimensions,
  ImageSizeError,
} from "./utils";
