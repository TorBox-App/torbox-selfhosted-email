"use client";

import { useForm } from "@tanstack/react-form";
import type { topicSettings } from "@wraps/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { Textarea } from "@wraps/ui/components/ui/textarea";
import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  generatePreferenceCenterPreviewUrl,
  updateTopicSettings,
} from "../actions";

type TopicSettingsType = typeof topicSettings.$inferSelect;

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

  const form = useForm({
    defaultValues: {
      preferenceCenterTitle: settings?.preferenceCenterTitle || "",
      preferenceCenterDescription: settings?.preferenceCenterDescription || "",
    },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const result = await updateTopicSettings(organizationId, {
          preferenceCenterTitle: value.preferenceCenterTitle || null,
          preferenceCenterDescription:
            value.preferenceCenterDescription || null,
        });

        if (result.success) {
          toast.success("Settings saved successfully");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to save settings");
        }
      });
    },
  });

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
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="preferenceCenterTitle">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Page Title</FieldLabel>
                <FieldContent>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Email Preferences"
                    value={field.state.value}
                  />
                  <FieldDescription>
                    Title shown at the top of the preference center page
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}
          </form.Field>

          <form.Field name="preferenceCenterDescription">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                <FieldContent>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Manage subscriptions for {{masked_email}}"
                    rows={3}
                    value={field.state.value}
                  />
                  <FieldDescription>
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
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}
          </form.Field>

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
      </CardContent>
    </Card>
  );
}
