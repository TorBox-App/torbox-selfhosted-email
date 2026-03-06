"use client";

import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
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
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const templateNameSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
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

  /**
   * Submit button label
   */
  submitLabel?: string;
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
  submitLabel = "Create & Edit",
}: TemplateNameDialogProps) {
  const form = useForm({
    defaultValues: {
      name: defaultName,
      description: defaultDescription,
    } as TemplateNameFormValues,
    validators: {
      onSubmit: templateNameSchema,
    },
    onSubmit: ({ value }) => {
      onConfirm(value.name, value.description);
      form.reset();
      onOpenChange(false);
    },
  });

  // Reset form values when defaults change (e.g., when opening for different template)
  useEffect(() => {
    if (open) {
      form.reset({
        name: defaultName,
        description: defaultDescription,
      });
    }
  }, [open, defaultName, defaultDescription, form]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
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
                  <FieldLabel htmlFor={field.name}>Template Name</FieldLabel>
                  <FieldContent>
                    <Input
                      aria-invalid={isInvalid}
                      autoFocus
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={namePlaceholder}
                      value={field.state.value}
                    />
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
                      className="resize-none"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Brief description of what this template is for…"
                      rows={2}
                      value={field.state.value ?? ""}
                    />
                    <FieldDescription>
                      This will also be used as the email preview text.
                    </FieldDescription>
                    {isInvalid && <FieldError errors={errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>

          <DialogFooter>
            <Button
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
