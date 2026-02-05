"use client";

import type { EmailType, Template } from "@wraps/db";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SenderDefaults } from "@/actions/organizations";
import { getSenderDefaultsAction } from "@/actions/organizations";
import {
  useDeleteTemplate,
  useDuplicateTemplate,
  usePublishTemplate,
  useUnpublishTemplate,
  useUpdateTemplate,
} from "@/hooks/use-template-queries";
import { cn } from "@/lib/utils";
import { CodeTemplateDesignView } from "./code-template-design-view";
import {
  CodeTemplateToolbar,
  type CodeTemplateView,
} from "./code-template-toolbar";
import { EditorErrorBoundary } from "./editor-error-boundary";

const CodeTemplateCodeView = dynamic(
  () =>
    import("./code-template-code-view").then((m) => m.CodeTemplateCodeView),
  { ssr: false }
);

const SendTestModal = dynamic(
  () => import("./send-test-modal").then((m) => m.SendTestModal),
  { ssr: false }
);

type CodeTemplateEditorProps = {
  orgSlug: string;
  templateId: string;
  template: Template;
  className?: string;
};

export function CodeTemplateEditor({
  orgSlug,
  templateId,
  template,
  className,
}: CodeTemplateEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = useState<CodeTemplateView>("code");
  const [showSendTestModal, setShowSendTestModal] = useState(false);
  const [subject, setSubject] = useState(template.subject ?? "");
  const [previewText, setPreviewText] = useState(template.description ?? "");
  const [emailType, setEmailType] = useState<EmailType>(
    template.emailType ?? "marketing"
  );

  // Sender defaults for test email modal
  const [senderDefaults, setSenderDefaults] = useState<SenderDefaults | null>(
    null
  );
  useEffect(() => {
    getSenderDefaultsAction(orgSlug).then((result) => {
      if (result.success) {
        setSenderDefaults(result.defaults);
      }
    });
  }, [orgSlug]);

  // Mutations
  const updateMutation = useUpdateTemplate(orgSlug, templateId);
  const publishMutation = usePublishTemplate(orgSlug, templateId);
  const unpublishMutation = useUnpublishTemplate(orgSlug, templateId);
  const deleteMutation = useDeleteTemplate(orgSlug);
  const duplicateMutation = useDuplicateTemplate(orgSlug);

  // Handle subject/preview/emailType changes
  const handleSubjectChange = useCallback(
    (
      newSubject: string,
      newPreviewText: string,
      newEmailType: EmailType
    ) => {
      setSubject(newSubject);
      setPreviewText(newPreviewText);
      setEmailType(newEmailType);

      const updates: {
        subject?: string;
        description?: string;
        emailType?: EmailType;
      } = {};
      if (newSubject !== template.subject) {
        updates.subject = newSubject;
      }
      if (newPreviewText !== template.description) {
        updates.description = newPreviewText;
      }
      if (newEmailType !== template.emailType) {
        updates.emailType = newEmailType;
      }
      if (Object.keys(updates).length > 0) {
        updateMutation.mutate(updates);
      }
    },
    [template.subject, template.description, template.emailType, updateMutation]
  );

  // Handle publish
  const handlePublish = useCallback(async () => {
    try {
      // Save subject first if changed
      if (subject !== template.subject) {
        await updateMutation.mutateAsync({ subject });
      }

      const result = await publishMutation.mutateAsync({});

      toast.success(
        template.status === "PUBLISHED"
          ? "Template updated on AWS SES"
          : "Template published to AWS SES",
        { description: result.message }
      );
    } catch (error) {
      toast.error("Failed to publish template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [updateMutation, subject, publishMutation, template.status, template.subject]);

  // Handle unpublish
  const handleUnpublish = useCallback(async () => {
    try {
      const result = await unpublishMutation.mutateAsync();
      toast.success("Template unpublished", {
        description: result.message,
      });
    } catch (error) {
      toast.error("Failed to unpublish template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [unpublishMutation]);

  // Handle duplicate
  const handleDuplicate = useCallback(async () => {
    try {
      const duplicated = await duplicateMutation.mutateAsync(templateId);
      toast.success("Template duplicated", {
        description: `Created "${duplicated.name}"`,
      });
      router.push(`/${orgSlug}/emails/templates/${duplicated.id}`);
    } catch (error) {
      toast.error("Failed to duplicate template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [duplicateMutation, templateId, router, orgSlug]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this template? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(templateId);
      toast.success("Template deleted");
      router.push(`/${orgSlug}/emails/templates`);
    } catch (error) {
      toast.error("Failed to delete template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [deleteMutation, templateId, router, orgSlug]);

  // Handle rename
  const handleRename = useCallback(
    async (name: string, description?: string) => {
      try {
        await updateMutation.mutateAsync({ name, description });
        toast.success("Template renamed");
      } catch (error) {
        toast.error("Failed to rename template", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [updateMutation]
  );

  // Handle source save from code editor or AI
  const handleSourceSaved = useCallback(() => {
    // Invalidate template query cache to refresh data
    queryClient.invalidateQueries({
      queryKey: ["template", orgSlug, templateId],
    });
  }, [queryClient, orgSlug, templateId]);

  // Handle AI "Apply" — save source + switch to code view
  const handleAIApply = useCallback(
    async (source: string, compiledHtml: string) => {
      try {
        const resp = await fetch(
          `/api/${orgSlug}/emails/templates/${templateId}/save-source`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source,
              compiledHtml,
              compiledText: "",
              variables: [],
            }),
          }
        );

        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data.error || "Save failed");
        }

        // Invalidate cache and switch to code view
        handleSourceSaved();
        setView("code");
        toast.success("AI-generated template applied");
      } catch (error) {
        toast.error("Failed to apply template", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [orgSlug, templateId, handleSourceSaved]
  );

  return (
    <EditorErrorBoundary>
      <div
        className={cn(
          "flex h-[calc(100dvh-var(--header-height)-1rem)] flex-col bg-background md:h-[calc(100dvh-var(--header-height)-1.5rem)]",
          className
        )}
      >
        {/* Toolbar */}
        <CodeTemplateToolbar
          emailType={emailType}
          isPublishing={
            publishMutation.isPending || unpublishMutation.isPending
          }
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onPublish={handlePublish}
          onRename={handleRename}
          onSendTest={() => setShowSendTestModal(true)}
          onSubjectChange={handleSubjectChange}
          onUnpublish={handleUnpublish}
          onViewChange={setView}
          orgSlug={orgSlug}
          previewText={previewText}
          subject={subject}
          template={template}
          view={view}
        />

        {/* Content Area */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {view === "design" && (
            <div className="flex-1">
              <CodeTemplateDesignView
                compiledHtml={template.compiledHtml ?? ""}
                currentSource={template.source ?? ""}
                onApply={handleAIApply}
                orgSlug={orgSlug}
                templateId={templateId}
              />
            </div>
          )}

          {view === "code" && (
            <div className="flex-1">
              <CodeTemplateCodeView
                onSourceSaved={handleSourceSaved}
                orgSlug={orgSlug}
                template={template}
                templateId={templateId}
              />
            </div>
          )}
        </div>

        {/* Send Test Modal — editor=null since code templates don't use TipTap */}
        <SendTestModal
          defaultFrom={senderDefaults?.defaultFrom}
          defaultFromName={senderDefaults?.defaultFromName}
          editor={null}
          isOpen={showSendTestModal}
          onClose={() => setShowSendTestModal(false)}
          orgSlug={orgSlug}
          templateId={templateId}
        />
      </div>
    </EditorErrorBoundary>
  );
}
