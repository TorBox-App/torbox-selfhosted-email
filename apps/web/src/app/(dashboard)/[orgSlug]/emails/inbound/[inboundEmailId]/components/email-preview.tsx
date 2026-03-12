"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Paperclip,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { InboundEmailDetail } from "@/lib/aws/s3-inbound";

type EmailPreviewProps = {
  email: InboundEmailDetail;
  orgSlug: string;
};

function formatAddress(addr: { address: string; name: string }): string {
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VerdictBadge({
  label,
  verdict,
}: {
  label: string;
  verdict: string | null | undefined;
}) {
  if (!verdict) {
    return null;
  }
  const pass = verdict === "PASS";
  return (
    <Badge
      className={
        pass
          ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
          : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
      }
      variant="outline"
    >
      {pass ? (
        <ShieldCheck className="mr-1 h-3 w-3" />
      ) : (
        <ShieldAlert className="mr-1 h-3 w-3" />
      )}
      {label}: {verdict}
    </Badge>
  );
}

export function EmailPreview({ email, orgSlug }: EmailPreviewProps) {
  const router = useRouter();
  const [headersOpen, setHeadersOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        onClick={() => router.push(`/${orgSlug}/emails/inbound`)}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to inbound
      </Button>

      {/* Header Card */}
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-xl">
            {email.subject || "(no subject)"}
          </CardTitle>

          {/* Verdicts */}
          <div className="flex flex-wrap gap-2">
            <VerdictBadge label="Spam" verdict={email.spamVerdict} />
            <VerdictBadge label="Virus" verdict={email.virusVerdict} />
            <VerdictBadge
              label="DKIM"
              verdict={email.headers["x-ses-dkim-verdict"]}
            />
            <VerdictBadge
              label="SPF"
              verdict={email.headers["x-ses-spf-verdict"]}
            />
            <VerdictBadge
              label="DMARC"
              verdict={email.headers["x-ses-dmarc-verdict"]}
            />
          </div>

          {/* Message ID */}
          <code className="block truncate rounded bg-muted px-2 py-1 font-mono text-muted-foreground text-xs">
            {email.messageId}
          </code>

          {/* From / To / CC */}
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="w-12 shrink-0 font-medium text-muted-foreground">
                From
              </span>
              <span className="font-mono">{formatAddress(email.from)}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-12 shrink-0 font-medium text-muted-foreground">
                To
              </span>
              <span className="font-mono">
                {email.to.map(formatAddress).join(", ") || "(no recipients)"}
              </span>
            </div>
            {email.cc.length > 0 && (
              <div className="flex gap-2">
                <span className="w-12 shrink-0 font-medium text-muted-foreground">
                  CC
                </span>
                <span className="font-mono">
                  {email.cc.map(formatAddress).join(", ")}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="w-12 shrink-0 font-medium text-muted-foreground">
                Date
              </span>
              <span>{new Date(email.receivedAt).toLocaleString()}</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Body */}
      <Card>
        <CardHeader>
          <CardTitle>Message Body</CardTitle>
          {email.htmlTruncated && (
            <CardDescription className="text-amber-600">
              HTML content was truncated due to size limits
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {email.html ? (
            <iframe
              className="h-[500px] w-full rounded-md border bg-card"
              sandbox="allow-same-origin"
              srcDoc={email.html}
              title="Email content"
            />
          ) : email.text ? (
            <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-4 font-mono text-sm">
              {email.text}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">No message body</p>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments ({email.attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {email.attachments.map((att) => (
                <div
                  className="flex items-center justify-between rounded-md border p-3"
                  key={att.id}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{att.filename}</div>
                      <div className="text-muted-foreground text-xs">
                        {att.contentType} &middot; {formatFileSize(att.size)}
                        {att.contentDisposition === "inline" && (
                          <Badge
                            className="ml-2 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                            variant="outline"
                          >
                            inline
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Headers */}
      <Collapsible onOpenChange={setHeadersOpen} open={headersOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <CardTitle className="flex items-center justify-between">
                <span>Raw Headers</span>
                {headersOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-4 font-mono text-xs">
                {Object.entries(email.headers)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join("\n")}
              </pre>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
