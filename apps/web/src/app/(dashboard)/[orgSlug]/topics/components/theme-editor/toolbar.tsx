"use client";

import { Label } from "@wraps/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wraps/ui/components/ui/select";
import { Separator } from "@wraps/ui/components/ui/separator";
import { Toggle } from "@wraps/ui/components/ui/toggle";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wraps/ui/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wraps/ui/components/ui/tooltip";
import {
  Contrast,
  Link2,
  Monitor,
  Moon,
  Palette,
  Pipette,
  Smartphone,
  Sun,
  Unlink2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  TailwindColorPicker,
  tailwindColors,
} from "@/components/ui/tailwind-color-picker";
import {
  PREFERENCE_FONTS,
  type PreferenceFontId,
} from "@/lib/preference-theme/fonts";
import type { ThemeDraft } from "./use-theme-draft";

export type PreviewState = "default" | "pending" | "unsubscribed";
export type PreviewWidth = "desktop" | "mobile";
export type PreviewMode = "light" | "dark";

const RADIUS_PRESETS = [
  { label: "None", value: "0" },
  { label: "Small", value: "0.375rem" },
  { label: "Medium", value: "0.625rem" },
  { label: "Large", value: "0.875rem" },
  { label: "Full", value: "1.5rem" },
];

const FALLBACK_FAMILY = "indigo";
const FALLBACK_SHADE = "600";

function hexToRgbInts(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) {
    return null;
  }
  const n = Number.parseInt(match[1], 16);
  return {
    r: Math.floor(n / 65_536) % 256,
    g: Math.floor(n / 256) % 256,
    b: n % 256,
  };
}

function hexDistance(a: string, b: string): number {
  const pa = hexToRgbInts(a);
  const pb = hexToRgbInts(b);
  if (!(pa && pb)) {
    return Number.POSITIVE_INFINITY;
  }
  return (pa.r - pb.r) ** 2 + (pa.g - pb.g) ** 2 + (pa.b - pb.b) ** 2;
}

function getSwatchHex(family: string, shade: string): string | undefined {
  const shades = tailwindColors[family as keyof typeof tailwindColors];
  if (!shades) {
    return;
  }
  const shadeNumber = Number.parseInt(shade, 10);
  const entry = Object.entries(shades).find(
    ([key]) => Number.parseInt(key, 10) === shadeNumber
  );
  return entry?.[1];
}

function findNearestSwatch(hex: string | undefined): {
  family: string;
  shade: string;
} {
  if (!hex) {
    return { family: FALLBACK_FAMILY, shade: FALLBACK_SHADE };
  }
  let best = { family: FALLBACK_FAMILY, shade: FALLBACK_SHADE };
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [family, shades] of Object.entries(tailwindColors)) {
    for (const [shade, swatchHex] of Object.entries(shades)) {
      const dist = hexDistance(hex, swatchHex);
      if (dist < bestDist) {
        bestDist = dist;
        best = { family, shade };
      }
    }
  }
  return bestDist === Number.POSITIVE_INFINITY
    ? { family: FALLBACK_FAMILY, shade: FALLBACK_SHADE }
    : best;
}

type ToolbarProps = {
  draft: ThemeDraft;
  setAccent: (accent: string) => void;
  setRadius: (value: string) => void;
  setFont: (slot: "body" | "heading", id: PreferenceFontId | null) => void;
  setFontsLinked: (linked: boolean) => void;
  previewState: PreviewState;
  onPreviewStateChange: (state: PreviewState) => void;
  previewWidth: PreviewWidth;
  onPreviewWidthChange: (width: PreviewWidth) => void;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  previewModeNote: string | null;
  onOpenImportCss: () => void;
  onOpenContrastCheck: () => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
};

export function Toolbar({
  draft,
  setAccent,
  setRadius,
  setFont,
  setFontsLinked,
  previewState,
  onPreviewStateChange,
  previewWidth,
  onPreviewWidthChange,
  previewMode,
  onPreviewModeChange,
  previewModeNote,
  onOpenImportCss,
  onOpenContrastCheck,
  onSave,
  isSaving,
  isDirty,
}: ToolbarProps) {
  const [colorMode, setColorMode] = useState<"tailwind" | "custom">("tailwind");

  const accent = draft.light.primary ?? "";
  const nearestSwatch = useMemo(() => findNearestSwatch(accent), [accent]);

  const linked = draft.fonts.heading === null;
  const bodyFontId = draft.fonts.body ?? "inter";
  const headingFontId = linked
    ? bodyFontId
    : (draft.fonts.heading ?? bodyFontId);

  const sortedHeadingFonts = useMemo(() => {
    // Serif families first when unlinked — a serif heading over a sans body
    // is the pairing most orgs actually want, and surfacing it first is the
    // reason the unlink control exists.
    return [...PREFERENCE_FONTS].sort((a, b) => {
      if (a.category === b.category) {
        return 0;
      }
      return a.category === "serif" ? -1 : 1;
    });
  }, []);

  const radius = draft.light.radius ?? "0.625rem";

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Group 1 — what you're previewing */}
        <div className="flex items-center gap-2">
          <Label className="sr-only" htmlFor="preview-state">
            Preview state
          </Label>
          <ToggleGroup
            id="preview-state"
            onValueChange={(value) =>
              value && onPreviewStateChange(value as PreviewState)
            }
            size="sm"
            type="single"
            value={previewState}
            variant="outline"
          >
            <ToggleGroupItem value="default">Default</ToggleGroupItem>
            <ToggleGroupItem value="pending">
              Pending confirmation
            </ToggleGroupItem>
            <ToggleGroupItem value="unsubscribed">Unsubscribed</ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup
            aria-label="Preview width"
            onValueChange={(value) =>
              value && onPreviewWidthChange(value as PreviewWidth)
            }
            size="sm"
            type="single"
            value={previewWidth}
            variant="outline"
          >
            <ToggleGroupItem aria-label="Desktop" value="desktop">
              <Monitor className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="Mobile" value="mobile">
              <Smartphone className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Separator className="h-6" orientation="vertical" />

        {/* Group 2 — color */}
        <div className="flex items-center gap-2">
          <ToggleGroup
            aria-label="Color input mode"
            onValueChange={(value) =>
              value && setColorMode(value as "tailwind" | "custom")
            }
            size="sm"
            type="single"
            value={colorMode}
            variant="outline"
          >
            <ToggleGroupItem aria-label="Tailwind colors" value="tailwind">
              <Palette className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="Custom color" value="custom">
              <Pipette className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>

          {colorMode === "tailwind" ? (
            <>
              <Label className="sr-only" htmlFor="accent-family">
                Accent color family
              </Label>
              <Select
                onValueChange={(family) => {
                  const hex =
                    getSwatchHex(family, nearestSwatch.shade) ??
                    Object.values(
                      tailwindColors[family as keyof typeof tailwindColors]
                    )[0];
                  setAccent(hex);
                }}
                value={nearestSwatch.family}
              >
                <SelectTrigger className="w-36" id="accent-family" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tailwindColors).map(([family, shades]) => (
                    <SelectItem key={family} value={family}>
                      <span
                        className="mr-2 inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: shades[500] }}
                      />
                      <span className="capitalize">{family}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label className="sr-only" htmlFor="accent-shade">
                Accent color shade
              </Label>
              <Select
                onValueChange={(shade) => {
                  const hex = getSwatchHex(nearestSwatch.family, shade);
                  if (hex) {
                    setAccent(hex);
                  }
                }}
                value={nearestSwatch.shade}
              >
                <SelectTrigger className="w-24" id="accent-shade" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(
                    tailwindColors[
                      nearestSwatch.family as keyof typeof tailwindColors
                    ]
                  ).map((shade) => (
                    <SelectItem key={shade} value={shade}>
                      {shade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <TailwindColorPicker onChange={setAccent} value={accent} />
          )}
        </div>

        <Separator className="h-6" orientation="vertical" />

        {/* Group 3 — shape */}
        <div className="flex items-center gap-2">
          <Label className="sr-only" htmlFor="radius-select">
            Corner radius
          </Label>
          <Select onValueChange={setRadius} value={radius}>
            <SelectTrigger className="w-28" id="radius-select" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RADIUS_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="h-6" orientation="vertical" />

        {/* Group 4 — type */}
        <div className="flex items-center gap-2">
          <Label className="sr-only" htmlFor="body-font-select">
            Body font
          </Label>
          <Select
            onValueChange={(id) => setFont("body", id as PreferenceFontId)}
            value={bodyFontId}
          >
            <SelectTrigger className="w-40" id="body-font-select" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREFERENCE_FONTS.map((font) => (
                <SelectItem key={font.id} value={font.id}>
                  <span style={{ fontFamily: font.fontFamily }}>
                    {font.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                aria-label={
                  linked
                    ? "Unlink heading font from body"
                    : "Link heading font to body"
                }
                onPressedChange={(pressed) => setFontsLinked(!pressed)}
                pressed={!linked}
                size="sm"
              >
                {linked ? (
                  <Link2 className="h-3.5 w-3.5" />
                ) : (
                  <Unlink2 className="h-3.5 w-3.5" />
                )}
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              {linked ? "Heading matches body" : "Heading font unlinked"}
            </TooltipContent>
          </Tooltip>

          <Label className="sr-only" htmlFor="heading-font-select">
            Heading font
          </Label>
          <Select
            disabled={linked}
            onValueChange={(id) => setFont("heading", id as PreferenceFontId)}
            value={headingFontId}
          >
            <SelectTrigger className="w-40" id="heading-font-select" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortedHeadingFonts.map((font) => (
                <SelectItem key={font.id} value={font.id}>
                  <span style={{ fontFamily: font.fontFamily }}>
                    {font.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="h-6" orientation="vertical" />

        {/* Group 5 — actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={onOpenImportCss} size="sm" variant="outline">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import CSS
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={
                  previewMode === "light"
                    ? "Preview dark mode"
                    : "Preview light mode"
                }
                onClick={() =>
                  onPreviewModeChange(
                    previewMode === "light" ? "dark" : "light"
                  )
                }
                size="icon"
                variant="outline"
              >
                {previewMode === "light" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle preview theme</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Check color contrast"
                onClick={onOpenContrastCheck}
                size="icon"
                variant="outline"
              >
                <Contrast className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Check color contrast</TooltipContent>
          </Tooltip>

          <Button disabled={isSaving || !isDirty} onClick={onSave} size="sm">
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {previewModeNote && (
        <p className="text-muted-foreground text-xs">{previewModeNote}</p>
      )}
    </div>
  );
}
