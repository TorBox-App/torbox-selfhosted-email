"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const templateNameSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
});

type TemplateNameFormValues = z.infer<typeof templateNameSchema>;

export type TemplateNameDialogProps = {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback to change open state
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Callback when name is confirmed
   */
  onConfirm: (name: string, description?: string) => void;

  /**
   * Dialog title
   */
  title?: string;

  /**
   * Dialog description
   */
  description?: string;

  /**
   * Default name value
   */
  defaultName?: string;

  /**
   * Default description value
   */
  defaultDescription?: string;

  /**
   * Placeholder for the name input
   */
  namePlaceholder?: string;
};

/**
 * Dialog to prompt user for a template name before creating.
 *
 * Usage:
 * ```tsx
 * <TemplateNameDialog
 *   open={showNameDialog}
 *   onOpenChange={setShowNameDialog}
 *   onConfirm={(name, description) => {
 *     setTemplateName(name);
 *     setShowEditor(true);
 *   }}
 * />
 * ```
 */
export function TemplateNameDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Create New Template",
  description = "Give your template a name to help you find it later.",
  defaultName = "",
  defaultDescription = "",
  namePlaceholder = "e.g., Welcome Email, Newsletter Header",
}: TemplateNameDialogProps) {
  const form = useForm<TemplateNameFormValues>({
    resolver: zodResolver(templateNameSchema),
    defaultValues: {
      name: defaultName,
      description: defaultDescription,
    },
  });

  const handleSubmit = (values: TemplateNameFormValues) => {
    onConfirm(values.name, values.description);
    form.reset();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={namePlaceholder}
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of what this template is for..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This will also be used as the email preview text.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create & Edit</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
