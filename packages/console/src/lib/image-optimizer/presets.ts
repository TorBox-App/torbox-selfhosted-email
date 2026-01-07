/**
 * Image Optimization Presets
 * Quick configurations for common use cases
 */

import type { OptimizeOptions, Preset } from "./types";

/**
 * Default optimization options
 */
export const DEFAULT_OPTIONS: OptimizeOptions = {
  format: "webp",
  quality: 85,
  maxWidth: undefined,
  maxHeight: undefined,
  targetSize: undefined,
};

/**
 * Preset configurations
 * Note: Dimensions are CSS pixels. Multiply by pixelDensity for actual output.
 * - 1x: Standard displays
 * - 2x: Retina/HiDPI displays (most modern devices)
 * - 3x: High-end phones (iPhone Pro, flagship Android)
 */
export const PRESETS: Record<string, Preset> = {
  email: {
    name: "email",
    label: "Email",
    description: "Optimized for email clients (600px @2x = 1200px)",
    options: {
      format: "webp",
      quality: 85,
      maxWidth: 1200, // 600px @2x for Retina
      targetSize: 500,
    },
  },
  avatar: {
    name: "avatar",
    label: "Avatar",
    description: "Square profile images (256px @2x = 512px)",
    options: {
      format: "webp",
      quality: 90,
      maxWidth: 512, // 256px @2x for Retina
      maxHeight: 512,
    },
  },
  hero: {
    name: "hero",
    label: "Hero Image",
    description: "Large banner images (1440px @2x = 2880px)",
    options: {
      format: "webp",
      quality: 80,
      maxWidth: 2880, // 1440px @2x for Retina/4K
    },
  },
  thumbnail: {
    name: "thumbnail",
    label: "Thumbnail",
    description: "Small preview images (200px @2x = 400px)",
    options: {
      format: "webp",
      quality: 75,
      maxWidth: 400, // 200px @2x for Retina
    },
  },
  custom: {
    name: "custom",
    label: "Custom",
    description: "Configure your own settings",
    options: {},
  },
};

/**
 * Get preset by name
 */
export function getPreset(name: string): Preset | undefined {
  return PRESETS[name];
}

/**
 * Get all preset names
 */
export function getPresetNames(): string[] {
  return Object.keys(PRESETS);
}

/**
 * Merge preset options with defaults
 */
export function mergeWithDefaults(
  presetName: string,
  overrides?: Partial<OptimizeOptions>
): OptimizeOptions {
  const preset = PRESETS[presetName];
  return {
    ...DEFAULT_OPTIONS,
    ...(preset?.options || {}),
    ...overrides,
  };
}

/**
 * Target size options for UI
 */
export const TARGET_SIZE_OPTIONS = [
  { value: 200, label: "200 KB", description: "Strict (small files)" },
  { value: 500, label: "500 KB", description: "Recommended for email" },
  { value: 1024, label: "1 MB", description: "Relaxed (larger files)" },
] as const;

/**
 * Format options for UI
 */
export const FORMAT_OPTIONS = [
  {
    value: "webp" as const,
    label: "WebP",
    description: "Best balance of size and quality",
  },
  { value: "avif" as const, label: "AVIF", description: "Best compression" },
  {
    value: "jpeg" as const,
    label: "JPEG",
    description: "Universal compatibility",
  },
  {
    value: "png" as const,
    label: "PNG",
    description: "Lossless, supports transparency",
  },
  {
    value: "original" as const,
    label: "Original",
    description: "Keep original format",
  },
] as const;

/**
 * Max width options for UI (actual pixel dimensions)
 */
export const MAX_WIDTH_OPTIONS = [
  { value: 512, label: "512px", description: "Avatar @2x (256px CSS)" },
  { value: 800, label: "800px", description: "Small @2x (400px CSS)" },
  { value: 1200, label: "1200px", description: "Email @2x (600px CSS)" },
  { value: 1600, label: "1600px", description: "Medium @2x (800px CSS)" },
  { value: 1920, label: "1920px", description: "Full HD (1080p)" },
  { value: 2560, label: "2560px", description: "QHD / 1440p" },
  { value: 2880, label: "2880px", description: "Hero @2x (1440px CSS)" },
  { value: 3840, label: "3840px", description: "4K / UHD" },
] as const;

/**
 * Pixel density options for UI
 */
export const PIXEL_DENSITY_OPTIONS = [
  { value: 1, label: "1x", description: "Standard displays" },
  { value: 2, label: "2x", description: "Retina / HiDPI (recommended)" },
  { value: 3, label: "3x", description: "iPhone Pro / flagship phones" },
] as const;
