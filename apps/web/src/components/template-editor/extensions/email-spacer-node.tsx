"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { MoveVertical } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DragHandle } from "./drag-handle";

export type EmailSpacerAttributes = {
  height: number;
};

declare module "@tiptap/core" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: interface required for module augmentation
  interface Commands<ReturnType> {
    emailSpacer: {
      insertEmailSpacer: (
        attributes?: Partial<EmailSpacerAttributes>
      ) => ReturnType;
    };
  }
}

const EmailSpacerNodeView = ({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}: NodeViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const attrs = node.attrs as EmailSpacerAttributes;

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

  return (
    <NodeViewWrapper
      className={`email-spacer-wrapper group relative cursor-pointer ${selected ? "rounded ring-2 ring-primary ring-offset-2" : ""}`}
      onClick={handleClick}
    >
      <div
        className="relative rounded border border-muted-foreground/20 border-dashed bg-muted/30"
        style={{ height: `${attrs.height}px` }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded bg-background px-2 text-muted-foreground text-xs">
            {attrs.height}px spacer
          </span>
        </div>
      </div>

      {/* Drag handle and settings button */}
      <div className="-translate-y-1/2 absolute top-1/2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <DragHandle />
        <Popover onOpenChange={setIsEditing} open={isEditing}>
          <PopoverTrigger asChild>
            <Button aria-label="Edit spacer settings" className="h-6 w-6" size="icon" variant="secondary">
              <MoveVertical className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="space-y-4">
              <h4 className="font-medium">Spacer Settings</h4>

              <div className="space-y-2">
                <Label htmlFor="height">Height (px)</Label>
                <Input
                  id="height"
                  min={1}
                  onChange={(e) =>
                    updateAttributes({ height: Number(e.target.value) || 24 })
                  }
                  type="number"
                  value={attrs.height}
                />
              </div>

              <div className="flex gap-2">
                {[16, 24, 32, 48, 64].map((h) => (
                  <Button
                    key={h}
                    onClick={() => updateAttributes({ height: h })}
                    size="sm"
                    variant={attrs.height === h ? "default" : "outline"}
                  >
                    {h}
                  </Button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </NodeViewWrapper>
  );
};

export const EmailSpacerNode = Node.create({
  name: "emailSpacer",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      height: { default: 24 },
    };
  },

  parseHTML() {
    return [{ tag: "email-spacer" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["email-spacer", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmailSpacerNodeView);
  },

  addCommands() {
    return {
      insertEmailSpacer:
        (attributes = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },
});
