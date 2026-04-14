import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { ArrowLeft, Check, Clock, MessageSquare, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type SMSEvent = {
  type:
    | "sent"
    | "delivered"
    | "failed"
    | "queued"
    | "blocked"
    | "carrier_unreachable"
    | "invalid"
    | "opted_out"
    | "ttl_expired";
  timestamp: number;
  metadata?: Record<string, any>;
};

type SMSDetails = {
  id: string;
  messageId: string;
  from: string;
  to: string;
  body: string;
  status:
    | "sent"
    | "delivered"
    | "failed"
    | "queued"
    | "blocked"
    | "invalid"
    | "opted_out";
  sentAt: number;
  segments: number;
  events: SMSEvent[];
};

const EVENT_ICONS = {
  sent: MessageSquare,
  delivered: Check,
  failed: X,
  queued: Clock,
  blocked: X,
  carrier_unreachable: Phone,
  invalid: X,
  opted_out: X,
  ttl_expired: Clock,
};

const EVENT_COLORS = {
  sent: "text-blue-500",
  delivered: "text-green-500",
  failed: "text-red-500",
  queued: "text-gray-500",
  blocked: "text-orange-500",
  carrier_unreachable: "text-red-500",
  invalid: "text-red-500",
  opted_out: "text-yellow-500",
  ttl_expired: "text-gray-500",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  delivered: "default",
  sent: "secondary",
  queued: "secondary",
  failed: "destructive",
  blocked: "destructive",
  invalid: "destructive",
  opted_out: "default",
};

export function SMSDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sms, setSms] = useState<SMSDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSMSDetails() {
      try {
        setLoading(true);
        setError(null);

        // Get token from sessionStorage
        const token = sessionStorage.getItem("wraps-auth-token");

        if (!token) {
          throw new Error("Authentication token not found");
        }

        // URL encode the message ID in case it contains special characters
        const encodedId = encodeURIComponent(id || "");

        const response = await fetch(`/api/sms/${encodedId}?token=${token}`);

        if (!response.ok) {
          let errorMessage = "Failed to fetch SMS details";
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
        setSms(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching SMS details:", err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchSMSDetails();
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

  const formatPhoneNumber = (phone: string) => {
    // Format as (XXX) XXX-XXXX for US numbers
    if (phone.startsWith("+1") && phone.length === 12) {
      return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="text-muted-foreground">Loading SMS details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button onClick={() => navigate("/sms")} size="sm" variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to messages
        </Button>
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!sms) {
    return (
      <div className="space-y-4">
        <Button onClick={() => navigate("/sms")} size="sm" variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to messages
        </Button>
        <div className="rounded-md border p-4 text-muted-foreground text-sm">
          SMS message not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button onClick={() => navigate("/sms")} size="sm" variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to messages
        </Button>
        <Badge variant={STATUS_VARIANTS[sms.status]}>
          {sms.status.charAt(0).toUpperCase() +
            sms.status.slice(1).replace("_", " ")}
        </Badge>
      </div>

      {/* SMS Metadata */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <MessageSquare className="h-6 w-6" />
                SMS Message
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {sms.messageId}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-muted-foreground text-sm">FROM</div>
              <div className="font-mono text-sm">
                {formatPhoneNumber(sms.from)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-sm">TO</div>
              <div className="font-mono text-sm">
                {formatPhoneNumber(sms.to)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-sm">SEGMENTS</div>
              <div className="font-mono text-sm">{sms.segments}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-sm">ID</div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {sms.id}
                </code>
                <Button
                  className="h-6 w-6"
                  onClick={() => navigator.clipboard.writeText(sms.id)}
                  size="icon"
                  variant="ghost"
                >
                  <span className="sr-only">Copy ID</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Content */}
      <Card>
        <CardHeader>
          <CardTitle>Message Content</CardTitle>
          <CardDescription>The SMS message body</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/50 p-4">
            <p className="whitespace-pre-wrap text-sm">{sms.body}</p>
          </div>
        </CardContent>
      </Card>

      {/* Event Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Message Events</CardTitle>
          <CardDescription>
            Lifecycle of this message from send to delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sms.events.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No events recorded yet
              </div>
            ) : (
              sms.events.map((event, index) => {
                const Icon = EVENT_ICONS[event.type] || Clock;
                const isLast = index === sms.events.length - 1;

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
                            {event.type.replace("_", " ")}
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
