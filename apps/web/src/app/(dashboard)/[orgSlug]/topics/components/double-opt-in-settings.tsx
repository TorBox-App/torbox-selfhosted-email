"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { topicSettings } from "@wraps/db";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
import { updateTopicSettings } from "../actions";

type TopicSettingsType = typeof topicSettings.$inferSelect;

const formSchema = z.object({
  confirmationFromName: z.string().optional(),
  confirmationFromEmail: z
    .string()
    .email("Must be a valid email address")
    .optional()
    .or(z.literal("")),
  confirmationReplyToEmail: z
    .string()
    .email("Must be a valid email address")
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

type DoubleOptInSettingsProps = {
  organizationId: string;
  settings: TopicSettingsType | null;
  verifiedDomains: string[];
};

export function DoubleOptInSettings({
  organizationId,
  settings,
  verifiedDomains,
}: DoubleOptInSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      confirmationFromName: settings?.confirmationFromName || "",
      confirmationFromEmail: settings?.confirmationFromEmail || "",
      confirmationReplyToEmail: settings?.confirmationReplyToEmail || "",
    },
  });

  const onSubmit = (values: FormValues) => {
    // Validate that email domain is from verified domains
    if (values.confirmationFromEmail) {
      const emailDomain = values.confirmationFromEmail.split("@")[1];
      if (
        verifiedDomains.length > 0 &&
        !verifiedDomains.includes(emailDomain)
      ) {
        form.setError("confirmationFromEmail", {
          message: `Email must be from a verified domain: ${verifiedDomains.join(", ")}`,
        });
        return;
      }
    }

    startTransition(async () => {
      const result = await updateTopicSettings(organizationId, {
        confirmationFromName: values.confirmationFromName || null,
        confirmationFromEmail: values.confirmationFromEmail || null,
        confirmationReplyToEmail: values.confirmationReplyToEmail || null,
      });

      if (result.success) {
        toast.success("Settings saved successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to save settings");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirmation Email Settings</CardTitle>
        <CardDescription>
          Configure the sender details for double opt-in confirmation emails.
          These settings apply to all topics that have double opt-in enabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="confirmationFromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc" {...field} />
                  </FormControl>
                  <FormDescription>
                    Display name shown in the email from field
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmationFromEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="noreply@yourdomain.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {verifiedDomains.length > 0 ? (
                      <>
                        Must be from a verified domain:{" "}
                        {verifiedDomains.join(", ")}
                      </>
                    ) : (
                      "Must be from a domain verified in your AWS SES"
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmationReplyToEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reply-To Email (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="support@yourdomain.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Where replies will be sent. Leave empty to use the from
                    email.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button disabled={isPending} type="submit">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
