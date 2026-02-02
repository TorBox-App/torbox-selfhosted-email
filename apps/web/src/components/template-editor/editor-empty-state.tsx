"use client";

import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import {
  FileText,
  Gift,
  LayoutGrid,
  Mail,
  Megaphone,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTemplateStore } from "@/stores/template-store";

type QuickStartTemplate = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  content: JSONContent;
};

const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: "welcome",
    name: "Welcome Email",
    description: "Greet new users",
    icon: <Mail className="h-5 w-5" />,
    content: {
      type: "doc",
      content: [
        {
          type: "emailPreview",
          attrs: { text: "Welcome to our community!" },
        },
        {
          type: "heading",
          attrs: { level: 1, textAlign: "center" },
          content: [{ type: "text", text: "Welcome aboard! 👋" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hi " },
            {
              type: "variable",
              attrs: {
                name: "firstName",
                label: "First Name",
                fallback: "there",
              },
            },
            { type: "text", text: "," },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Thanks for joining us! We're excited to have you on board.",
            },
          ],
        },
        {
          type: "emailButton",
          attrs: {
            text: "Get Started",
            href: "https://example.com/start",
            backgroundColor: "#5046e5",
            color: "#ffffff",
            align: "center",
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "If you have any questions, just reply to this email.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Weekly updates",
    icon: <FileText className="h-5 w-5" />,
    content: {
      type: "doc",
      content: [
        {
          type: "emailPreview",
          attrs: { text: "This week's highlights and updates" },
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Weekly Newsletter" }],
        },
        {
          type: "emailDivider",
          attrs: { borderColor: "#e5e7eb", borderWidth: "1px" },
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "📰 This Week's Highlights" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Highlight item 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Highlight item 2" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Highlight item 3" }],
                },
              ],
            },
          ],
        },
        {
          type: "emailButton",
          attrs: {
            text: "Read More",
            href: "https://example.com/blog",
            backgroundColor: "#5046e5",
            color: "#ffffff",
            align: "left",
          },
        },
      ],
    },
  },
  {
    id: "promotional",
    name: "Promotional",
    description: "Sales & offers",
    icon: <Megaphone className="h-5 w-5" />,
    content: {
      type: "doc",
      content: [
        {
          type: "emailPreview",
          attrs: { text: "Don't miss our special offer!" },
        },
        {
          type: "emailSection",
          attrs: { backgroundColor: "#f3f4f6", padding: "32px 24px" },
          content: [
            {
              type: "heading",
              attrs: { level: 1, textAlign: "center" },
              content: [{ type: "text", text: "🎉 Special Offer!" }],
            },
            {
              type: "paragraph",
              attrs: { textAlign: "center" },
              content: [
                {
                  type: "text",
                  text: "For a limited time, get 20% off your next purchase.",
                },
              ],
            },
            {
              type: "emailButton",
              attrs: {
                text: "Shop Now",
                href: "https://example.com/shop",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                align: "center",
                padding: "16px 32px",
              },
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [
            {
              type: "text",
              text: "Use code ",
            },
            {
              type: "text",
              marks: [{ type: "bold" }],
              text: "SAVE20",
            },
            {
              type: "text",
              text: " at checkout.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "transactional",
    name: "Order Confirmation",
    description: "Purchase receipts",
    icon: <Gift className="h-5 w-5" />,
    content: {
      type: "doc",
      content: [
        {
          type: "emailPreview",
          attrs: { text: "Your order has been confirmed" },
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Order Confirmed ✓" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hi " },
            {
              type: "variable",
              attrs: {
                name: "firstName",
                label: "First Name",
                fallback: "there",
              },
            },
            {
              type: "text",
              text: ", thank you for your order!",
            },
          ],
        },
        {
          type: "emailSection",
          attrs: {
            backgroundColor: "#f9fafb",
            padding: "16px",
            borderRadius: "8px",
          },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Order #: " },
                {
                  type: "variable",
                  attrs: { name: "orderNumber", label: "Order Number" },
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Total: " },
                {
                  type: "variable",
                  attrs: { name: "orderTotal", label: "Order Total" },
                },
              ],
            },
          ],
        },
        {
          type: "emailButton",
          attrs: {
            text: "View Order",
            href: "https://example.com/orders",
            backgroundColor: "#5046e5",
            color: "#ffffff",
            align: "left",
          },
        },
      ],
    },
  },
];

type EditorEmptyStateProps = {
  editor: Editor;
  onOpenAI: () => void;
};

export function EditorEmptyState({ editor, onOpenAI }: EditorEmptyStateProps) {
  const { toggleLeftPanelWithTab } = useTemplateStore((state) => state.actions);

  const handleQuickStart = (template: QuickStartTemplate) => {
    editor.commands.setContent(template.content);
    editor.commands.focus("end");
  };

  const handleOpenBlocks = () => {
    toggleLeftPanelWithTab("blocks");
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="w-full max-w-lg px-6 text-center">
        {/* Header */}
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Wand2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mb-2 font-semibold text-xl">Create Your Email</h2>
          <p className="text-muted-foreground text-sm">
            Start with a template, use AI, or build from scratch
          </p>
        </div>

        {/* Quick Start Templates */}
        <div className="mb-6">
          <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Quick Start
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_START_TEMPLATES.map((template) => (
              <button
                className="flex items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary hover:bg-accent"
                key={template.id}
                onClick={() => handleQuickStart(template)}
                type="button"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {template.icon}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">
                    {template.name}
                  </div>
                  <div className="truncate text-muted-foreground text-xs">
                    {template.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-muted-foreground text-xs">
              or
            </span>
          </div>
        </div>

        {/* Other Options */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="gap-2"
            onClick={onOpenAI}
            size="lg"
            variant="default"
          >
            <Sparkles className="h-4 w-4" />
            Generate with AI
          </Button>
          <Button
            className="gap-2"
            onClick={handleOpenBlocks}
            size="lg"
            variant="outline"
          >
            <LayoutGrid className="h-4 w-4" />
            Browse Blocks
          </Button>
        </div>

        {/* Hint */}
        <p className="mt-6 text-muted-foreground text-xs">
          Or just start typing below to begin from scratch
        </p>
      </div>
    </div>
  );
}

/**
 * Check if the editor content is "empty" (only has default placeholder content)
 */
export function isEditorEmpty(editor: Editor | null): boolean {
  if (!editor) {
    return true;
  }

  const json = editor.getJSON();
  if (!json.content) {
    return true;
  }

  // Filter out emailPreview nodes (they're always present)
  const contentNodes = json.content.filter(
    (node) => node.type !== "emailPreview"
  );

  // Empty if no content nodes
  if (contentNodes.length === 0) {
    return true;
  }

  // Empty if only one paragraph with default text or empty
  if (contentNodes.length === 1 && contentNodes[0].type === "paragraph") {
    const para = contentNodes[0];
    if (!para.content || para.content.length === 0) {
      return true;
    }
    if (para.content.length === 1 && para.content[0].type === "text") {
      const textNode = para.content[0] as { type: "text"; text?: string };
      if (
        textNode.text === "Start typing or add blocks..." ||
        textNode.text === "" ||
        !textNode.text?.trim()
      ) {
        return true;
      }
    }
  }

  return false;
}
