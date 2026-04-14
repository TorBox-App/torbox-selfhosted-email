"use client";

import { Alert, AlertDescription } from "@wraps/ui/components/ui/alert";
import { Label } from "@wraps/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wraps/ui/components/ui/select";
import { AlertCircle, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getVerifiedDomains,
  type VerifiedIdentity,
} from "@/actions/aws-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTemplates } from "@/hooks/use-template-queries";
import { useWorkflowStore } from "../use-workflow-store";
import type { NodeConfigProps } from "./index";

export function SendEmailConfig({
  config,
  onChange,
  orgSlug,
}: NodeConfigProps) {
  const organizationId = useWorkflowStore(
    (state) => state.workflow?.organizationId
  );
  const awsAccountId = useWorkflowStore(
    (state) => state.workflow?.awsAccountId
  );

  const { data: templatesData } = useTemplates(orgSlug);
  const templates = templatesData ?? [];

  const [verifiedDomains, setVerifiedDomains] = useState<VerifiedIdentity[]>(
    []
  );
  const [domainsLoading, setDomainsLoading] = useState(false);

  const fetchDomains = useCallback(
    async (accountId: string, forceRefresh = false) => {
      if (!(accountId && organizationId)) {
        setVerifiedDomains([]);
        return;
      }
      setDomainsLoading(true);
      try {
        const result = await getVerifiedDomains(
          accountId,
          organizationId,
          forceRefresh
        );
        if (result.success) {
          setVerifiedDomains(result.identities);
        }
      } finally {
        setDomainsLoading(false);
      }
    },
    [organizationId]
  );

  useEffect(() => {
    if (awsAccountId) {
      fetchDomains(awsAccountId);
    }
  }, [awsAccountId, fetchDomains]);

  const handleCreateNewTemplate = () => {
    window.open(`/${orgSlug}/emails/templates/new`, "_blank");
  };

  const handleEditTemplate = (templateId: string) => {
    window.open(`/${orgSlug}/emails/templates/${templateId}`, "_blank");
  };

  if (config.type !== "send_email") {
    return null;
  }

  const selectedTemplate = templates.find((t) => t.id === config.templateId);
  const domainIdentities = verifiedDomains.filter((d) => d.type === "DOMAIN");

  const existingFrom = config.from || "";
  const [fromPrefix, fromDomain] = existingFrom.includes("@")
    ? existingFrom.split("@")
    : [existingFrom, ""];

  const hasUnverifiedDomain =
    fromDomain &&
    !domainsLoading &&
    !domainIdentities.some((d) => d.identity === fromDomain);

  const handleFromChange = (prefix: string, domain: string) => {
    if (prefix && domain) {
      onChange({ from: `${prefix}@${domain}` });
    } else if (!(prefix || domain)) {
      onChange({ from: undefined });
    }
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Email Template</Label>
          <button
            className="flex items-center gap-1 text-primary text-xs hover:underline"
            onClick={handleCreateNewTemplate}
            type="button"
          >
            <Plus className="h-3 w-3" />
            Create new
          </button>
        </div>
        <div className="flex gap-2">
          <Select
            onValueChange={(value) => {
              onChange({ templateId: value });
            }}
            value={config.templateId || ""}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {config.templateId && (
            <Button
              aria-label="Edit template"
              onClick={() => handleEditTemplate(config.templateId!)}
              size="icon"
              title="Edit template"
              variant="outline"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {templates.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No templates available.{" "}
            <button
              className="text-primary hover:underline"
              onClick={handleCreateNewTemplate}
              type="button"
            >
              Create one
            </button>
          </p>
        )}
      </div>

      {selectedTemplate && (
        <div className="space-y-2">
          <Label htmlFor="subject-override">Subject Line (optional)</Label>
          <Input
            id="subject-override"
            onChange={(e) => onChange({ subject: e.target.value || undefined })}
            placeholder={
              selectedTemplate.subject || "No subject set on template"
            }
            value={config.subject || ""}
          />
          <p className="text-muted-foreground text-xs">
            {config.subject
              ? "Overrides the template subject for this step."
              : `Using template subject: ${selectedTemplate.subject || "(no subject)"}`}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>From Address (optional)</Label>
          <Button
            aria-label="Refresh domains"
            className="h-6 w-6"
            disabled={domainsLoading}
            onClick={() =>
              awsAccountId ? fetchDomains(awsAccountId, true) : undefined
            }
            size="icon"
            title="Refresh domains"
            type="button"
            variant="ghost"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${domainsLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        {domainIdentities.length > 0 ? (
          <div className="flex items-center gap-1">
            <Input
              className="flex-1"
              onChange={(e) => handleFromChange(e.target.value, fromDomain)}
              placeholder="hello"
              value={fromPrefix}
            />
            <span className="text-muted-foreground text-sm">@</span>
            <Select
              onValueChange={(value) => handleFromChange(fromPrefix, value)}
              value={fromDomain}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent>
                {domainIdentities.map((domain) => (
                  <SelectItem key={domain.identity} value={domain.identity}>
                    {domain.identity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : domainsLoading ? (
          <p className="text-muted-foreground text-xs">Loading domains...</p>
        ) : existingFrom ? (
          <div className="flex items-center gap-1">
            <Input className="flex-1" readOnly value={existingFrom} />
            <Button
              aria-label="Clear from address"
              className="h-9 w-9 shrink-0"
              onClick={() => onChange({ from: undefined })}
              size="icon"
              title="Clear from address"
              type="button"
              variant="ghost"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            No verified domains. Configure in Workflow Settings.
          </p>
        )}
        {hasUnverifiedDomain && (
          <Alert className="py-2" variant="destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">
              Domain "{fromDomain}" is not verified. Emails may fail to send.
            </AlertDescription>
          </Alert>
        )}
        <p className="text-muted-foreground text-xs">
          Overrides the workflow default from address for this step.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="from-name">From Name (optional)</Label>
        <Input
          id="from-name"
          onChange={(e) => onChange({ fromName: e.target.value })}
          placeholder="e.g., Acme Team"
          value={config.fromName || ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reply-to">Reply To (optional)</Label>
        <Input
          id="reply-to"
          onChange={(e) => onChange({ replyTo: e.target.value })}
          placeholder="e.g., support@acme.com"
          type="email"
          value={config.replyTo || ""}
        />
      </div>
    </>
  );
}
