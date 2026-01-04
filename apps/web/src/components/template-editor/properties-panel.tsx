"use client";

import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { Layout, Link2, Palette, Settings2, Type } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  borderRadiusPresets,
  fontSizePresets,
  fontWeightPresets,
  gapPresets,
  PresetSelector,
  paddingPresets,
  TailwindColorPicker,
} from "@/components/ui/tailwind-color-picker";
import { useTemplateActions } from "@/stores/template-store";

type PropertiesPanelProps = {
  editor: Editor | null;
};

type SelectedNodeInfo = {
  type: string;
  attrs: Record<string, unknown>;
  pos: number;
};

// List of node types that have configurable properties
const CONFIGURABLE_NODES = [
  "emailButton",
  "emailSection",
  "emailImage",
  "emailIcon",
  "emailDivider",
  "emailSpacer",
  "emailRow",
  "emailColumn",
  "variable",
  "conditional",
];

export function PropertiesPanel({ editor }: PropertiesPanelProps) {
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(
    null
  );
  const { setShowPropertiesPanel } = useTemplateActions();
  const previousNodePosRef = useRef<number | null>(null);

  // Track selection changes
  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateSelection = () => {
      const selection = editor.state.selection;
      const { from } = selection;

      // Check for NodeSelection first (for atom nodes like images, spacers, dividers)
      // NodeSelection is used when clicking directly on atom nodes
      if (selection instanceof NodeSelection) {
        const node = selection.node;
        const nodeType = node.type.name;

        if (CONFIGURABLE_NODES.includes(nodeType)) {
          const nodePos = from;
          setSelectedNode({
            type: nodeType,
            attrs: { ...node.attrs },
            pos: nodePos,
          });

          // Auto-open properties panel when selecting a different configurable node
          if (previousNodePosRef.current !== nodePos) {
            setShowPropertiesPanel(true);
          }
          previousNodePosRef.current = nodePos;
          return;
        }
      }

      // For text selections or other selections, walk up to find parent nodes
      const resolvedPos = editor.state.doc.resolve(from);

      // Walk up from selection to find a relevant node
      for (let depth = resolvedPos.depth; depth >= 0; depth--) {
        const node = resolvedPos.node(depth);
        const nodeType = node.type.name;

        // Check if it's one of our custom nodes
        if (CONFIGURABLE_NODES.includes(nodeType)) {
          const nodePos = resolvedPos.before(depth);
          setSelectedNode({
            type: nodeType,
            attrs: { ...node.attrs },
            pos: nodePos,
          });

          // Auto-open properties panel when selecting a different configurable node
          if (previousNodePosRef.current !== nodePos) {
            setShowPropertiesPanel(true);
          }
          previousNodePosRef.current = nodePos;
          return;
        }
      }

      // No custom node selected
      setSelectedNode(null);
      previousNodePosRef.current = null;
    };

    editor.on("selectionUpdate", updateSelection);
    editor.on("update", updateSelection);

    // Initial check
    updateSelection();

    return () => {
      editor.off("selectionUpdate", updateSelection);
      editor.off("update", updateSelection);
    };
  }, [editor, setShowPropertiesPanel]);

  const updateNodeAttr = useCallback(
    (key: string, value: unknown) => {
      if (!editor || selectedNode === null) {
        return;
      }

      const { pos, type } = selectedNode;

      // Use transaction directly without .focus() to avoid stealing focus from inputs
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(pos, undefined, {
          ...editor.state.doc.nodeAt(pos)?.attrs,
          [key]: value,
        })
      );

      // Update local state
      setSelectedNode((prev) =>
        prev ? { ...prev, attrs: { ...prev.attrs, [key]: value } } : null
      );
    },
    [editor, selectedNode]
  );

  if (!editor) {
    return null;
  }

  return (
    <div className="flex h-full w-72 flex-col overflow-hidden border-l bg-muted/30">
      <div className="shrink-0 border-b p-3">
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          <Settings2 className="h-4 w-4" />
          Properties
        </h3>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {selectedNode ? (
            <div className="space-y-4">
              {/* Node Type Header */}
              <div className="border-b pb-2">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  {formatNodeType(selectedNode.type)}
                </span>
              </div>

              {/* Render properties based on node type */}
              {selectedNode.type === "emailButton" && (
                <ButtonProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "emailSection" && (
                <SectionProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "emailImage" && (
                <ImageProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "emailIcon" && (
                <IconProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "emailDivider" && (
                <DividerProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "emailSpacer" && (
                <SpacerProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "variable" && (
                <VariableProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "conditional" && (
                <ConditionalProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "emailRow" && (
                <RowProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}

              {selectedNode.type === "emailColumn" && (
                <ColumnProperties
                  attrs={selectedNode.attrs}
                  onChange={updateNodeAttr}
                />
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <p>Select an element to edit its properties</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function formatNodeType(type: string): string {
  return type
    .replace(/^email/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

// Property Panels for each node type

type PropertyProps = {
  attrs: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

function ButtonProperties({ attrs, onChange }: PropertyProps) {
  const hasUrl = Boolean(attrs.href);

  return (
    <>
      <PropertySection icon={<Link2 className="h-4 w-4" />} title="Link">
        <div className="space-y-2">
          <Label htmlFor="href">
            Button URL
            {!hasUrl && (
              <span className="ml-2 text-amber-600 text-xs">(required)</span>
            )}
          </Label>
          <Input
            className={
              hasUrl ? "" : "border-amber-300 focus-visible:ring-amber-500"
            }
            id="href"
            onChange={(e) => onChange("href", e.target.value)}
            placeholder="https://example.com"
            value={(attrs.href as string) || ""}
          />
          {!hasUrl && (
            <p className="text-amber-600 text-xs">
              Add a URL for the button to link to
            </p>
          )}
        </div>
      </PropertySection>

      <PropertySection icon={<Palette className="h-4 w-4" />} title="Colors">
        <div className="space-y-3">
          <TailwindColorPicker
            label="Background"
            onChange={(v) => onChange("backgroundColor", v)}
            value={(attrs.backgroundColor as string) || "#5046e5"}
          />
          <TailwindColorPicker
            label="Text"
            onChange={(v) => onChange("color", v)}
            value={(attrs.color as string) || "#ffffff"}
          />
        </div>
      </PropertySection>

      <PropertySection icon={<Type className="h-4 w-4" />} title="Typography">
        <div className="space-y-3">
          <PresetSelector
            label="Font Size"
            onChange={(v) => onChange("fontSize", v)}
            presets={fontSizePresets}
            value={(attrs.fontSize as string) || "14px"}
          />
          <PresetSelector
            label="Font Weight"
            onChange={(v) => onChange("fontWeight", v)}
            presets={fontWeightPresets}
            value={(attrs.fontWeight as string) || "600"}
          />
        </div>
      </PropertySection>

      <PropertySection icon={<Layout className="h-4 w-4" />} title="Layout">
        <div className="space-y-3">
          <PresetSelector
            label="Padding"
            onChange={(v) => onChange("padding", v)}
            presets={[
              { label: "SM", value: "8px 16px" },
              { label: "MD", value: "12px 24px" },
              { label: "LG", value: "16px 32px" },
              { label: "XL", value: "20px 40px" },
            ]}
            value={(attrs.padding as string) || "12px 24px"}
          />
          <PresetSelector
            label="Border Radius"
            onChange={(v) => onChange("borderRadius", v)}
            presets={borderRadiusPresets}
            value={(attrs.borderRadius as string) || "6px"}
          />
          <div className="space-y-2">
            <Label>Alignment</Label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    (attrs.align as string) === align ||
                    (!attrs.align && align === "left")
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                  key={align}
                  onClick={() => onChange("align", align)}
                  type="button"
                >
                  {align.charAt(0).toUpperCase() + align.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PropertySection>
    </>
  );
}

function SectionProperties({ attrs, onChange }: PropertyProps) {
  return (
    <>
      <PropertySection
        icon={<Palette className="h-4 w-4" />}
        title="Background"
      >
        <TailwindColorPicker
          label="Background Color"
          onChange={(v) => onChange("backgroundColor", v)}
          value={(attrs.backgroundColor as string) || "#ffffff"}
        />
      </PropertySection>

      <PropertySection icon={<Layout className="h-4 w-4" />} title="Layout">
        <div className="space-y-3">
          <PresetSelector
            label="Max Width"
            onChange={(v) => onChange("maxWidth", v)}
            presets={[
              { label: "SM", value: "480px" },
              { label: "MD", value: "600px" },
              { label: "LG", value: "720px" },
              { label: "Full", value: "100%" },
            ]}
            value={(attrs.maxWidth as string) || "600px"}
          />
          <PresetSelector
            label="Padding"
            onChange={(v) => onChange("padding", v)}
            presets={paddingPresets}
            value={(attrs.padding as string) || "32px 24px"}
          />
          <PresetSelector
            label="Border Radius"
            onChange={(v) => onChange("borderRadius", v)}
            presets={borderRadiusPresets}
            value={(attrs.borderRadius as string) || "0px"}
          />
        </div>
      </PropertySection>
    </>
  );
}

function ImageProperties({ attrs, onChange }: PropertyProps) {
  const hasLink = Boolean(attrs.href);

  return (
    <>
      {/* Link section first for prominence */}
      <PropertySection icon={<Link2 className="h-4 w-4" />} title="Link">
        <div className="space-y-2">
          <Label>
            Click URL
            {!hasLink && (
              <span className="ml-2 text-muted-foreground text-xs">
                (optional)
              </span>
            )}
          </Label>
          <Input
            className={hasLink ? "border-green-300" : ""}
            onChange={(e) => onChange("href", e.target.value || null)}
            placeholder="https://example.com"
            value={(attrs.href as string) || ""}
          />
          <p className="text-muted-foreground text-xs">
            {hasLink ? "Image is clickable" : "Add URL to make image clickable"}
          </p>
        </div>
      </PropertySection>

      <PropertySection icon={<Layout className="h-4 w-4" />} title="Image">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input
              onChange={(e) => onChange("src", e.target.value)}
              placeholder="https://example.com/image.jpg"
              value={(attrs.src as string) || ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Alt Text</Label>
            <Input
              onChange={(e) => onChange("alt", e.target.value)}
              placeholder="Describe the image"
              value={(attrs.alt as string) || ""}
            />
          </div>
        </div>
      </PropertySection>

      <PropertySection icon={<Layout className="h-4 w-4" />} title="Size">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Width (px)</Label>
              <Input
                onChange={(e) =>
                  onChange(
                    "width",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="Auto"
                type="number"
                value={(attrs.width as number) || ""}
              />
            </div>
            <div className="space-y-2">
              <Label>Height (px)</Label>
              <Input
                onChange={(e) =>
                  onChange(
                    "height",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="Auto"
                type="number"
                value={(attrs.height as number) || ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Alignment</Label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    (attrs.align as string) === align ||
                    (!attrs.align && align === "center")
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                  key={align}
                  onClick={() => onChange("align", align)}
                  type="button"
                >
                  {align.charAt(0).toUpperCase() + align.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PropertySection>

      <PropertySection icon={<Palette className="h-4 w-4" />} title="Style">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Border Radius</Label>
            <div className="flex gap-1">
              {[
                { label: "None", value: "0px" },
                { label: "SM", value: "4px" },
                { label: "MD", value: "8px" },
                { label: "LG", value: "12px" },
                { label: "Full", value: "9999px" },
              ].map((option) => (
                <button
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    (attrs.borderRadius as string) === option.value ||
                    (!attrs.borderRadius && option.value === "0px")
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                  key={option.value}
                  onClick={() => onChange("borderRadius", option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Object Fit</Label>
            <div className="flex gap-1">
              {(["contain", "cover", "fill"] as const).map((fit) => (
                <button
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
                    (attrs.objectFit as string) === fit ||
                    (!attrs.objectFit && fit === "contain")
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                  key={fit}
                  onClick={() => onChange("objectFit", fit)}
                  type="button"
                >
                  {fit}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              How the image fills its container
            </p>
          </div>
        </div>
      </PropertySection>
    </>
  );
}

const ICON_OPTIONS = [
  { name: "check", label: "Check" },
  { name: "star", label: "Star" },
  { name: "heart", label: "Heart" },
  { name: "zap", label: "Zap" },
  { name: "shield", label: "Shield" },
  { name: "award", label: "Award" },
  { name: "target", label: "Target" },
  { name: "trending-up", label: "Trending" },
  { name: "thumbs-up", label: "Thumbs Up" },
  { name: "gift", label: "Gift" },
  { name: "clock", label: "Clock" },
  { name: "lock", label: "Lock" },
  { name: "globe", label: "Globe" },
  { name: "sparkles", label: "Sparkles" },
  { name: "rocket", label: "Rocket" },
  { name: "lightbulb", label: "Lightbulb" },
];

// Generate Icons8 PNG URL for an icon
function getIconUrl(icon: string, color: string, size = 24): string {
  const iconNameMap: Record<string, string> = {
    check: "checkmark",
    star: "star",
    heart: "like",
    zap: "flash-on",
    shield: "shield",
    award: "prize",
    target: "goal",
    "trending-up": "graph",
    "thumbs-up": "thumb-up",
    gift: "gift",
    clock: "clock",
    lock: "lock",
    globe: "globe",
    sparkles: "sparkling",
    rocket: "rocket",
    lightbulb: "light-on",
  };
  const icons8Name = iconNameMap[icon] || "checkmark";
  const colorHex = color.replace("#", "");
  return `https://img.icons8.com/ios-filled/${size * 2}/${colorHex}/${icons8Name}.png`;
}

function IconProperties({ attrs, onChange }: PropertyProps) {
  return (
    <>
      <PropertySection icon={<Layout className="h-4 w-4" />} title="Icon">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-4 gap-1">
              {ICON_OPTIONS.map(({ name, label }) => (
                <button
                  className={`flex h-8 items-center justify-center rounded-md border transition-colors ${
                    (attrs.icon as string) === name
                      ? "border-primary bg-primary"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                  key={name}
                  onClick={() => onChange("icon", name)}
                  title={label}
                  type="button"
                >
                  <img
                    alt={label}
                    className="h-4 w-4"
                    src={getIconUrl(
                      name,
                      (attrs.icon as string) === name ? "ffffff" : "000000",
                      16
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Size</Label>
            <div className="flex gap-1">
              {[32, 40, 48, 56, 64].map((size) => (
                <button
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    (attrs.size as number) === size
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                  key={size}
                  onClick={() => onChange("size", size)}
                  type="button"
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Alignment</Label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    (attrs.align as string) === align ||
                    (!attrs.align && align === "left")
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                  key={align}
                  onClick={() => onChange("align", align)}
                  type="button"
                >
                  {align.charAt(0).toUpperCase() + align.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PropertySection>

      <PropertySection icon={<Palette className="h-4 w-4" />} title="Colors">
        <div className="space-y-3">
          <TailwindColorPicker
            label="Icon Color"
            onChange={(v) => onChange("iconColor", v)}
            value={(attrs.iconColor as string) || "#3b82f6"}
          />
          <TailwindColorPicker
            label="Background Color"
            onChange={(v) => onChange("backgroundColor", v)}
            value={(attrs.backgroundColor as string) || "#dbeafe"}
          />
        </div>
      </PropertySection>
    </>
  );
}

function DividerProperties({ attrs, onChange }: PropertyProps) {
  return (
    <PropertySection icon={<Layout className="h-4 w-4" />} title="Style">
      <div className="space-y-3">
        <TailwindColorPicker
          label="Color"
          onChange={(v) => onChange("borderColor", v)}
          value={(attrs.borderColor as string) || "#e5e7eb"}
        />
        <PresetSelector
          label="Thickness"
          onChange={(v) => onChange("borderWidth", v)}
          presets={[
            { label: "Thin", value: "1px" },
            { label: "Medium", value: "2px" },
            { label: "Thick", value: "4px" },
          ]}
          value={(attrs.borderWidth as string) || "1px"}
        />
        <PresetSelector
          label="Margin"
          onChange={(v) => onChange("margin", v)}
          presets={paddingPresets}
          value={(attrs.margin as string) || "24px 0"}
        />
      </div>
    </PropertySection>
  );
}

function RowProperties({ attrs, onChange }: PropertyProps) {
  return (
    <PropertySection icon={<Layout className="h-4 w-4" />} title="Layout">
      <div className="space-y-3">
        <PresetSelector
          label="Gap"
          onChange={(v) => onChange("gap", v)}
          presets={gapPresets}
          value={(attrs.gap as string) || "16px"}
        />
        <div className="space-y-2">
          <Label>Vertical Alignment</Label>
          <div className="flex gap-1">
            {(["top", "middle", "bottom"] as const).map((align) => (
              <button
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  (attrs.align as string) === align ||
                  (!attrs.align && align === "top")
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
                key={align}
                onClick={() => onChange("align", align)}
                type="button"
              >
                {align.charAt(0).toUpperCase() + align.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PropertySection>
  );
}

function ColumnProperties({ attrs, onChange }: PropertyProps) {
  return (
    <>
      <PropertySection icon={<Layout className="h-4 w-4" />} title="Size">
        <div className="space-y-3">
          <PresetSelector
            label="Width"
            onChange={(v) => onChange("width", v)}
            presets={[
              { label: "Auto", value: "auto" },
              { label: "Full", value: "100%" },
              { label: "3/4", value: "75%" },
              { label: "2/3", value: "66.67%" },
              { label: "Half", value: "50%" },
              { label: "1/3", value: "33.33%" },
              { label: "1/4", value: "25%" },
            ]}
            value={(attrs.width as string) || "50%"}
          />
          <PresetSelector
            label="Padding"
            onChange={(v) => onChange("padding", v)}
            presets={paddingPresets}
            value={(attrs.padding as string) || "0px"}
          />
          <div className="space-y-2">
            <Label>Vertical Align</Label>
            <div className="flex gap-1">
              {(["top", "middle", "bottom"] as const).map((align) => (
                <button
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    (attrs.verticalAlign as string) === align ||
                    (!attrs.verticalAlign && align === "top")
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                  key={align}
                  onClick={() => onChange("verticalAlign", align)}
                  type="button"
                >
                  {align.charAt(0).toUpperCase() + align.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PropertySection>

      <PropertySection
        icon={<Palette className="h-4 w-4" />}
        title="Background"
      >
        <TailwindColorPicker
          label="Background Color"
          onChange={(v) => onChange("backgroundColor", v)}
          value={(attrs.backgroundColor as string) || "transparent"}
        />
      </PropertySection>
    </>
  );
}

function SpacerProperties({ attrs, onChange }: PropertyProps) {
  const heightValue =
    typeof attrs.height === "number"
      ? attrs.height
      : Number.parseInt((attrs.height as string) || "24", 10);

  return (
    <PropertySection icon={<Layout className="h-4 w-4" />} title="Size">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Height: {heightValue}px</Label>
          <Slider
            max={120}
            min={8}
            onValueChange={(values: number[]) => onChange("height", values[0])}
            step={4}
            value={[heightValue]}
          />
        </div>
        <div className="flex gap-1">
          {[16, 24, 32, 48, 64].map((h) => (
            <button
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                heightValue === h
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent"
              }`}
              key={h}
              onClick={() => onChange("height", h)}
              type="button"
            >
              {h}
            </button>
          ))}
        </div>
      </div>
    </PropertySection>
  );
}

function VariableProperties({ attrs, onChange }: PropertyProps) {
  return (
    <PropertySection icon={<Type className="h-4 w-4" />} title="Variable">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="firstName"
            value={(attrs.name as string) || ""}
          />
        </div>
        <div className="space-y-2">
          <Label>Display Label</Label>
          <Input
            onChange={(e) => onChange("label", e.target.value)}
            placeholder="First Name"
            value={(attrs.label as string) || ""}
          />
        </div>
        <div className="space-y-2">
          <Label>Fallback Value</Label>
          <Input
            onChange={(e) => onChange("fallback", e.target.value)}
            placeholder="there"
            value={(attrs.fallback as string) || ""}
          />
          <p className="text-muted-foreground text-xs">
            Used when the variable is not provided
          </p>
        </div>
      </div>
    </PropertySection>
  );
}

function ConditionalProperties({ attrs, onChange }: PropertyProps) {
  const operator = (attrs.operator as string) || "equals";
  const needsValue = !["exists", "notExists"].includes(operator);

  return (
    <PropertySection icon={<Layout className="h-4 w-4" />} title="Condition">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Variable</Label>
          <Input
            onChange={(e) => onChange("variable", e.target.value)}
            placeholder="isPremium"
            value={(attrs.variable as string) || ""}
          />
        </div>
        <div className="space-y-2">
          <Label>Operator</Label>
          <Select
            onValueChange={(v) => onChange("operator", v)}
            value={operator}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="notEquals">Does not equal</SelectItem>
              <SelectItem value="exists">Exists</SelectItem>
              <SelectItem value="notExists">Does not exist</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="greaterThan">Is greater than</SelectItem>
              <SelectItem value="lessThan">Is less than</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {needsValue && (
          <div className="space-y-2">
            <Label>Value</Label>
            <Input
              onChange={(e) => onChange("value", e.target.value)}
              placeholder="true"
              value={(attrs.value as string) || ""}
            />
          </div>
        )}
      </div>
    </PropertySection>
  );
}

// Helper component for property sections
function PropertySection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-medium text-sm">
        {icon}
        {title}
      </div>
      {children}
      <Separator className="my-4" />
    </div>
  );
}
