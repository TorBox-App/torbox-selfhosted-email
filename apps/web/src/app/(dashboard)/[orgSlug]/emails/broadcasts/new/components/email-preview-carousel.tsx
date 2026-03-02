"use client";

import type { JSONContent } from "@tiptap/core";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { RecipientFilter } from "@/actions/batch";
import { getSampleContacts, getTemplateContent } from "@/actions/batch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SampleContact } from "@/lib/batch";
import { renderTipTapToHtml } from "@/lib/serializers/tiptap-to-react-email";

type EmailPreviewCarouselProps = {
  organizationId: string;
  templateId: string;
  recipientFilter: RecipientFilter;
  variableMappings: Array<{
    variableName: string;
    source:
      | { type: "static"; value: string }
      | { type: "contact"; field: string };
  }>;
};

export function EmailPreviewCarousel({
  organizationId,
  templateId,
  recipientFilter,
  variableMappings,
}: EmailPreviewCarouselProps) {
  const [contacts, setContacts] = useState<SampleContact[]>([]);
  const [templateContent, setTemplateContent] = useState<JSONContent | null>(
    null
  );
  const [compiledHtml, setCompiledHtml] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string>("");

  // Fetch contacts and template content on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const [contactsResult, templateResult] = await Promise.all([
        getSampleContacts(organizationId, "email", recipientFilter, 5),
        getTemplateContent(organizationId, templateId),
      ]);

      if (contactsResult.success) {
        setContacts(contactsResult.contacts);
      }
      if (templateResult.success) {
        setTemplateContent(templateResult.content as JSONContent);
        setCompiledHtml(templateResult.compiledHtml);
        setSourceFormat(templateResult.sourceFormat);
      }

      setLoading(false);
    }

    if (templateId) {
      fetchData();
    }
  }, [organizationId, templateId, recipientFilter]);

  // Build test data from contact and variable mappings
  const testData = useMemo(() => {
    if (contacts.length === 0) {
      return {};
    }

    const contact = contacts[currentIndex];
    if (!contact) {
      return {};
    }

    const data: Record<string, string> = {
      // Default contact fields
      "contact.email": contact.email ?? "",
      "contact.firstName": contact.firstName ?? "",
      "contact.lastName": contact.lastName ?? "",
      "contact.company": contact.company ?? "",
      // Shorter aliases
      firstName: contact.firstName ?? "",
      lastName: contact.lastName ?? "",
      email: contact.email ?? "",
      company: contact.company ?? "",
    };

    // Apply variable mappings
    for (const mapping of variableMappings) {
      if (mapping.source.type === "static") {
        data[mapping.variableName] = mapping.source.value;
      } else if (mapping.source.type === "contact") {
        const field = mapping.source.field;
        const contactValue =
          field === "firstName"
            ? contact.firstName
            : field === "lastName"
              ? contact.lastName
              : field === "email"
                ? contact.email
                : field === "company"
                  ? contact.company
                  : null;
        data[mapping.variableName] = contactValue ?? "";
      }
    }

    return data;
  }, [contacts, currentIndex, variableMappings]);

  // Render HTML when template or test data changes
  useEffect(() => {
    // For code-pushed templates, use pre-compiled HTML directly
    if (sourceFormat === "react-email" && compiledHtml) {
      setHtmlContent(compiledHtml);
      return;
    }

    if (!templateContent) {
      return;
    }

    let cancelled = false;

    async function renderHtml() {
      try {
        const html = await renderTipTapToHtml(templateContent!, testData);
        if (!cancelled) {
          setHtmlContent(html);
        }
      } catch {
        if (!cancelled) {
          setHtmlContent("<p>Error rendering preview</p>");
        }
      }
    }

    renderHtml();

    return () => {
      cancelled = true;
    };
  }, [templateContent, testData, sourceFormat, compiledHtml]);

  const currentContact = contacts[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : contacts.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < contacts.length - 1 ? prev + 1 : 0));
  };

  if (!templateId) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (contacts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No contacts found to preview.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email Preview ({currentIndex + 1} of {contacts.length})
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              disabled={contacts.length <= 1}
              onClick={handlePrev}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              disabled={contacts.length <= 1}
              onClick={handleNext}
              size="icon"
              variant="ghost"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {currentContact && (
          <p className="text-muted-foreground text-sm">
            Previewing as:{" "}
            <span className="font-medium text-foreground">
              {[currentContact.firstName, currentContact.lastName]
                .filter(Boolean)
                .join(" ") || "Unknown"}
            </span>{" "}
            <span className="text-muted-foreground">
              &lt;{currentContact.email}&gt;
            </span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border bg-white">
          <iframe
            className="h-[400px] w-full border-0"
            sandbox="allow-same-origin"
            srcDoc={htmlContent}
            title="Email Preview"
          />
        </div>
      </CardContent>
    </Card>
  );
}
