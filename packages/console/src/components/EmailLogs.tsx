import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { Input } from "@wraps/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wraps/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wraps/ui/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wraps/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wraps/ui/components/ui/tooltip";
import { Search } from "lucide-react";
import { type ComponentProps, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { InboundEmailList } from "@/components/InboundEmailList";

type EmailLog = {
  id: string;
  to: string[]; // Array of recipients
  from: string;
  subject: string;
  status:
    | "delivered"
    | "bounced"
    | "complained"
    | "sent"
    | "failed"
    | "opened"
    | "clicked"
    | "suppressed";
  timestamp: number;
  messageId: string;
};

type StatusConfig = {
  variant: ComponentProps<typeof Badge>["variant"];
  description: string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  clicked: {
    variant: "brand",
    description: "Recipient clicked a link in the email",
  },
  opened: {
    variant: "info",
    description: "Recipient opened the email",
  },
  delivered: {
    variant: "success",
    description: "Email was successfully delivered to recipient's mailbox",
  },
  sent: {
    variant: "secondary",
    description: "Email was sent but delivery not yet confirmed",
  },
  bounced: {
    variant: "warning",
    description: "Email bounced - recipient's mailbox may not exist or be full",
  },
  suppressed: {
    variant: "warning",
    description: "Email blocked - recipient is on the suppression list",
  },
  complained: {
    variant: "destructive",
    description: "Recipient marked this email as spam",
  },
  failed: {
    variant: "destructive",
    description: "Email failed to send due to an error",
  },
};

export function EmailLogs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("15");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "receiving" ? "receiving" : "sending"
  );
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch email logs from API
  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        setError(null);

        // Get token from sessionStorage or URL params
        let token = sessionStorage.getItem("wraps-auth-token");

        if (!token) {
          const params = new URLSearchParams(window.location.search);
          token = params.get("token");

          // Store token for future use
          if (token) {
            sessionStorage.setItem("wraps-auth-token", token);
          }
        }

        if (!token) {
          throw new Error(
            "Authentication token not found. Please use the URL provided by 'wraps console' command."
          );
        }

        // Calculate time range
        const daysAgo = Number.parseInt(dateRange, 10);
        const startTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
        const endTime = Date.now();

        const response = await fetch(
          `/api/emails?startTime=${startTime}&endTime=${endTime}&limit=100&token=${token}`
        );

        if (!response.ok) {
          let errorMessage = "Failed to fetch email logs";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (_e) {
            // Response wasn't JSON, use status text
            errorMessage = `${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        setLogs(
          data.logs.map((log: any) => ({
            id: log.messageId,
            to: log.to,
            from: log.from,
            subject: log.subject,
            status: log.status,
            timestamp: log.sentAt,
            messageId: log.messageId,
          }))
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching email logs:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [dateRange]);

  const filteredLogs = logs.filter((log) => {
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesRecipient = log.to.some((recipient) =>
        recipient.toLowerCase().includes(query)
      );
      const matchesSubject = log.subject.toLowerCase().includes(query);

      if (!(matchesRecipient || matchesSubject)) {
        return false;
      }
    }

    // Filter by status
    if (statusFilter !== "all" && log.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 0) {
      return "Today";
    }
    if (diffInDays === 1) {
      return "Yesterday";
    }
    if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    }

    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emails</CardTitle>
        <CardDescription>
          View and manage your email sending history
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          onValueChange={(tab) => {
            setActiveTab(tab);
            setSearchParams(tab === "sending" ? {} : { tab });
          }}
          value={activeTab}
        >
          <TabsList>
            <TabsTrigger value="sending">Sending</TabsTrigger>
            <TabsTrigger value="receiving">Receiving</TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-4" value="sending">
            {/* Error State */}
            {error && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  value={searchQuery}
                />
              </div>

              <Select onValueChange={setDateRange} value={dateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="15">Last 15 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>

              <Select onValueChange={setStatusFilter} value={statusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="clicked">Clicked</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="suppressed">Suppressed</SelectItem>
                  <SelectItem value="complained">Complained</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Button size="icon" variant="outline">
                <span className="sr-only">Download</span>↓
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        className="h-24 text-center text-muted-foreground"
                        colSpan={5}
                      >
                        Loading email logs...
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className="h-24 text-center text-muted-foreground"
                        colSpan={5}
                      >
                        No emails found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        key={log.id}
                        onClick={() => navigate(`/email/${log.id}`)}
                      >
                        <TableCell className="font-mono text-sm">
                          {log.to.length > 0 ? (
                            <>
                              {log.to[0]}
                              {log.to.length > 1 && (
                                <span className="ml-1 text-muted-foreground text-xs">
                                  +{log.to.length - 1} more
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              (no recipients)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={
                                  STATUS_CONFIG[log.status]?.variant ??
                                  "default"
                                }
                              >
                                {log.status.charAt(0).toUpperCase() +
                                  log.status.slice(1)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {STATUS_CONFIG[log.status]?.description ??
                                  "Unknown status"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="max-w-[400px] truncate">
                          {log.subject}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Add menu actions here later
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <span className="sr-only">More options</span>⋯
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination would go here */}
            {filteredLogs.length > 0 && !loading && (
              <div className="flex items-center justify-between text-muted-foreground text-sm">
                <div>
                  Showing {filteredLogs.length} of {logs.length} emails
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent className="space-y-4" value="receiving">
            <InboundEmailList />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
