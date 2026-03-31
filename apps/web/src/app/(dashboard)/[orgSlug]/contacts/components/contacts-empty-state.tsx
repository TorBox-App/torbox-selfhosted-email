"use client";

import { BookOpen, Code2, Plus, Upload, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createContact } from "@/actions/contacts";
import { Button } from "@/components/ui/button";
import type { ContactStatus } from "@/lib/contacts";
import type { TopicWithMeta } from "@/lib/topics";
import { ContactFormDialog } from "./contact-form-dialog";
import { ImportContactsDialog } from "./import-contacts-dialog";

const codeSnippet = `import { createClient } from '@wraps.dev/platform';

const client = createClient({
  organizationId: 'org_...',
  apiKey: process.env.WRAPS_API_KEY,
});

const { data } = await client.POST('/v1/contacts/', {
  body: {
    email: 'user@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  },
});`;

type ContactsEmptyStateProps = {
  organizationId: string;
  orgSlug: string;
  topics: TopicWithMeta[];
};

export function ContactsEmptyState({
  organizationId,
  orgSlug,
  topics,
}: ContactsEmptyStateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const handleCreateContact = async (data: {
    email?: string;
    status?: ContactStatus;
    properties?: Record<string, unknown>;
    topicIds?: string[];
  }) => {
    if (!data.email) {
      toast.error("Error", { description: "Email is required" });
      return;
    }
    const email = data.email;
    startTransition(async () => {
      const result = await createContact(organizationId, {
        email,
        status: data.status,
        properties: data.properties,
        topicIds: data.topicIds,
      });
      if (result.success) {
        toast.success("Contact created", {
          description: `${email} has been added.`,
        });
        setCreateDialogOpen(false);
        router.refresh();
      } else {
        toast.error("Error", { description: result.error });
      }
    });
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <h2 className="mb-2 font-semibold text-xl">No contacts yet</h2>
        <p className="mx-auto mb-8 max-w-sm text-muted-foreground text-sm">
          Add contacts manually, import a CSV, or use the Platform SDK to manage
          contacts programmatically.
        </p>

        <div className="mb-6 overflow-hidden rounded-lg border bg-muted/30 text-left">
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
            <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground text-xs">
              create-contact.ts
            </span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
            <code>{codeSnippet}</code>
          </pre>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link
              href="https://wraps.dev/docs/quickstart/platform"
              rel="noopener noreferrer"
              target="_blank"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Read the docs
            </Link>
          </Button>
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add contact
          </Button>
        </div>
      </div>

      <ContactFormDialog
        isPending={isPending}
        mode="create"
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateContact}
        open={createDialogOpen}
        orgSlug={orgSlug}
        proFeaturesEnabled={false}
        topics={[]}
      />

      <ImportContactsDialog
        onImportComplete={() => router.refresh()}
        onOpenChange={setImportDialogOpen}
        open={importDialogOpen}
        organizationId={organizationId}
        topics={topics}
      />
    </div>
  );
}
