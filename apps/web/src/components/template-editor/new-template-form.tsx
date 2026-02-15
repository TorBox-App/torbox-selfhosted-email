"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTemplate } from "@/hooks/use-template-queries";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Template name is required").max(100),
  description: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

type NewTemplateFormProps = {
  orgSlug: string;
};

export function NewTemplateForm({ orgSlug }: NewTemplateFormProps) {
  const router = useRouter();
  const createTemplate = useCreateTemplate(orgSlug);
  const [selectedChannel, setSelectedChannel] = useState<"email" | "sms">(
    "email"
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    const template = await createTemplate.mutateAsync({
      name: values.name,
      description: values.description,
      channel: selectedChannel,
    });

    // Capture template created event in PostHog
    posthog.capture("template_created", {
      template_id: template.id,
      template_name: values.name,
      has_description: !!values.description,
      channel: selectedChannel,
      organization_slug: orgSlug,
    });

    router.push(`/${orgSlug}/emails/templates/${template.id}`);
  };

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
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

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Name</FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    selectedChannel === "sms"
                      ? "Order Confirmation SMS"
                      : "Welcome Email"
                  }
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A descriptive name for your{" "}
                {selectedChannel === "sms" ? "SMS" : "email"} template.
              </FormDescription>
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
                  className="resize-none"
                  placeholder={
                    selectedChannel === "sms"
                      ? "Sent after an order is placed..."
                      : "Sent to new users after they sign up..."
                  }
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Help your team understand when this template should be used.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button disabled={createTemplate.isPending} type="submit">
            {createTemplate.isPending ? "Creating..." : "Create Template"}
          </Button>
          <Button onClick={() => router.back()} type="button" variant="outline">
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
