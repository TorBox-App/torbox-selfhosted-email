"use client";

import { useForm } from "@tanstack/react-form";
import type { Editor } from "@tiptap/react";
import { Alert, AlertDescription } from "@wraps/ui/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wraps/ui/components/ui/dialog";
import { ScrollArea } from "@wraps/ui/components/ui/scroll-area";
import { Separator } from "@wraps/ui/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wraps/ui/components/ui/tabs";
import { escape as escapeHTML } from "he";
import { AlertCircle, Loader2, Mail, Send, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";
import { renderForPreview } from "@/lib/handlebars";

type TemplateVariable = { name: string; fallback?: string };

type SendTestModalProps = {
  editor: Editor | null;
  orgSlug: string;
  templateId: string;
  isOpen: boolean;
  onClose: () => void;
  defaultFrom?: string | null;
  defaultFromName?: string | null;
  /**
   * Compiled template HTML for code templates (where there is no TipTap
   * editor instance). When provided, the preview is rendered with
   * `renderForPreview` so `{{#if}}` blocks and `{{var}}` substitutions
   * match what recipients will actually see at send time.
   */
  compiledHtml?: string | null;
  /**
   * Variables declared by the code template's compiler. Used to render
   * inputs in the form and seed the preview substitution. Each entry's
   * `fallback` (if any) seeds the input's default value.
   */
  templateVariables?: TemplateVariable[];
  /**
   * Default test data values curated alongside the template (e.g. exported
   * from the React Email source). Pre-populates form inputs so users do not
   * have to retype values they already curated for preview.
   */
  templateTestData?: Record<string, unknown>;
};

// System variables auto-injected by the server for marketing templates
const SYSTEM_VARIABLES = new Set(["unsubscribeUrl", "preferencesUrl"]);

// Extract variable names from template content (e.g., {{variableName}})
function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = new Set<string>();

  for (const match of content.matchAll(regex)) {
    if (!SYSTEM_VARIABLES.has(match[1])) {
      matches.add(match[1]);
    }
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
  compiledHtml,
  templateVariables,
  templateTestData,
}: SendTestModalProps) {
  const { data: session } = useSession();
  const [isSending, setIsSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");

  // Get user's email for "Send to Self" feature
  const userEmail = session?.user?.email;

  // Source of truth for the template body. TipTap editor wins when present
  // (WYSIWYG templates); otherwise fall back to the compiled HTML supplied
  // by code templates. Either source contains raw `{{var}}` placeholders
  // that get substituted at preview/send time.
  const templateContent = editor?.getHTML() ?? compiledHtml ?? "";

  // For code templates we trust the compiler's variable list (which has
  // canonical fallbacks attached). For TipTap templates we extract via
  // regex from the editor's HTML output, since TipTap doesn't track
  // variables structurally.
  const variables = useMemo(() => {
    if (templateVariables && templateVariables.length > 0) {
      return templateVariables.map((v) => v.name);
    }
    return extractVariables(templateContent);
  }, [templateContent, templateVariables]);

  // Map of variable name → default value for seeding form inputs.
  // Priority: explicit testData > variable fallback > empty string.
  // Non-primitive testData values (objects/arrays from jsonb) are
  // JSON.stringified rather than coerced via String() so they don't
  // render as the literal "[object Object]" in form inputs.
  const variableDefaults = useMemo(() => {
    const defaults: Record<string, string> = {};
    if (templateVariables) {
      for (const v of templateVariables) {
        if (v.fallback !== undefined) {
          defaults[v.name] = v.fallback;
        }
      }
    }
    if (templateTestData) {
      for (const [key, value] of Object.entries(templateTestData)) {
        if (value === undefined || value === null) {
          continue;
        }
        if (typeof value === "object") {
          defaults[key] = JSON.stringify(value);
        } else {
          defaults[key] = String(value);
        }
      }
    }
    return defaults;
  }, [templateVariables, templateTestData]);

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
      ...Object.fromEntries(
        variables.map((v) => [v, variableDefaults[v] ?? ""])
      ),
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
          if (data.warnings?.length > 0) {
            for (const warning of data.warnings) {
              toast.warning(warning);
            }
          }
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
        ...Object.fromEntries(
          variables.map((v) => [v, variableDefaults[v] ?? ""])
        ),
      } as FormValues);
      setPreviewHtml(null);
      setActiveTab("form");
    }
  }, [isOpen, form, variables, variableDefaults, defaultFrom]);

  // Fill recipient with user's email
  const handleSendToSelf = useCallback(() => {
    if (userEmail) {
      form.setFieldValue("to", userEmail);
    }
  }, [form, userEmail]);

  // Generate preview HTML with variables replaced.
  //
  // Two paths:
  //   1. Code templates (compiledHtml provided): use the canonical
  //      `renderForPreview` Handlebars renderer so `{{#if}}` blocks and
  //      nested-key substitution work the same way they will at send time.
  //   2. TipTap templates (no compiledHtml): use the legacy regex
  //      substitution. TipTap output never contains conditionals so the
  //      simple replacement is sufficient and avoids pulling Handlebars
  //      across content that wasn't authored for it.
  const generatePreview = useCallback(() => {
    const values = form.state.values;

    // Code template path: take the Handlebars renderer when we have any
    // compiled HTML to render. The explicit length check (rather than just
    // `if (compiledHtml)`) makes the intent clear — empty-string compiled
    // HTML legitimately falls through to the legacy path so the user sees
    // the "fill in the form" alert instead of a blank preview.
    if (compiledHtml != null && compiledHtml.length > 0) {
      // Build substitution data from form values, falling back to the
      // template's curated testData / fallbacks for any field the user
      // didn't override. `renderForPreview` handles HTML escaping itself.
      const data: Record<string, string> = { ...variableDefaults };
      for (const variable of variables) {
        const value = values[variable as keyof FormValues];
        if (value !== undefined && value !== "") {
          data[variable] = String(value);
        }
      }
      setPreviewHtml(renderForPreview(compiledHtml, data));
      setActiveTab("preview");
      return;
    }

    let html = templateContent;
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
  }, [form, templateContent, variables, compiledHtml, variableDefaults]);

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
