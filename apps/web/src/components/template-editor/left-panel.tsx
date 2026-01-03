"use client";

import type { Editor } from "@tiptap/react";
import { useLeftPanelTab } from "@/stores/template-store";
import { AIChatPanel } from "./ai-chat-panel";
import { BlockPalette } from "./block-palette";

type LeftPanelProps = {
  editor: Editor | null;
  orgSlug: string;
  templateId: string;
};

export function LeftPanel({ editor, orgSlug, templateId }: LeftPanelProps) {
  const leftPanelTab = useLeftPanelTab();

  return (
    <div className="flex h-full w-80 flex-col border-r bg-background">
      {/* Panel content - controlled by toolbar buttons */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {leftPanelTab === "ai" ? (
          <AIChatPanel
            asSidePanel
            editor={editor}
            orgSlug={orgSlug}
            templateId={templateId}
          />
        ) : (
          <BlockPalette editor={editor} orgSlug={orgSlug} />
        )}
      </div>
    </div>
  );
}
