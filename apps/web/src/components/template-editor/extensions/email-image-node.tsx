"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Label } from "@wraps/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@wraps/ui/components/ui/popover";
import { ExternalLink, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getImageWithPlaceholder,
  isVariablePlaceholder,
} from "@/lib/brand-kit/placeholders";
import { DragHandle } from "./drag-handle";

export type EmailImageAttributes = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  align: "left" | "center" | "right";
  href: string | null;
  borderRadius: string;
  objectFit: "contain" | "cover" | "fill" | "none" | "scale-down";
};

declare module "@tiptap/core" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: interface required for module augmentation
  interface Commands<ReturnType> {
    emailImage: {
      insertEmailImage: (
        attributes?: Partial<EmailImageAttributes>
      ) => ReturnType;
      updateEmailImage: (
        attributes: Partial<EmailImageAttributes>
      ) => ReturnType;
    };
  }
}

const EmailImageNodeView = ({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}: NodeViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const attrs = node.attrs as EmailImageAttributes;

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

  // Check if src is empty or an unresolved variable
  const hasValidSrc = attrs.src && !isVariablePlaceholder(attrs.src);
  // Get the display src (original or placeholder)
  const displaySrc = getImageWithPlaceholder(attrs.src, "generic");
  // Show placeholder indicator if using a placeholder
  const isUsingPlaceholder = !hasValidSrc;

  return (
    <NodeViewWrapper
      className={`email-image-wrapper my-4 cursor-pointer ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onClick={handleClick}
      style={{ textAlign: attrs.align }}
    >
      <div className="group relative inline-block">
        <div className="relative">
          <img
            alt={attrs.alt || "Image placeholder"}
            className={`max-w-full ${isUsingPlaceholder ? "opacity-75" : ""}`}
            height={attrs.height || undefined}
            src={displaySrc}
            style={{
              maxWidth: "100%",
              borderRadius: attrs.borderRadius || "0px",
              objectFit: attrs.objectFit || "contain",
              height: attrs.height ? `${attrs.height}px` : "auto",
            }}
            width={attrs.width || undefined}
          />
          {isUsingPlaceholder && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-md bg-black/50 px-2 py-1 font-medium text-white text-xs">
                {attrs.src ? "Set image URL" : "Click to add image"}
              </span>
            </div>
          )}
          {attrs.href && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-primary/90 px-1.5 py-0.5 text-primary-foreground text-xs">
              <ExternalLink className="h-3 w-3" />
              <span>Linked</span>
            </div>
          )}
        </div>

        {/* Drag handle and edit button */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <DragHandle />
          <Popover onOpenChange={setIsEditing} open={isEditing}>
            <PopoverTrigger asChild>
              <Button
                aria-label="Edit image settings"
                className="h-6 w-6"
                size="icon"
                variant="secondary"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Image Settings</h4>

                <div className="space-y-2">
                  <Label htmlFor="src">Image URL</Label>
                  <Input
                    id="src"
                    onChange={(e) => updateAttributes({ src: e.target.value })}
                    placeholder="https://example.com/image.png"
                    value={attrs.src}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alt">Alt Text</Label>
                  <Input
                    id="alt"
                    onChange={(e) => updateAttributes({ alt: e.target.value })}
                    placeholder="Describe the image"
                    value={attrs.alt}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="href">Link URL (optional)</Label>
                  <Input
                    id="href"
                    onChange={(e) =>
                      updateAttributes({
                        href: e.target.value || null,
                      })
                    }
                    placeholder="https://example.com"
                    value={attrs.href || ""}
                  />
                  <p className="text-muted-foreground text-xs">
                    Make the image clickable
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width">Width (px)</Label>
                    <Input
                      id="width"
                      onChange={(e) =>
                        updateAttributes({
                          width: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Auto"
                      type="number"
                      value={attrs.width || ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height">Height (px)</Label>
                    <Input
                      id="height"
                      onChange={(e) =>
                        updateAttributes({
                          height: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      placeholder="Auto"
                      type="number"
                      value={attrs.height || ""}
                    />
                  </div>
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="borderRadius">Border Radius</Label>
                  <div className="flex gap-2">
                    {["0px", "4px", "8px", "12px", "9999px"].map((radius) => (
                      <Button
                        className="flex-1"
                        key={radius}
                        onClick={() =>
                          updateAttributes({ borderRadius: radius })
                        }
                        size="sm"
                        variant={
                          attrs.borderRadius === radius ? "default" : "outline"
                        }
                      >
                        {radius === "9999px" ? "Full" : radius}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Object Fit</Label>
                  <div className="flex gap-2">
                    {(["contain", "cover", "fill"] as const).map((fit) => (
                      <Button
                        className="flex-1 capitalize"
                        key={fit}
                        onClick={() => updateAttributes({ objectFit: fit })}
                        size="sm"
                        variant={
                          attrs.objectFit === fit ? "default" : "outline"
                        }
                      >
                        {fit}
                      </Button>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    How the image fills its container
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const EmailImageNode = Node.create({
  name: "emailImage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      width: { default: null },
      height: { default: null },
      align: { default: "center" },
      href: { default: null },
      borderRadius: { default: "0px" },
      objectFit: { default: "contain" },
    };
  },

  parseHTML() {
    return [{ tag: "email-image" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["email-image", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmailImageNodeView);
  },

  addCommands() {
    return {
      insertEmailImage:
        (attributes = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
      updateEmailImage:
        (attributes) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attributes),
    };
  },
});
