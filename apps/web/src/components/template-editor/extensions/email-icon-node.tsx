"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TailwindColorPicker } from "@/components/ui/tailwind-color-picker";
import { DragHandle } from "./drag-handle";

// Common icons available for selection
// Using Lucide icon names that map to Iconify lucide: prefix
export const AVAILABLE_ICONS = [
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
] as const;

export type IconName = (typeof AVAILABLE_ICONS)[number]["name"];

export type EmailIconAttributes = {
  icon: IconName;
  size: number;
  iconColor: string;
  backgroundColor: string;
  align: "left" | "center" | "right";
};

declare module "@tiptap/core" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: interface required for module augmentation
  interface Commands<ReturnType> {
    emailIcon: {
      insertEmailIcon: (
        attributes?: Partial<EmailIconAttributes>
      ) => ReturnType;
      updateEmailIcon: (attributes: Partial<EmailIconAttributes>) => ReturnType;
    };
  }
}

// Map our icon names to Icons8 icon names
export const ICON_NAME_MAP: Record<string, string> = {
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

// Generate Icons8 PNG URL for an icon
export function getIconUrl(icon: string, color: string, size = 48): string {
  const icons8Name = ICON_NAME_MAP[icon] || "checkmark";
  const colorHex = color.replace("#", "");
  // Request 2x size for retina displays
  return `https://img.icons8.com/ios-filled/${size * 2}/${colorHex}/${icons8Name}.png`;
}

// Keep old function name for backwards compatibility
export function getIconifyUrl(icon: string, color: string): string {
  return getIconUrl(icon, color, 48);
}

const EmailIconNodeView = ({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}: NodeViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const attrs = node.attrs as EmailIconAttributes;

  // Click handler to select this node (for properties panel)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't select if clicking on the edit button or popover
      if ((e.target as HTMLElement).closest("button, [role='dialog']")) {
        return;
      }

      const pos = getPos();
      if (typeof pos !== "number") {
        return;
      }

      // Create a NodeSelection at this node's position
      const tr = editor.state.tr.setSelection(
        NodeSelection.create(editor.state.doc, pos)
      );
      editor.view.dispatch(tr);
    },
    [editor, getPos]
  );

  // Calculate icon size (icon is smaller than container to leave room for background)
  const iconImgSize = Math.round(attrs.size * 0.55);
  const iconUrl = getIconUrl(attrs.icon, attrs.iconColor, iconImgSize);

  return (
    <NodeViewWrapper
      className={`email-icon-wrapper my-2 cursor-pointer ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onClick={handleClick}
      style={{ textAlign: attrs.align }}
    >
      <div className="group relative inline-block">
        <div
          style={{
            width: attrs.size,
            height: attrs.size,
            backgroundColor: attrs.backgroundColor,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            alt={attrs.icon}
            src={iconUrl}
            style={{
              width: iconImgSize,
              height: iconImgSize,
            }}
          />
        </div>

        {/* Drag handle and edit button */}
        <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <DragHandle />
          <Popover onOpenChange={setIsEditing} open={isEditing}>
            <PopoverTrigger asChild>
              <Button className="h-6 w-6" size="icon" variant="secondary">
                <Pencil className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Icon Settings</h4>

                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {AVAILABLE_ICONS.map(({ name, label }) => (
                      <Button
                        className="h-10 w-full p-1"
                        key={name}
                        onClick={() => updateAttributes({ icon: name })}
                        size="sm"
                        title={label}
                        variant={attrs.icon === name ? "default" : "outline"}
                      >
                        <img
                          alt={label}
                          className="h-5 w-5"
                          src={getIconUrl(
                            name,
                            attrs.icon === name ? "ffffff" : "000000",
                            20
                          )}
                        />
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Size</Label>
                  <div className="flex gap-2">
                    {[32, 40, 48, 56, 64].map((size) => (
                      <Button
                        className="flex-1"
                        key={size}
                        onClick={() => updateAttributes({ size })}
                        size="sm"
                        variant={attrs.size === size ? "default" : "outline"}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>

                <TailwindColorPicker
                  label="Icon Color"
                  onChange={(v) => updateAttributes({ iconColor: v })}
                  value={attrs.iconColor}
                />

                <TailwindColorPicker
                  label="Background Color"
                  onChange={(v) => updateAttributes({ backgroundColor: v })}
                  value={attrs.backgroundColor}
                />

                <div className="space-y-2">
                  <Label>Alignment</Label>
                  <div className="flex gap-2">
                    {(["left", "center", "right"] as const).map((alignment) => (
                      <Button
                        className="flex-1 capitalize"
                        key={alignment}
                        onClick={() => updateAttributes({ align: alignment })}
                        size="sm"
                        variant={
                          attrs.align === alignment ? "default" : "outline"
                        }
                      >
                        {alignment}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const EmailIconNode = Node.create({
  name: "emailIcon",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      icon: { default: "check" },
      size: { default: 48 },
      iconColor: { default: "#3b82f6" },
      backgroundColor: { default: "#dbeafe" },
      align: { default: "left" },
    };
  },

  parseHTML() {
    return [{ tag: "email-icon" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["email-icon", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmailIconNodeView);
  },

  addCommands() {
    return {
      insertEmailIcon:
        (attributes = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
      updateEmailIcon:
        (attributes) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attributes),
    };
  },
});
