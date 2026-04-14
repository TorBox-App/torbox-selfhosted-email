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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wraps/ui/components/ui/tooltip";
import { MessageSquare, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type SMSLog = {
  id: string;
  to: string;
  from: string;
  body: string;
  status:
    | "sent"
    | "delivered"
    | "failed"
    | "queued"
    | "blocked"
    | "invalid"
    | "opted_out";
  timestamp: number;
  messageId: string;
  segments?: number;
};

type StatusConfig = {
  variant: "default" | "secondary" | "destructive" | "outline";
  description: string;
  className?: string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  delivered: {
    variant: "default",
    description: "Message was delivered to recipient's device",
    className:
      "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 border-green-500/20",
  },
  sent: {
    variant: "secondary",
    description: "Message was sent but delivery not yet confirmed",
    className:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20",
  },
  queued: {
    variant: "secondary",
    description: "Message is queued for delivery",
    className:
      "bg-gray-500/10 text-gray-700 dark:text-gray-400 hover:bg-gray-500/20 border-gray-500/20",
  },
  failed: {
    variant: "destructive",
    description: "Message failed to deliver",
    className:
      "bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 border-red-500/20",
  },
  blocked: {
    variant: "destructive",
    description: "Message was blocked by carrier or filter",
    className:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 hover:bg-orange-500/20 border-orange-500/20",
  },
  invalid: {
    variant: "destructive",
    description: "Invalid phone number or message format",
    className:
      "bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 border-red-500/20",
  },
  opted_out: {
    variant: "default",
    description: "Recipient has opted out of receiving messages",
    className:
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/20",
  },
};

export function SMSLogs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("15");
  const [statusFilter, setStatusFilter] = useState("all");
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch SMS logs from API
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
          `/api/sms?startTime=${startTime}&endTime=${endTime}&limit=100&token=${token}`
        );

        if (!response.ok) {
          let errorMessage = "Failed to fetch SMS logs";
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
            body: log.body,
            status: log.status,
            timestamp: log.sentAt,
            messageId: log.messageId,
            segments: log.segments,
          }))
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching SMS logs:", err);
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
      const matchesRecipient = log.to.toLowerCase().includes(query);
      const matchesBody = log.body.toLowerCase().includes(query);

      if (!(matchesRecipient || matchesBody)) {
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

  const formatPhoneNumber = (phone: string) => {
    // Format as (XXX) XXX-XXXX for US numbers
    if (phone.startsWith("+1") && phone.length === 12) {
      return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          SMS Messages
        </CardTitle>
        <CardDescription>
          View and manage your SMS sending history
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by phone or message..."
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
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="opted_out">Opted Out</SelectItem>
            </SelectContent>
          </Select>

          <Button size="icon" variant="outline">
            <span className="sr-only">Download</span>
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
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
                    Loading SMS logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="h-24 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    No SMS messages found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    key={log.id}
                    onClick={() => navigate(`/sms/${log.id}`)}
                  >
                    <TableCell className="font-mono text-sm">
                      {formatPhoneNumber(log.to)}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            className={STATUS_CONFIG[log.status]?.className}
                            variant={
                              STATUS_CONFIG[log.status]?.variant ?? "default"
                            }
                          >
                            {log.status.charAt(0).toUpperCase() +
                              log.status.slice(1).replace("_", " ")}
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
                      {log.body}
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
                        <span className="sr-only">More options</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filteredLogs.length > 0 && !loading && (
          <div className="mt-4 flex items-center justify-between text-muted-foreground text-sm">
            <div>
              Showing {filteredLogs.length} of {logs.length} messages
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
