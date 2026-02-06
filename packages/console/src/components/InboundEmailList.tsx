import {
  ArrowRight,
  Paperclip,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InboundEmailAddress = {
  address: string;
  name: string;
};

type InboundEmailSummary = {
  emailId: string;
  from: InboundEmailAddress;
  to: InboundEmailAddress[];
  subject: string;
  receivedAt: string;
  hasAttachments: boolean;
  attachmentCount: number;
  spamVerdict: string | null;
  virusVerdict: string | null;
};

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (diffInDays === 1) {
    return "Yesterday";
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }

  return date.toLocaleDateString();
}

export function InboundEmailList() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<InboundEmailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchInbound() {
      try {
        setLoading(true);
        setError(null);

        const token = sessionStorage.getItem("wraps-auth-token");
        if (!token) {
          throw new Error(
            "Authentication token not found. Please use the URL provided by 'wraps console' command."
          );
        }

        const response = await fetch(`/api/inbound?limit=50&token=${token}`);

        if (!response.ok) {
          let errorMessage = "Failed to fetch inbound emails";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        setEmails(data.emails || []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching inbound emails:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInbound();
  }, []);

  const filteredEmails = emails.filter((email) => {
    if (!searchQuery) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    const matchesFrom =
      email.from.address.toLowerCase().includes(query) ||
      email.from.name.toLowerCase().includes(query);
    const matchesSubject = email.subject.toLowerCase().includes(query);
    const matchesTo = email.to.some(
      (t) =>
        t.address.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
    );
    return matchesFrom || matchesSubject || matchesTo;
  });

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inbound emails..."
            value={searchQuery}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="w-[100px]">Attachments</TableHead>
              <TableHead className="w-[80px]">Spam</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={6}
                >
                  Loading inbound emails...
                </TableCell>
              </TableRow>
            ) : filteredEmails.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={6}
                >
                  {emails.length === 0
                    ? "No inbound emails received yet"
                    : "No emails match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filteredEmails.map((email) => (
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  key={email.emailId}
                  onClick={() => navigate(`/email/inbound/${email.emailId}`)}
                >
                  <TableCell className="font-mono text-sm">
                    {email.from.name || email.from.address}
                    {email.from.name && (
                      <span className="ml-1 text-muted-foreground text-xs">
                        &lt;{email.from.address}&gt;
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {email.subject || "(no subject)"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTimestamp(email.receivedAt)}
                  </TableCell>
                  <TableCell>
                    {email.hasAttachments && (
                      <Badge
                        className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20"
                        variant="outline"
                      >
                        <Paperclip className="mr-1 h-3 w-3" />
                        {email.attachmentCount}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {email.spamVerdict === "PASS" ? (
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                    ) : email.spamVerdict === "FAIL" ? (
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredEmails.length > 0 && !loading && (
        <div className="flex items-center justify-between text-muted-foreground text-sm">
          <div>
            Showing {filteredEmails.length} of {emails.length} inbound emails
          </div>
        </div>
      )}
    </div>
  );
}
