"use client";

import { useForm } from "@tanstack/react-form";
import { Mail, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTemplate } from "@/hooks/use-template-queries";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Template name is required").max(100),
  description: z.string().max(500),
});

type NewTemplateFormProps = {
  orgSlug: string;
};

export function NewTemplateForm({ orgSlug }: NewTemplateFormProps) {
  const router = useRouter();
  const createTemplate = useCreateTemplate(orgSlug);
  const [selectedChannel, setSelectedChannel] = useState<"email" | "sms">(
    "email"
  );

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      const template = await createTemplate.mutateAsync({
        name: value.name,
        description: value.description,
        channel: selectedChannel,
      });

      // Capture template created event in PostHog
      posthog.capture("template_created", {
        template_id: template.id,
        template_name: value.name,
        has_description: !!value.description,
        channel: selectedChannel,
        organization_slug: orgSlug,
      });

      router.push(`/${orgSlug}/emails/templates/${template.id}`);
    },
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      {/* Channel selector */}
      <div className="space-y-2">
        <Label>Channel</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors",
              selectedChannel === "email"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/25"
            )}
            onClick={() => setSelectedChannel("email")}
            type="button"
          >
            <Mail
              className={cn(
                "h-5 w-5",
                selectedChannel === "email"
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            />
            <div>
              <p className="font-medium text-sm">Email</p>
              <p className="text-muted-foreground text-xs">
                Rich HTML templates
              </p>
            </div>
          </button>
          <button
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors",
              selectedChannel === "sms"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/25"
            )}
            onClick={() => setSelectedChannel("sms")}
            type="button"
          >
            <MessageSquare
              className={cn(
                "h-5 w-5",
                selectedChannel === "sms"
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            />
            <div>
              <p className="font-medium text-sm">SMS</p>
              <p className="text-muted-foreground text-xs">
                Plain text messages
              </p>
            </div>
          </button>
        </div>
      </div>

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
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={
                    selectedChannel === "sms"
                      ? "Order Confirmation SMS"
                      : "Welcome Email"
                  }
                  value={field.state.value}
                />
                <FieldDescription>
                  A descriptive name for your{" "}
                  {selectedChannel === "sms" ? "SMS" : "email"} template.
                </FieldDescription>
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
                  placeholder={
                    selectedChannel === "sms"
                      ? "Sent after an order is placed..."
                      : "Sent to new users after they sign up..."
                  }
                  rows={3}
                  value={field.state.value ?? ""}
                />
                <FieldDescription>
                  Help your team understand when this template should be used.
                </FieldDescription>
                {isInvalid && <FieldError errors={errors} />}
              </FieldContent>
            </Field>
          );
        }}
      </form.Field>

      <div className="flex gap-3">
        <Button disabled={createTemplate.isPending} type="submit">
          {createTemplate.isPending ? "Creating..." : "Create Template"}
        </Button>
        <Button onClick={() => router.back()} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  );
}
