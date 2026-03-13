"use client";

import { useForm } from "@tanstack/react-form";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { Loader2, Package, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBlock } from "@/hooks/use-block-queries";

type SaveBlockModalProps = {
  editor: Editor | null;
  orgSlug: string;
  isOpen: boolean;
  onClose: () => void;
};

const blockCategories = [
  { value: "header", label: "Header" },
  { value: "footer", label: "Footer" },
  { value: "cta", label: "Call to Action" },
  { value: "content", label: "Content" },
  { value: "social", label: "Social" },
  { value: "custom", label: "Custom" },
];

const formSchema = z.object({
  name: z.string().min(1, "Block name is required").max(100),
  description: z.string().max(500),
  category: z.string().min(1, "Category is required"),
});

export function SaveBlockModal({
  editor,
  orgSlug,
  isOpen,
  onClose,
}: SaveBlockModalProps) {
  const createBlock = useCreateBlock(orgSlug);
  const [selectedContent, setSelectedContent] = useState<JSONContent | null>(
    null
  );

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      category: "custom",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      if (!selectedContent) {
        toast.error("No content selected to save");
        return;
      }

      try {
        await createBlock.mutateAsync({
          name: value.name,
          description: value.description,
          category: value.category,
          content: selectedContent,
        });

        toast.success("Block saved!", {
          description: `"${value.name}" has been added to your block library`,
        });
        onClose();
      } catch (error) {
        toast.error("Failed to save block", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  });

  // Get selected content when modal opens
  useEffect(() => {
    if (isOpen && editor) {
      const { from, to } = editor.state.selection;

      if (from !== to) {
        // Get selected content as JSON
        const slice = editor.state.doc.slice(from, to);
        const content: JSONContent = {
          type: "doc",
          content: slice.content.toJSON(),
        };
        setSelectedContent(content);
      } else {
        // If nothing selected, get the whole document
        setSelectedContent(editor.getJSON());
      }

      form.reset();
    }
  }, [isOpen, editor, form]);

  const hasSelection = editor
    ? editor.state.selection.from !== editor.state.selection.to
    : false;

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Save as Block
          </DialogTitle>
          <DialogDescription>
            {hasSelection
              ? "Save the selected content as a reusable block."
              : "Save the entire template as a reusable block."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const errors = field.state.meta.errors.map((error) => ({
                message: String(error),
              }));
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Block Name</FieldLabel>
                  <FieldContent>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="e.g., Welcome Header"
                      value={field.state.value}
                    />
                    {isInvalid && <FieldError errors={errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="category">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const errors = field.state.meta.errors.map((error) => ({
                message: String(error),
              }));
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Category</FieldLabel>
                  <FieldContent>
                    <Select
                      onValueChange={(value) => field.handleChange(value)}
                      value={field.state.value}
                    >
                      <SelectTrigger aria-invalid={isInvalid} id={field.name}>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {blockCategories.map((category) => (
                          <SelectItem
                            key={category.value}
                            value={category.value}
                          >
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isInvalid && <FieldError errors={errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="description">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const errors = field.state.meta.errors.map((error) => ({
                message: String(error),
              }));
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Description (optional)
                  </FieldLabel>
                  <FieldContent>
                    <Textarea
                      aria-invalid={isInvalid}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Describe what this block contains..."
                      value={field.state.value}
                    />
                    {isInvalid && <FieldError errors={errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={createBlock.isPending} type="submit">
              {createBlock.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Block
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
