"use client";

import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Editor } from "@tiptap/react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { BlockItem } from "./block-palette";

type DraggedBlock = {
  block: BlockItem;
  brandKit?: unknown;
};

type DropIndicator = {
  top: number;
  left: number;
  width: number;
} | null;

type EditorDndContextValue = {
  isDragging: boolean;
  draggedBlock: DraggedBlock | null;
  dropIndicator: DropIndicator;
};

const EditorDndContext = createContext<EditorDndContextValue>({
  isDragging: false,
  draggedBlock: null,
  dropIndicator: null,
});

export function useEditorDnd() {
  return useContext(EditorDndContext);
}

type EditorDndProviderProps = {
  children: React.ReactNode;
  editor: Editor | null;
  brandKit?: unknown;
};

/**
 * Calculate where to show the drop indicator line
 */
function calculateDropIndicator(
  editor: Editor,
  x: number,
  y: number
): DropIndicator {
  const editorView = editor.view;
  const editorDOM = editorView.dom;
  const editorRect = editorDOM.getBoundingClientRect();

  // Check if within editor bounds
  if (
    x < editorRect.left ||
    x > editorRect.right ||
    y < editorRect.top ||
    y > editorRect.bottom
  ) {
    return null;
  }

  // Find all block-level elements and determine which gap we're closest to
  const blockSelectors = [
    ".ProseMirror > *",
    ".email-section-wrapper",
    ".email-section > *",
    ".email-column > *",
    ".email-row-wrapper",
  ].join(", ");

  const blocks = editorDOM.querySelectorAll(blockSelectors);
  let closestGap: {
    top: number;
    left: number;
    width: number;
    distance: number;
  } | null = null;

  for (const block of blocks) {
    const rect = block.getBoundingClientRect();

    // Check gap before this element
    const topGap = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      distance: Math.abs(y - rect.top),
    };

    // Check gap after this element
    const bottomGap = {
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
      distance: Math.abs(y - rect.bottom),
    };

    // Only consider if x is within the block's horizontal bounds (with some padding)
    const horizontalPadding = 50;
    if (
      x >= rect.left - horizontalPadding &&
      x <= rect.right + horizontalPadding
    ) {
      if (!closestGap || topGap.distance < closestGap.distance) {
        closestGap = topGap;
      }
      if (!closestGap || bottomGap.distance < closestGap.distance) {
        closestGap = bottomGap;
      }
    }
  }

  if (closestGap && closestGap.distance < 50) {
    return {
      top: closestGap.top,
      left: closestGap.left,
      width: closestGap.width,
    };
  }

  return null;
}

/**
 * Find the best position to insert content based on coordinates
 */
function findInsertPosition(editor: Editor, x: number, y: number): number {
  const editorView = editor.view;
  const editorDOM = editorView.dom;
  const editorRect = editorDOM.getBoundingClientRect();

  // If outside editor, return end position
  if (
    x < editorRect.left ||
    x > editorRect.right ||
    y < editorRect.top ||
    y > editorRect.bottom
  ) {
    return editor.state.doc.content.size;
  }

  // Get position from coordinates
  const posInfo = editorView.posAtCoords({ left: x, top: y });
  if (!posInfo) {
    return editor.state.doc.content.size;
  }

  // Resolve the position and find the nearest block boundary
  const resolvedPos = editor.state.doc.resolve(posInfo.pos);

  // Walk up to find a position where we can insert block content
  let insertPos = posInfo.pos;

  // Try to find the end of the current block or start of next block
  for (let depth = resolvedPos.depth; depth >= 0; depth--) {
    const node = resolvedPos.node(depth);
    const nodeSpec = node.type.spec;

    // Check if parent can contain block content
    if (nodeSpec.content && /block/.test(nodeSpec.content)) {
      // Get the position after the current child node at this level
      const indexInParent = resolvedPos.index(depth);
      const parentStart = resolvedPos.start(depth);

      let posAfterChild = parentStart;
      for (let i = 0; i <= indexInParent && i < node.childCount; i++) {
        posAfterChild += node.child(i).nodeSize;
      }

      insertPos = posAfterChild;
      break;
    }
  }

  return insertPos;
}

export function EditorDndProvider({
  children,
  editor,
  brandKit,
}: EditorDndProviderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<DraggedBlock | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
  const lastPointerPosition = useRef<{ x: number; y: number } | null>(null);

  // Configure sensors with activation constraints to prevent accidental drags
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  });

  const sensors = useSensors(pointerSensor, mouseSensor, touchSensor);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const block = event.active.data.current?.block as BlockItem | undefined;
      if (block) {
        setIsDragging(true);
        setDraggedBlock({ block, brandKit });
      }
    },
    [brandKit]
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!editor) {
        return;
      }

      // Get pointer coordinates from the event
      const { activatorEvent } = event;
      let x: number;
      let y: number;

      if (activatorEvent instanceof MouseEvent) {
        x = activatorEvent.clientX + (event.delta?.x ?? 0);
        y = activatorEvent.clientY + (event.delta?.y ?? 0);
      } else if (
        activatorEvent instanceof TouchEvent &&
        activatorEvent.touches[0]
      ) {
        x = activatorEvent.touches[0].clientX + (event.delta?.x ?? 0);
        y = activatorEvent.touches[0].clientY + (event.delta?.y ?? 0);
      } else {
        // Fallback: use the active element's rect
        const activeRect = event.active.rect.current.translated;
        if (activeRect) {
          x = activeRect.left + activeRect.width / 2;
          y = activeRect.top + activeRect.height / 2;
        } else {
          return;
        }
      }

      lastPointerPosition.current = { x, y };

      // Calculate drop indicator position
      const indicator = calculateDropIndicator(editor, x, y);
      setDropIndicator(indicator);
    },
    [editor]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active } = event;

      try {
        if (editor && lastPointerPosition.current) {
          const block = active.data.current?.block as BlockItem | undefined;
          if (block) {
            const { x, y } = lastPointerPosition.current;

            // Check if we're over the editor
            const editorRect = editor.view.dom.getBoundingClientRect();
            if (
              x >= editorRect.left &&
              x <= editorRect.right &&
              y >= editorRect.top &&
              y <= editorRect.bottom
            ) {
              // Find insert position and insert the block
              const insertPos = findInsertPosition(editor, x, y);

              // Set selection to insert position
              editor.commands.setTextSelection(insertPos);

              // Insert the block
              block.action(
                editor,
                brandKit as Parameters<BlockItem["action"]>[1]
              );
            }
          }
        }
      } finally {
        setIsDragging(false);
        setDraggedBlock(null);
        setDropIndicator(null);
        lastPointerPosition.current = null;
      }
    },
    [editor, brandKit]
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setDraggedBlock(null);
    setDropIndicator(null);
    lastPointerPosition.current = null;
  }, []);

  return (
    <DndContext
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <EditorDndContext.Provider
        value={{ isDragging, draggedBlock, dropIndicator }}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {draggedBlock ? (
            <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 shadow-lg">
              <div className="flex-shrink-0 text-muted-foreground">
                {draggedBlock.block.icon}
              </div>
              <div className="font-medium text-sm">
                {draggedBlock.block.name}
              </div>
            </div>
          ) : null}
        </DragOverlay>
        {/* Drop indicator line */}
        {dropIndicator && (
          <div
            className="pointer-events-none fixed z-50 h-0.5 bg-primary"
            style={{
              top: dropIndicator.top,
              left: dropIndicator.left,
              width: dropIndicator.width,
              transform: "translateY(-50%)",
            }}
          />
        )}
      </EditorDndContext.Provider>
    </DndContext>
  );
}
