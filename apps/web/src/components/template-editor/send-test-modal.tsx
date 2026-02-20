"use client";

import { useForm } from "@tanstack/react-form";
import type { Editor } from "@tiptap/react";
import { escape as escapeHTML } from "he";
import { AlertCircle, Loader2, Mail, Send, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";

type SendTestModalProps = {
  editor: Editor | null;
  orgSlug: string;
  templateId: string;
  isOpen: boolean;
  onClose: () => void;
  defaultFrom?: string | null;
  defaultFromName?: string | null;
};

// Extract variable names from template content (e.g., {{variableName}})
function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = new Set<string>();

  for (const match of content.matchAll(regex)) {
    matches.add(match[1]);
  }

  return Array.from(matches);
}

export function SendTestModal({
  editor,
  orgSlug,
  templateId,
  isOpen,
  onClose,
  defaultFrom,
  defaultFromName,
}: SendTestModalProps) {
  const { data: session } = useSession();
  const [isSending, setIsSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");

  // Get user's email for "Send to Self" feature
  const userEmail = session?.user?.email;

  // Get template content and extract variables
  const templateContent = editor?.getHTML() ?? "";
  const variables = useMemo(
    () => extractVariables(templateContent),
    [templateContent]
  );

  // Build dynamic schema based on variables
  const formSchema = useMemo(() => {
    const variableFields: Record<string, z.ZodDefault<z.ZodString>> = {};
    for (const v of variables) {
      variableFields[v] = z.string().default("");
    }

    return z.object({
      from: z.string().email("Please enter a valid sender email address"),
      to: z.string().email("Please enter a valid email address"),
      subject: z.string().min(1, "Subject is required"),
      ...variableFields,
    });
  }, [variables]);

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm({
    defaultValues: {
      from: defaultFrom || "",
      to: "",
      subject: "",
      ...Object.fromEntries(variables.map((v) => [v, ""])),
    } as FormValues,
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSending(true);

      try {
        // Build testData object from variables
        const testData: Record<string, string> = {};
        for (const variable of variables) {
          testData[variable] = String(
            value[variable as keyof FormValues] ?? ""
          );
        }

        const response = await fetch(
          `/api/${orgSlug}/emails/templates/${templateId}/send-test`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipients: [value.to],
              subject: value.subject,
              from: value.from,
              testData,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to send test email");
        }

        if (data.success) {
          toast.success("Test email sent!", {
            description: `Email sent to ${value.to}`,
          });
          onClose();
        } else if (data.failed > 0) {
          const failedDetails = data.details?.failed?.[0];
          throw new Error(failedDetails?.error || "Failed to send test email");
        }
      } catch (error) {
        toast.error("Failed to send test email", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsSending(false);
      }
    },
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        from: defaultFrom || "",
        to: "",
        subject: "",
        ...Object.fromEntries(variables.map((v) => [v, ""])),
      } as FormValues);
      setPreviewHtml(null);
      setActiveTab("form");
    }
  }, [isOpen, form, variables, defaultFrom]);

  // Fill recipient with user's email
  const handleSendToSelf = useCallback(() => {
    if (userEmail) {
      form.setFieldValue("to", userEmail);
    }
  }, [form, userEmail]);

  // Generate preview HTML with variables replaced
  const generatePreview = useCallback(() => {
    const values = form.state.values;
    let html = templateContent;

    // Replace variables
    for (const variable of variables) {
      const value = values[variable as keyof FormValues] ?? `{{${variable}}}`;
      // Escape user-provided variable values
      html = html.replace(
        new RegExp(`\\{\\{${variable}\\}\\}`, "g"),
        escapeHTML(String(value))
      );
    }

    setPreviewHtml(html);
    setActiveTab("preview");
  }, [form, templateContent, variables]);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Test Email
          </DialogTitle>
          <DialogDescription>
            Send a test email to preview how your template will look in an
            inbox.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          onValueChange={(v) => setActiveTab(v as "form" | "preview")}
          value={activeTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">Details</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-4" value="form">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
            >
              <form.Field name="from">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  const errors = field.state.meta.errors.map((error) => ({
                    message: String(error),
                  }));
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>From</FieldLabel>
                      <FieldContent>
                        <Input
                          aria-invalid={isInvalid}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="hello@yourdomain.com"
                          type="email"
                          value={field.state.value}
                        />
                        {isInvalid && <FieldError errors={errors} />}
                      </FieldContent>
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="to">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  const errors = field.state.meta.errors.map((error) => ({
                    message: String(error),
                  }));
                  return (
                    <Field data-invalid={isInvalid}>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor={field.name}>To</FieldLabel>
                        {userEmail && (
                          <Button
                            className="h-auto p-0 text-xs"
                            onClick={handleSendToSelf}
                            type="button"
                            variant="link"
                          >
                            <User className="mr-1 h-3 w-3" />
                            Send to myself
                          </Button>
                        )}
                      </div>
                      <FieldContent>
                        <Input
                          aria-invalid={isInvalid}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="test@example.com"
                          type="email"
                          value={field.state.value}
                        />
                        {isInvalid && <FieldError errors={errors} />}
                      </FieldContent>
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="subject">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  const errors = field.state.meta.errors.map((error) => ({
                    message: String(error),
                  }));
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Subject Line</FieldLabel>
                      <FieldContent>
                        <Input
                          aria-invalid={isInvalid}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Welcome to our service!"
                          value={field.state.value}
                        />
                        {isInvalid && <FieldError errors={errors} />}
                      </FieldContent>
                    </Field>
                  );
                }}
              </form.Field>

              {variables.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-3 font-medium text-sm">
                      Template Variables
                    </h4>
                    <p className="mb-4 text-muted-foreground text-xs">
                      Fill in values for the variables used in your template.
                    </p>
                    <div className="space-y-3">
                      {variables.map((variable) => (
                        <form.Field
                          key={variable}
                          name={variable as keyof FormValues}
                        >
                          {(field) => {
                            const isInvalid =
                              field.state.meta.isTouched &&
                              !field.state.meta.isValid;
                            const errors = field.state.meta.errors.map(
                              (error) => ({
                                message: String(error),
                              })
                            );
                            return (
                              <Field data-invalid={isInvalid}>
                                <FieldLabel
                                  className="font-mono text-xs"
                                  htmlFor={field.name}
                                >
                                  {`{{${variable}}}`}
                                </FieldLabel>
                                <FieldContent>
                                  <Input
                                    aria-invalid={isInvalid}
                                    id={field.name}
                                    name={field.name}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                      field.handleChange(e.target.value)
                                    }
                                    placeholder={`Value for ${variable}`}
                                    value={String(field.state.value ?? "")}
                                  />
                                  {isInvalid && <FieldError errors={errors} />}
                                </FieldContent>
                              </Field>
                            );
                          }}
                        </form.Field>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <DialogFooter className="gap-2 pt-4">
                <Button
                  onClick={generatePreview}
                  type="button"
                  variant="outline"
                >
                  Preview
                </Button>
                <Button disabled={isSending} type="submit">
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent className="mt-4" value="preview">
            {previewHtml ? (
              <ScrollArea className="h-[400px] rounded-md border">
                <div
                  className="p-4"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </ScrollArea>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Fill in the form details and click "Preview" to see how your
                  email will look.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 pt-4">
              <Button
                onClick={() => setActiveTab("form")}
                type="button"
                variant="outline"
              >
                Back to Form
              </Button>
              <Button disabled={isSending} onClick={() => form.handleSubmit()}>
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
