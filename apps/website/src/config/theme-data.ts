import { shadcnThemePresets } from "@wraps/ui/theme-presets/shadcn-ui-theme-presets";
import { tweakcnPresets } from "@wraps/ui/theme-presets/tweakcn-theme-presets";
import type { ColorTheme } from "@/types/theme-customizer";

// Tweakcn theme presets for the dropdown - convert from tweakcnPresets
export const tweakcnThemes: ColorTheme[] = Object.entries(tweakcnPresets).map(
  ([key, preset]) => ({
    name: preset.label || key,
    value: key,
    preset,
  })
);

// Shadcn theme presets for the dropdown - convert from shadcnThemePresets
export const colorThemes: ColorTheme[] = Object.entries(shadcnThemePresets).map(
  ([key, preset]) => ({
    name: preset.label || key,
    value: key,
    preset,
  })
);
