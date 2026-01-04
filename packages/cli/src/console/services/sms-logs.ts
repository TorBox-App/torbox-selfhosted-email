import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export type SMSLog = {
  messageId: string;
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
  sentAt: number;
  segments?: number;
  accountId?: string;
  errorMessage?: string;
};

export type SMSEvent = {
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

export type SMSDetails = {
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

type FetchSMSLogsOptions = {
  region: string;
  tableName: string;
  accountId?: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
};

/**
 * Fetch SMS logs from DynamoDB
 */
export async function fetchSMSLogs(
  options: FetchSMSLogsOptions
): Promise<SMSLog[]> {
  const {
    region,
    tableName,
    accountId,
    limit = 100,
    startTime,
    endTime,
  } = options;

  const dynamodb = new DynamoDBClient({ region });

  try {
    let items: any[] = [];

    if (accountId) {
      let keyConditionExpression = "accountId = :accountId";
      const expressionAttributeValues: Record<string, any> = {
        ":accountId": { S: accountId },
      };

      if (startTime && endTime) {
        keyConditionExpression += " AND sentAt BETWEEN :startTime AND :endTime";
        expressionAttributeValues[":startTime"] = { N: startTime.toString() };
        expressionAttributeValues[":endTime"] = { N: endTime.toString() };
      } else if (startTime) {
        keyConditionExpression += " AND sentAt >= :startTime";
        expressionAttributeValues[":startTime"] = { N: startTime.toString() };
      }

      const response = await dynamodb.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "accountId-sentAt-index",
          KeyConditionExpression: keyConditionExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ScanIndexForward: false,
        })
      );

      items = response.Items || [];
    } else {
      const response = await dynamodb.send(
        new ScanCommand({
          TableName: tableName,
        })
      );

      items = response.Items || [];
    }

    const unmarshalled = items.map((item) => unmarshall(item));

    // Group events by messageId to get the latest status for each SMS
    const smsMap = new Map<string, any>();

    for (const item of unmarshalled) {
      const messageId = item.messageId;
      const existing = smsMap.get(messageId);

      if (existing) {
        const currentPriority = getSMSEventPriority(item);
        const existingPriority = getSMSEventPriority(existing);

        if (currentPriority > existingPriority) {
          smsMap.set(messageId, item);
        }
      } else {
        smsMap.set(messageId, item);
      }
    }

    const logs = Array.from(smsMap.values())
      .map(normalizeSMSLog)
      .sort((a, b) => b.sentAt - a.sentAt);

    return logs.slice(0, limit);
  } catch (error) {
    console.error("Error fetching SMS logs:", error);
    throw error;
  }
}

/**
 * Get priority for SMS event type (higher = more important)
 * AWS uses TEXT_* prefix for event types
 */
function getSMSEventPriority(item: any): number {
  const type = item.eventType?.toUpperCase();

  // Handle AWS TEXT_* event types
  if (type?.includes("OPTED_OUT")) {
    return 8;
  }
  if (type?.includes("BLOCKED")) {
    return 7;
  }
  if (type?.includes("INVALID")) {
    return 6;
  }
  if (type?.includes("FAILED") || type?.includes("UNKNOWN")) {
    return 5;
  }
  if (type?.includes("CARRIER_UNREACHABLE") || type?.includes("UNREACHABLE")) {
    return 4;
  }
  if (type?.includes("SUCCESSFUL") || type?.includes("DELIVERED")) {
    return 3;
  }
  if (type?.includes("SENT") || type?.includes("PENDING")) {
    return 2;
  }
  if (type?.includes("QUEUED")) {
    return 1;
  }

  return 0;
}

/**
 * Normalize SMS log data from DynamoDB
 * AWS field names: destinationNumber, originationNumber, messageBody, eventType (TEXT_*)
 */
function normalizeSMSLog(data: any): SMSLog {
  let status: SMSLog["status"] = "sent";
  const eventType = data.eventType?.toUpperCase() || "";

  // AWS uses TEXT_* prefix for event types
  if (eventType.includes("SUCCESSFUL") || eventType.includes("DELIVERED")) {
    status = "delivered";
  } else if (
    eventType.includes("FAILED") ||
    eventType.includes("UNREACHABLE") ||
    eventType.includes("UNKNOWN")
  ) {
    status = "failed";
  } else if (eventType.includes("QUEUED") || eventType.includes("PENDING")) {
    status = "queued";
  } else if (eventType.includes("BLOCKED")) {
    status = "blocked";
  } else if (eventType.includes("INVALID")) {
    status = "invalid";
  } else if (eventType.includes("OPTED_OUT")) {
    status = "opted_out";
  } else if (eventType.includes("SENT") || eventType.includes("TTL_EXPIRED")) {
    status = "sent";
  } else if (data.errorMessage) {
    status = "failed";
  }

  // Clean phone numbers - remove leading single quote if present
  const cleanPhone = (phone: string | undefined): string => {
    if (!phone) {
      return "unknown";
    }
    return phone.replace(/^'+/, "");
  };

  return {
    messageId: data.messageId,
    to: cleanPhone(data.destinationNumber),
    from: cleanPhone(data.originationNumber),
    body: data.messageBody || "(message content not stored)",
    status,
    sentAt: Number(data.sentAt || data.timestamp),
    segments: Number(data.segments) || 1,
    accountId: data.accountId,
    errorMessage: data.errorMessage,
  };
}

/**
 * Fetch SMS details by message ID
 */
export async function fetchSMSById(
  messageId: string,
  options: { region: string; tableName: string }
): Promise<SMSDetails | null> {
  const { region, tableName } = options;
  const dynamodb = new DynamoDBClient({ region });

  // Clean phone numbers - remove leading single quote if present
  const cleanPhone = (phone: string | undefined): string => {
    if (!phone) {
      return "unknown";
    }
    return phone.replace(/^'+/, "");
  };

  try {
    const response = await dynamodb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "messageId = :messageId",
        ExpressionAttributeValues: {
          ":messageId": { S: messageId },
        },
      })
    );

    const items = response.Items || [];

    if (items.length === 0) {
      return null;
    }

    const events = items.map((item) => unmarshall(item));

    // Get the first event (all events for same messageId have same phone numbers)
    const primaryEvent = events[0];

    if (!primaryEvent) {
      return null;
    }

    // Determine final status based on event types
    // AWS uses TEXT_* prefix for event types
    let status: SMSDetails["status"] = "sent";
    const hasDelivery = events.some((e) =>
      e.eventType?.toUpperCase().includes("SUCCESSFUL")
    );
    const hasFailed = events.some(
      (e) =>
        e.eventType?.toUpperCase().includes("FAILED") ||
        e.eventType?.toUpperCase().includes("UNREACHABLE") ||
        e.eventType?.toUpperCase().includes("UNKNOWN")
    );
    const hasBlocked = events.some((e) =>
      e.eventType?.toUpperCase().includes("BLOCKED")
    );
    const hasInvalid = events.some((e) =>
      e.eventType?.toUpperCase().includes("INVALID")
    );
    const hasOptedOut = events.some((e) =>
      e.eventType?.toUpperCase().includes("OPTED_OUT")
    );

    if (hasOptedOut) {
      status = "opted_out";
    } else if (hasBlocked) {
      status = "blocked";
    } else if (hasInvalid) {
      status = "invalid";
    } else if (hasFailed) {
      status = "failed";
    } else if (hasDelivery) {
      status = "delivered";
    }

    // Map events to timeline
    const timeline: SMSEvent[] = events
      .map((event) => {
        const eventType = event.eventType?.toUpperCase() || "";
        let type: SMSEvent["type"] = "sent";

        // Map AWS TEXT_* event types
        if (eventType.includes("SUCCESSFUL")) {
          type = "delivered";
        } else if (eventType.includes("FAILED")) {
          type = "failed";
        } else if (
          eventType.includes("PENDING") ||
          eventType.includes("QUEUED")
        ) {
          type = "queued";
        } else if (eventType.includes("BLOCKED")) {
          type = "blocked";
        } else if (eventType.includes("UNREACHABLE")) {
          type = "carrier_unreachable";
        } else if (eventType.includes("INVALID")) {
          type = "invalid";
        } else if (eventType.includes("OPTED_OUT")) {
          type = "opted_out";
        } else if (eventType.includes("TTL_EXPIRED")) {
          type = "ttl_expired";
        }

        // Parse eventData JSON if present for additional metadata
        let eventData: Record<string, any> = {};
        if (event.eventData) {
          try {
            eventData =
              typeof event.eventData === "string"
                ? JSON.parse(event.eventData)
                : event.eventData;
          } catch (_e) {
            // Ignore parse errors
          }
        }

        const metadata: Record<string, any> = {};

        if (eventData.messageStatusDescription) {
          metadata.description = eventData.messageStatusDescription;
        }
        if (eventData.totalMessagePrice) {
          metadata.cost = `$${eventData.totalMessagePrice}`;
        }
        if (eventData.totalCarrierFee) {
          metadata.carrierFee = `$${eventData.totalCarrierFee}`;
        }
        if (eventData.messageEncoding) {
          metadata.encoding = eventData.messageEncoding;
        }
        if (event.errorMessage) {
          metadata.errorMessage = event.errorMessage;
        }

        return {
          type,
          timestamp: Number(event.sentAt || event.timestamp),
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      id: messageId,
      messageId,
      from: cleanPhone(primaryEvent.originationNumber),
      to: cleanPhone(primaryEvent.destinationNumber),
      body: primaryEvent.messageBody || "(message content not stored)",
      status,
      sentAt: Number(primaryEvent.sentAt || primaryEvent.timestamp),
      segments: Number(primaryEvent.segments) || 1,
      events: timeline,
    };
  } catch (error) {
    console.error("Error fetching SMS by ID:", error);
    throw error;
  }
}
