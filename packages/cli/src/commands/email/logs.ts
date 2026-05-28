import * as clack from "@clack/prompts";
import pc from "picocolors";
import { getApiBaseUrl, resolveTokenAsync } from "../../utils/shared/config.js";
import {
  isJsonMode,
  jsonError,
  jsonSuccess,
} from "../../utils/shared/json-output.js";

type EmailLogsListOptions = {
  status?: string;
  limit?: string;
  cursor?: string;
  json?: boolean;
  token?: string;
  region?: string;
};

type EmailLogsGetOptions = {
  messageId: string;
  json?: boolean;
  token?: string;
  region?: string;
};

type EmailLogItem = {
  id: string;
  messageId: string | null;
  status: string;
  recipient: string;
  subject: string | null;
  from: string | null;
  sourceType: string;
  sentAt: string | null;
  deliveredAt: string | null;
  bouncedAt: string | null;
  bouncedSubType: string | null;
  createdAt: string;
};

function relativeTime(date: string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h > 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

function colorStatus(status: string): string {
  if (["delivered", "opened", "clicked"].includes(status)) {
    return pc.green(status);
  }
  if (["bounced", "complained", "failed", "suppressed"].includes(status)) {
    return pc.red(status);
  }
  return pc.dim(status);
}

function truncate(str: string | null, len: number): string {
  if (!str) return pc.dim("—");
  return str.length > len ? `${str.slice(0, len - 1)}…` : str;
}

export async function emailLogsList(
  options: EmailLogsListOptions
): Promise<void> {
  const token = await resolveTokenAsync({ token: options.token });
  if (!token) {
    if (isJsonMode()) {
      jsonError("email.logs.list", {
        code: "NOT_AUTHENTICATED",
        message: "No API token found. Run: wraps auth login",
      });
    } else {
      clack.log.error("No API token found. Run: wraps auth login");
    }
    return;
  }

  const apiBase = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.limit) params.set("limit", options.limit);
  if (options.cursor) params.set("cursor", options.cursor);

  const resp = await fetch(`${apiBase}/v1/email/logs?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const err = (await resp
      .json()
      .catch(() => ({ error: "Request failed" }))) as { error?: string };
    if (isJsonMode()) {
      jsonError("email.logs.list", {
        code: "API_ERROR",
        message: err.error ?? `HTTP ${resp.status}`,
      });
    } else {
      clack.log.error(
        `Failed to fetch logs: ${err.error ?? `HTTP ${resp.status}`}`
      );
    }
    return;
  }

  const data = (await resp.json()) as {
    logs: EmailLogItem[];
    total: number | null;
    nextCursor: string | null;
  };

  if (isJsonMode()) {
    jsonSuccess("email.logs.list", data as unknown as Record<string, unknown>);
    return;
  }

  if (data.logs.length === 0) {
    clack.log.info("No email logs found.");
    return;
  }

  const COL = { time: 8, status: 11, to: 28, subject: 40, msgId: 18 };
  const header =
    pc.bold("Time".padEnd(COL.time)) +
    "  " +
    pc.bold("Status".padEnd(COL.status)) +
    "  " +
    pc.bold("To".padEnd(COL.to)) +
    "  " +
    pc.bold("Subject".padEnd(COL.subject)) +
    "  " +
    pc.bold("Message ID");

  const rows = data.logs.map((log) => {
    const time = relativeTime(log.createdAt).padEnd(COL.time);
    const status = colorStatus(log.status.padEnd(COL.status));
    const to = truncate(log.recipient, COL.to).padEnd(COL.to);
    const subject = truncate(log.subject, COL.subject).padEnd(COL.subject);
    const msgId = truncate(log.messageId, COL.msgId);
    return `${time}  ${status}  ${to}  ${subject}  ${msgId}`;
  });

  clack.note(
    [header, ...rows].join("\n"),
    data.total !== null ? `Email Logs — ${data.total} total` : "Email Logs"
  );

  if (data.nextCursor) {
    clack.log.info(
      `More logs available. Use: ${pc.cyan(`--cursor ${data.nextCursor}`)}`
    );
  }
}

export async function emailLogsGet(
  options: EmailLogsGetOptions
): Promise<void> {
  const token = await resolveTokenAsync({ token: options.token });
  if (!token) {
    if (isJsonMode()) {
      jsonError("email.logs.get", {
        code: "NOT_AUTHENTICATED",
        message: "No API token found. Run: wraps auth login",
      });
    } else {
      clack.log.error("No API token found. Run: wraps auth login");
    }
    return;
  }

  const apiBase = getApiBaseUrl();
  const resp = await fetch(
    `${apiBase}/v1/email/logs/${encodeURIComponent(options.messageId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (resp.status === 404) {
    if (isJsonMode()) {
      jsonError("email.logs.get", {
        code: "NOT_FOUND",
        message: `No log found for message ID: ${options.messageId}`,
      });
    } else {
      clack.log.error(`No log found for message ID: ${options.messageId}`);
    }
    return;
  }

  if (!resp.ok) {
    const err = (await resp
      .json()
      .catch(() => ({ error: "Request failed" }))) as { error?: string };
    if (isJsonMode()) {
      jsonError("email.logs.get", {
        code: "API_ERROR",
        message: err.error ?? `HTTP ${resp.status}`,
      });
    } else {
      clack.log.error(
        `Failed to fetch log: ${err.error ?? `HTTP ${resp.status}`}`
      );
    }
    return;
  }

  const log = (await resp.json()) as EmailLogItem;

  if (isJsonMode()) {
    jsonSuccess("email.logs.get", log as unknown as Record<string, unknown>);
    return;
  }

  const kv = (label: string, value: string | null | undefined) =>
    `${pc.dim(label.padEnd(16))} ${value ?? pc.dim("—")}`;

  const sentAt = log.sentAt ? new Date(log.sentAt).toLocaleString() : null;
  const deliveredAt = log.deliveredAt
    ? new Date(log.deliveredAt).toLocaleString()
    : null;
  const bouncedAt = log.bouncedAt
    ? new Date(log.bouncedAt).toLocaleString()
    : null;
  const createdAt = new Date(log.createdAt).toLocaleString();

  const lines = [
    kv("Message ID:", log.messageId),
    kv("Status:", log.status ? colorStatus(log.status) : null),
    kv("To:", log.recipient),
    kv("From:", log.from),
    kv("Subject:", log.subject),
    kv("Source:", log.sourceType),
    kv("Sent:", sentAt),
    kv("Delivered:", deliveredAt),
    kv("Bounced:", bouncedAt),
    ...(log.bouncedSubType ? [kv("Bounce type:", log.bouncedSubType)] : []),
    kv("Created:", createdAt),
  ];

  clack.note(
    lines.join("\n"),
    `Log Detail — ${log.messageId ?? "(no message id)"}`
  );
}
