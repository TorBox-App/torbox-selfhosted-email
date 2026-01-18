"use client";

import { useDraggable } from "@dnd-kit/core";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import {
  Braces,
  Circle,
  Code,
  Columns,
  FileText,
  GitBranch,
  GripVertical,
  Heading1,
  Heading2,
  Image,
  LayoutTemplate,
  List,
  ListOrdered,
  MessageSquareQuote,
  Minus,
  MousePointerClick,
  MoveVertical,
  Quote,
  Share2,
  ShoppingCart,
  Square,
  Star,
  Type,
  User,
} from "lucide-react";
import { memo, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBrandKits } from "@/hooks/use-brand-kit-queries";
import { ALL_BLOCK_EXAMPLES } from "@/lib/ai/block-examples";
import {
  applyBrandKitToContent,
  type BrandKitValues,
} from "@/lib/brand-kit/apply-to-content";
import { useTemplateStore } from "@/stores/template-store";

type BlockPaletteProps = {
  editor: Editor | null;
  orgSlug: string;
};

export type BlockItem = {
  name: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: Editor, brandKit?: BrandKitValues | null) => void;
  category: "email" | "text" | "layout" | "dynamic" | "templates";
};

// Helper to insert a block example by ID with optional brand kit
function insertBlockExample(
  editor: Editor,
  exampleId: string,
  brandKit?: BrandKitValues | null
) {
  const example = ALL_BLOCK_EXAMPLES.find((e) => e.id === exampleId);
  if (example) {
    let content = example.tiptapJson as JSONContent;
    // Apply brand kit if available
    if (brandKit) {
      content = applyBrandKitToContent(content, brandKit);
    }
    // If the content is a doc wrapper, extract the content array
    // This allows templates to define multiple top-level nodes
    if (content.type === "doc" && content.content) {
      editor.commands.insertContent(content.content);
    } else {
      editor.commands.insertContent(content);
    }
  }
}

/**
 * Lightens a hex color by mixing it with white
 */
function lightenColor(hex: string, amount: number): string {
  const color = hex.replace("#", "");
  const r = Number.parseInt(color.substring(0, 2), 16);
  const g = Number.parseInt(color.substring(2, 4), 16);
  const b = Number.parseInt(color.substring(4, 6), 16);
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

const blocks: BlockItem[] = [
  // Email components
  {
    name: "Button",
    description: "CTA button with link",
    icon: <MousePointerClick className="h-5 w-5" />,
    action: (editor, brandKit) =>
      editor.commands.insertEmailButton({
        backgroundColor: brandKit?.primaryColor || "#5046e5",
        color: "#ffffff",
      }),
    category: "email",
  },
  {
    name: "Section",
    description: "Container with styling",
    icon: <Square className="h-5 w-5" />,
    action: (editor, brandKit) =>
      editor.commands.insertEmailSection({
        backgroundColor: brandKit?.backgroundColor || "#ffffff",
      }),
    category: "email",
  },
  {
    name: "Image",
    description: "Image with alt text",
    icon: <Image className="h-5 w-5" />,
    action: (editor) => editor.commands.insertEmailImage(),
    category: "email",
  },
  {
    name: "Divider",
    description: "Horizontal line",
    icon: <Minus className="h-5 w-5" />,
    action: (editor) => editor.commands.insertEmailDivider(),
    category: "email",
  },
  {
    name: "Spacer",
    description: "Vertical spacing",
    icon: <MoveVertical className="h-5 w-5" />,
    action: (editor) => editor.commands.insertEmailSpacer(),
    category: "email",
  },
  {
    name: "Avatar",
    description: "Circular profile image",
    icon: <User className="h-5 w-5" />,
    action: (editor) => editor.commands.insertEmailAvatar(),
    category: "email",
  },
  {
    name: "Icon",
    description: "Icon with background",
    icon: <Circle className="h-5 w-5" />,
    action: (editor, brandKit) => {
      const primaryColor = brandKit?.primaryColor || "#5046e5";
      const bgColor = lightenColor(primaryColor, 0.85);
      return editor.commands.insertEmailIcon({
        iconColor: primaryColor,
        backgroundColor: bgColor,
      });
    },
    category: "email",
  },
  {
    name: "Code Block",
    description: "Syntax highlighted code",
    icon: <Code className="h-5 w-5" />,
    action: (editor) => editor.commands.insertEmailCodeBlock(),
    category: "email",
  },
  {
    name: "Social Links",
    description: "Social media icons",
    icon: <Share2 className="h-5 w-5" />,
    action: (editor) => editor.commands.insertEmailSocialLinks(),
    category: "email",
  },

  // Layout
  {
    name: "2 Columns",
    description: "Two column layout",
    icon: <Columns className="h-5 w-5" />,
    action: (editor) => editor.commands.insertEmailRow({}, 2),
    category: "layout",
  },
  {
    name: "3 Columns",
    description: "Three column layout",
    icon: <Columns className="h-5 w-5" />,
    action: (editor) => editor.commands.insertEmailRow({}, 3),
    category: "layout",
  },

  // Text
  {
    name: "Text",
    description: "Paragraph text",
    icon: <Type className="h-5 w-5" />,
    action: (editor) =>
      editor.commands.insertContent({
        type: "paragraph",
        content: [{ type: "text", text: "Enter text here..." }],
      }),
    category: "text",
  },
  {
    name: "Heading 1",
    description: "Large heading",
    icon: <Heading1 className="h-5 w-5" />,
    action: (editor) =>
      editor.commands.insertContent({
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Heading" }],
      }),
    category: "text",
  },
  {
    name: "Heading 2",
    description: "Medium heading",
    icon: <Heading2 className="h-5 w-5" />,
    action: (editor) =>
      editor.commands.insertContent({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Heading" }],
      }),
    category: "text",
  },
  {
    name: "Bullet List",
    description: "Unordered list",
    icon: <List className="h-5 w-5" />,
    action: (editor) =>
      editor.commands.insertContent({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "List item" }],
              },
            ],
          },
        ],
      }),
    category: "text",
  },
  {
    name: "Numbered List",
    description: "Ordered list",
    icon: <ListOrdered className="h-5 w-5" />,
    action: (editor) =>
      editor.commands.insertContent({
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "List item" }],
              },
            ],
          },
        ],
      }),
    category: "text",
  },
  {
    name: "Quote",
    description: "Blockquote",
    icon: <Quote className="h-5 w-5" />,
    action: (editor) =>
      editor.commands.insertContent({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Quote text..." }],
          },
        ],
      }),
    category: "text",
  },

  // Dynamic
  {
    name: "Variable",
    description: "Type {{ or press ⌘/",
    icon: <Braces className="h-5 w-5" />,
    action: (editor) => editor.commands.insertContent("{{"),
    category: "dynamic",
  },
  {
    name: "Conditional",
    description: "If/else block",
    icon: <GitBranch className="h-5 w-5" />,
    action: (editor) => editor.commands.insertConditional(),
    category: "dynamic",
  },

  // Pre-built Templates (these use brand kit when available)
  {
    name: "Header",
    description: "Centered logo header",
    icon: <LayoutTemplate className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "header-logo-centered", brandKit),
    category: "templates",
  },
  {
    name: "Footer",
    description: "With social links",
    icon: <LayoutTemplate className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "footer-with-social", brandKit),
    category: "templates",
  },
  {
    name: "Hero",
    description: "Welcome section with CTA",
    icon: <Star className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "hero-simple", brandKit),
    category: "templates",
  },
  {
    name: "Features",
    description: "Feature list with icons",
    icon: <List className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "features-list", brandKit),
    category: "templates",
  },
  {
    name: "Testimonial",
    description: "Customer quote",
    icon: <MessageSquareQuote className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "testimonial-with-avatar", brandKit),
    category: "templates",
  },
  {
    name: "Product Showcase",
    description: "Hero + 2 products",
    icon: <ShoppingCart className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "product-showcase", brandKit),
    category: "templates",
  },
  {
    name: "Product Card",
    description: "E-commerce product",
    icon: <ShoppingCart className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "product-card", brandKit),
    category: "templates",
  },
  {
    name: "Article",
    description: "Blog post preview",
    icon: <FileText className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "article-card", brandKit),
    category: "templates",
  },
  {
    name: "CTA",
    description: "Call to action section",
    icon: <MousePointerClick className="h-5 w-5" />,
    action: (editor, brandKit) =>
      insertBlockExample(editor, "cta-simple", brandKit),
    category: "templates",
  },
];

const categoryLabels: Record<BlockItem["category"], string> = {
  email: "Email Components",
  layout: "Layout",
  text: "Text",
  dynamic: "Dynamic Content",
  templates: "Pre-built Sections",
};

const categoryOrder: BlockItem["category"][] = [
  "templates",
  "email",
  "layout",
  "text",
  "dynamic",
];

// Pre-compute blocks by category at module level (static data)
const blocksByCategory = categoryOrder.map((category) => ({
  category,
  label: categoryLabels[category],
  blocks: blocks.filter((block) => block.category === category),
}));

// Draggable block item component
type DraggableBlockItemProps = {
  block: BlockItem;
  editor: Editor;
  brandKit: BrandKitValues | null;
};

const DraggableBlockItem = memo(function DraggableBlockItemInner({
  block,
  editor,
  brandKit,
}: DraggableBlockItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.name}`,
    data: { block },
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`group flex h-auto w-full cursor-grab items-center gap-2 rounded-lg border border-transparent bg-background px-3 py-2.5 shadow-sm transition-all hover:border-border hover:bg-accent ${isDragging ? "opacity-50" : ""}`}
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={() => {
            block.action(editor, brandKit);
            editor.commands.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              block.action(editor, brandKit);
              editor.commands.focus();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex flex-1 items-center gap-3">
            <div className="flex-shrink-0 text-muted-foreground">
              {block.icon}
            </div>
            <div className="text-left">
              <div className="font-medium text-sm">{block.name}</div>
              <div className="text-muted-foreground text-xs">
                {block.description}
              </div>
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{block.description}</p>
      </TooltipContent>
    </Tooltip>
  );
});

export function BlockPalette({ editor, orgSlug }: BlockPaletteProps) {
  const { selectedBrandKitId } = useTemplateStore((state) => state.localState);

  // Fetch brand kits for the organization
  const { data: brandKits } = useBrandKits(orgSlug);

  // Get the selected brand kit
  const brandKit = useMemo(() => {
    if (!brandKits?.length) {
      return null;
    }
    if (selectedBrandKitId) {
      return brandKits.find((kit) => kit.id === selectedBrandKitId) ?? null;
    }
    // Fallback to default brand kit or first one
    return brandKits.find((kit) => kit.isDefault) ?? brandKits[0];
  }, [brandKits, selectedBrandKitId]);

  if (!editor) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 w-full flex-col bg-muted/30">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm">Blocks</h3>
          <p className="text-muted-foreground text-xs">Click or drag to add</p>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-3">
            {blocksByCategory.map(
              ({ category, label, blocks: categoryBlocks }) => (
                <div key={category}>
                  <h4 className="mb-2 px-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    {label}
                  </h4>
                  <div className="space-y-2">
                    {categoryBlocks.map((block) => (
                      <DraggableBlockItem
                        block={block}
                        brandKit={brandKit}
                        editor={editor}
                        key={block.name}
                      />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
