import { ArrowLeft, Check, Clock, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CopyButton } from "@/components/cdn";
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { EmailArchiveViewer } from "./EmailArchiveViewer";

type EmailEvent = {
  type:
    | "sent"
    | "delivered"
    | "bounced"
    | "complained"
    | "opened"
    | "clicked"
    | "failed";
  timestamp: number;
  metadata?: Record<string, any>;
};

type EmailDetails = {
  id: string;
  messageId: string;
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  status:
    | "delivered"
    | "bounced"
    | "complained"
    | "sent"
    | "failed"
    | "opened"
    | "clicked";
  sentAt: number;
  events: EmailEvent[];
};

const EVENT_ICONS = {
  sent: Mail,
  delivered: Check,
  bounced: X,
  complained: X,
  opened: Mail,
  clicked: Mail,
  failed: X,
};

const EVENT_COLORS = {
  sent: "text-blue-500",
  delivered: "text-green-500",
  bounced: "text-red-500",
  complained: "text-red-500",
  opened: "text-purple-500",
  clicked: "text-indigo-500",
  failed: "text-red-500",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  delivered: "default",
  sent: "secondary",
  bounced: "destructive",
  complained: "destructive",
  failed: "destructive",
  opened: "default",
  clicked: "default",
};

export function EmailDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState<EmailDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivingEnabled, setArchivingEnabled] = useState(false);

  useEffect(() => {
    async function fetchEmailDetails() {
      try {
        setLoading(true);
        setError(null);

        // Get token from sessionStorage
        const token = sessionStorage.getItem("wraps-auth-token");

        if (!token) {
          throw new Error("Authentication token not found");
        }

        // Fetch deployment config to get archiving status
        try {
          const deploymentResponse = await fetch(
            `/api/settings/deployment?token=${token}`
          );
          if (deploymentResponse.ok) {
            const deploymentData = await deploymentResponse.json();
            setArchivingEnabled(deploymentData.archivingEnabled ?? false);
          }
        } catch (deploymentError) {
          console.warn("Failed to fetch deployment config:", deploymentError);
          // Continue with email fetch even if deployment config fails
        }

        // URL encode the message ID in case it contains special characters
        const encodedId = encodeURIComponent(id || "");
        console.log("Fetching email with ID:", id);
        console.log("Encoded ID:", encodedId);
        console.log(
          "Full URL:",
          `/api/emails/${encodedId}?token=${token.substring(0, 8)}...`
        );

        const response = await fetch(`/api/emails/${encodedId}?token=${token}`);

        if (!response.ok) {
          let errorMessage = "Failed to fetch email details";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (_e) {
            errorMessage = `${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        // Check content type before parsing
        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          const text = await response.text();
          console.error("Non-JSON response:", text);
          throw new Error("Server returned non-JSON response");
        }

        const data = await response.json();
        console.log("Email data received:", {
          id: data.id,
          hasHtmlBody: !!data.htmlBody,
          hasTextBody: !!data.textBody,
          htmlBodyLength: data.htmlBody?.length || 0,
          textBodyLength: data.textBody?.length || 0,
          events: data.events?.length || 0,
        });
        setEmail(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching email details:", err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchEmailDetails();
    }
  }, [id]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatFullTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="text-muted-foreground">Loading email details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button onClick={() => navigate("/email")} size="sm" variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to emails
        </Button>
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="space-y-4">
        <Button onClick={() => navigate("/email")} size="sm" variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to emails
        </Button>
        <div className="rounded-md border p-4 text-muted-foreground text-sm">
          Email not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate("/email")} size="sm" variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Email Metadata */}
      <Card>
        <CardHeader className="space-y-1.5">
          {/* Row 1: Subject */}
          <CardTitle className="flex flex-row items-center gap-2 text-xl">
            <span className="text-xl">{email.subject || "(no subject)"}</span>
            <Badge className="shrink-0" variant={STATUS_VARIANTS[email.status]}>
              {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
            </Badge>
          </CardTitle>
          {/* Row 2: ID */}
          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 truncate rounded bg-muted px-2 py-0.5 font-mono text-muted-foreground text-xs">
              {email.messageId}
            </code>
            <CopyButton
              className="h-6 w-6 shrink-0"
              size="sm"
              value={email.messageId}
              variant="ghost"
            />
          </div>
          {/* Row 3: From → To */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
            <InputGroup className="w-full cursor-text! sm:w-auto sm:min-w-[518px]">
              <InputGroupAddon align="inline-start">
                <InputGroupText>From</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                className="min-w-0 cursor-text! truncate font-mono text-sm *:select-all"
                disabled
                readOnly
                value={email.from}
              />
              <InputGroupAddon align="inline-end">
                <CopyButton
                  className="h-6 w-6"
                  size="sm"
                  value={email.from}
                  variant="ghost"
                />
              </InputGroupAddon>
            </InputGroup>
            <InputGroup className="w-full cursor-text! sm:w-auto sm:min-w-[518px]">
              <InputGroupAddon align="inline-start">
                <InputGroupText>To</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                className="min-w-0 cursor-text! truncate font-mono text-sm *:select-all"
                disabled
                readOnly
                value={
                  email.to.length > 0 ? email.to.join(", ") : "(no recipients)"
                }
              />
              <InputGroupAddon align="inline-end">
                <CopyButton
                  className="h-6 w-6"
                  size="sm"
                  value={email.to.join(", ")}
                  variant="ghost"
                />
              </InputGroupAddon>
            </InputGroup>
            {email.replyTo && (
              <InputGroup className="w-full sm:w-auto sm:max-w-md">
                <InputGroupAddon align="inline-start">
                  <InputGroupText>Reply-To</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  className="min-w-0 truncate font-mono text-sm"
                  readOnly
                  value={email.replyTo}
                />
                <InputGroupAddon align="inline-end">
                  <CopyButton
                    className="h-6 w-6"
                    size="sm"
                    value={email.replyTo}
                    variant="ghost"
                  />
                </InputGroupAddon>
              </InputGroup>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Email Archive Viewer - only show if archiving is enabled */}
      {archivingEnabled && (
        <EmailArchiveViewer
          archivingEnabled={archivingEnabled}
          messageId={email.messageId}
        />
      )}

      {/* Event Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Email Events</CardTitle>
          <CardDescription>
            Lifecycle of this email from send to delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {email.events.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No events recorded yet
              </div>
            ) : (
              email.events.map((event, index) => {
                const Icon = EVENT_ICONS[event.type] || Clock;
                const isLast = index === email.events.length - 1;

                return (
                  <div key={`${event.type}-${event.timestamp}`}>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`rounded-full border-2 border-background bg-muted p-2 ${EVENT_COLORS[event.type]}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        {!isLast && (
                          <div className="my-1 w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-center justify-between">
                          <div className="font-medium capitalize">
                            {event.type}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {formatTimestamp(event.timestamp)}
                          </div>
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {formatFullTimestamp(event.timestamp)}
                        </div>
                        {event.metadata &&
                          Object.keys(event.metadata).length > 0 && (
                            <div className="mt-2 rounded-md border bg-muted/50 p-2 font-mono text-xs">
                              <pre className="overflow-x-auto">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
