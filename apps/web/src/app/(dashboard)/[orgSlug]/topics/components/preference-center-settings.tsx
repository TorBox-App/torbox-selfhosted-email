"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { topicSettings } from "@wraps/db";
import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  generatePreferenceCenterPreviewUrl,
  updateTopicSettings,
} from "../actions";

type TopicSettingsType = typeof topicSettings.$inferSelect;

const formSchema = z.object({
  preferenceCenterTitle: z.string().optional(),
  preferenceCenterDescription: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type PreferenceCenterSettingsProps = {
  organizationId: string;
  settings: TopicSettingsType | null;
};

export function PreferenceCenterSettings({
  organizationId,
  settings,
}: PreferenceCenterSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      preferenceCenterTitle: settings?.preferenceCenterTitle || "",
      preferenceCenterDescription: settings?.preferenceCenterDescription || "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateTopicSettings(organizationId, {
        preferenceCenterTitle: values.preferenceCenterTitle || null,
        preferenceCenterDescription: values.preferenceCenterDescription || null,
      });

      if (result.success) {
        toast.success("Settings saved successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to save settings");
      }
    });
  };

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const result = await generatePreferenceCenterPreviewUrl(organizationId);
      if (result.success) {
        window.open(result.url, "_blank");
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preference Center Settings</CardTitle>
        <CardDescription>
          Customize the appearance and content of your subscriber preference
          center. This is where contacts can manage their topic subscriptions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="preferenceCenterTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Page Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Email Preferences" {...field} />
                  </FormControl>
                  <FormDescription>
                    Title shown at the top of the preference center page
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preferenceCenterDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Manage subscriptions for {{masked_email}}"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Introductory text shown below the title. Available
                    variables:{" "}
                    <code className="rounded bg-muted px-1 text-xs">
                      {"{{masked_email}}"}
                    </code>
                    ,{" "}
                    <code className="rounded bg-muted px-1 text-xs">
                      {"{{email}}"}
                    </code>
                    ,{" "}
                    <code className="rounded bg-muted px-1 text-xs">
                      {"{{org_name}}"}
                    </code>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button disabled={isPending} type="submit">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button
                disabled={isPreviewLoading}
                onClick={handlePreview}
                type="button"
                variant="outline"
              >
                {isPreviewLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Preview
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
