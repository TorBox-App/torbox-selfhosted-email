/**
 * Seed Demo Email & SMS Activity
 *
 * Creates realistic activity data in both PostgreSQL (message_send) and
 * DynamoDB (wraps-email-history, wraps-sms-history) so the dashboard
 * activity feeds and analytics charts show beautiful demo data.
 *
 * Data distribution:
 *   - Growth curve: volume increases over time (organic growth story)
 *   - Weekday/weekend patterns: 3-4x more volume on weekdays
 *   - Business hour bias: 70% of messages during 8am-6pm
 *   - Demo-optimized engagement rates for healthy-looking charts
 *
 * Usage:
 *   pnpm --filter @wraps/db seed:activity
 *
 * Or with specific org:
 *   ORG_ID=xxx pnpm --filter @wraps/db seed:activity
 *
 * Options (via env vars):
 *   ORG_ID - Target organization ID
 *   MESSAGE_COUNT - Number of messages to create (default: 10000)
 *   DAYS_BACK - How far back to generate data (default: 90)
 *   SKIP_DYNAMO - Set to "true" to skip DynamoDB writes (Postgres only)
 */

import {
  BatchWriteItemCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { and, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/schema";

dotenv.config({ path: "../../apps/web/.env.local" });
dotenv.config({ path: "../../.env" });

if (!process.env.DATABASE_URL) {
  console.error(`
DATABASE_URL not found. Either:
  1. Create apps/web/.env.local with DATABASE_URL
  2. Or run with: DATABASE_URL="..." pnpm --filter @wraps/db seed:activity
`);
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

// --- Helpers ---

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function afterDate(base: Date, minMs: number, maxMs: number): Date {
  return new Date(base.getTime() + randomInt(minMs, maxMs));
}

function fakeMessageId(): string {
  const chars = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 36; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// --- Day-by-day distribution helpers ---

function weekdayMultiplier(dow: number): number {
  // 0=Sunday, 6=Saturday. Weekdays get 3-4x more volume than weekends.
  const multipliers = [0.25, 0.85, 1.0, 1.0, 1.0, 0.85, 0.35];
  return multipliers[dow];
}

function growthWeight(dayIndex: number, totalDays: number): number {
  // Exponential growth from ~0.3x to ~1.0x over the period
  const t = dayIndex / Math.max(totalDays - 1, 1);
  return 0.3 + 0.7 * t ** 1.5;
}

function calculateDailyVolumes(
  totalCount: number,
  daysBack: number
): { date: Date; count: number }[] {
  const days: { date: Date; weight: number }[] = [];
  let totalWeight = 0;

  for (let d = 0; d < daysBack; d++) {
    const date = new Date();
    date.setDate(date.getDate() - (daysBack - 1 - d));
    date.setHours(0, 0, 0, 0);

    const dow = date.getDay();
    const noise = 0.85 + Math.random() * 0.3; // +/-15% daily noise
    const weight = growthWeight(d, daysBack) * weekdayMultiplier(dow) * noise;

    days.push({ date, weight });
    totalWeight += weight;
  }

  return days.map((d) => ({
    date: d.date,
    count: Math.max(1, Math.round((totalCount * d.weight) / totalWeight)),
  }));
}

function randomTimeOnDay(baseDate: Date): Date {
  const date = new Date(baseDate);
  // Bias toward business hours (8am-6pm)
  const roll = Math.random();
  let hour: number;
  if (roll < 0.7) {
    hour = 8 + Math.random() * 10; // 8am-6pm (70%)
  } else if (roll < 0.9) {
    hour = 18 + Math.random() * 5; // 6pm-11pm (20%)
  } else {
    hour = Math.random() * 8; // 12am-8am (10%)
  }
  date.setHours(
    Math.floor(hour),
    randomInt(0, 59),
    randomInt(0, 59),
    randomInt(0, 999)
  );
  return date;
}

// --- Email subject lines ---

const transactionalSubjects = [
  { subject: "Your order has been confirmed", from: "orders@" },
  { subject: "Password reset request", from: "security@" },
  { subject: "Your invoice is ready", from: "billing@" },
  { subject: "Welcome to the platform!", from: "hello@" },
  { subject: "Your trial is expiring soon", from: "hello@" },
  { subject: "Verify your email address", from: "noreply@" },
  { subject: "Your export is ready", from: "noreply@" },
  { subject: "New login from a new device", from: "security@" },
  { subject: "Your subscription has been renewed", from: "billing@" },
  { subject: "Shipping confirmation", from: "orders@" },
];

const batchSubjects = [
  { subject: "What's new this month", from: "newsletter@" },
  { subject: "Your weekly digest", from: "digest@" },
  { subject: "Exclusive offer just for you", from: "marketing@" },
  { subject: "We'd love your feedback", from: "feedback@" },
  { subject: "New features you'll love", from: "product@" },
  { subject: "Don't miss out — limited time offer", from: "marketing@" },
  { subject: "Tips to get the most out of your account", from: "success@" },
  { subject: "Year in review: your highlights", from: "hello@" },
];

const smsMessages = [
  "Your verification code is 847291. Do not share this code.",
  "Your order #ORD-48291 has shipped! Track: https://trk.co/abc",
  "Reminder: Your appointment is tomorrow at 2pm.",
  "Flash sale! 30% off everything for the next 24 hours. Shop now: https://shop.co/sale",
  "Your payment of $49.99 was processed successfully.",
  "Welcome! Reply HELP for support or STOP to opt out.",
  "Your delivery arrives today between 2-4pm.",
  "Action needed: Please confirm your account details.",
];

const fromDomains = ["demo.wraps.dev", "notifications.wraps.dev"];

// --- SES event type mappings (what the Lambda processor writes to DynamoDB) ---

const sesEventTypeMap: Record<string, string> = {
  sent: "Send",
  delivered: "Delivery",
  opened: "Open",
  clicked: "Click",
  bounced: "Bounce",
  complained: "Complaint",
  suppressed: "Suppressed",
  failed: "Reject",
};

const smsEventTypeMap: Record<string, string> = {
  sent: "TEXT_SENT",
  delivered: "TEXT_DELIVERED",
  clicked: "TEXT_DELIVERED", // SMS clicks are still delivered
  failed: "TEXT_UNKNOWN",
  opted_out: "TEXT_DELIVERED",
};

// --- Email lifecycle ---
//
// Demo-optimized rates:
//   Delivery:  ~96.5%   (below 4% bounce threshold line)
//   Open rate: ~33%     (of delivered — realistic with Apple MPP)
//   Click rate: ~7.4%   (of delivered)
//   Bounce:    ~1.5%    (well below 4% SES threshold)
//   Complaint: ~0.05%   (well below 0.08% SES threshold)

type EmailLifecycle = {
  status:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "complained"
    | "suppressed"
    | "failed";
  events: (sentAt: Date) => Array<{ eventType: string; timestamp: Date }>;
  bounceType?: string;
  bounceSubType?: string;
  error?: string;
};

function randomEmailLifecycle(): EmailLifecycle {
  const roll = Math.random();

  if (roll < 0.63) {
    // 63% — delivered but never opened
    return {
      status: "delivered",
      events: (sentAt) => {
        const deliveredAt = afterDate(sentAt, 500, 5000);
        return [
          { eventType: "Send", timestamp: sentAt },
          { eventType: "Delivery", timestamp: deliveredAt },
        ];
      },
    };
  }
  if (roll < 0.875) {
    // 24.5% — opened but didn't click
    return {
      status: "opened",
      events: (sentAt) => {
        const deliveredAt = afterDate(sentAt, 500, 5000);
        const openedAt = afterDate(deliveredAt, 60_000, 86_400_000);
        return [
          { eventType: "Send", timestamp: sentAt },
          { eventType: "Delivery", timestamp: deliveredAt },
          { eventType: "Open", timestamp: openedAt },
        ];
      },
    };
  }
  if (roll < 0.945) {
    // 7% — opened and clicked
    return {
      status: "clicked",
      events: (sentAt) => {
        const deliveredAt = afterDate(sentAt, 500, 5000);
        const openedAt = afterDate(deliveredAt, 60_000, 86_400_000);
        const clickedAt = afterDate(openedAt, 5000, 300_000);
        return [
          { eventType: "Send", timestamp: sentAt },
          { eventType: "Delivery", timestamp: deliveredAt },
          { eventType: "Open", timestamp: openedAt },
          { eventType: "Click", timestamp: clickedAt },
        ];
      },
    };
  }
  if (roll < 0.965) {
    // 2% — sent but pending delivery (recent messages)
    return {
      status: "sent",
      events: (sentAt) => [{ eventType: "Send", timestamp: sentAt }],
    };
  }
  if (roll < 0.98) {
    // 1.5% — bounced
    const permanent = Math.random() < 0.6;
    return {
      status: "bounced",
      bounceType: permanent ? "Permanent" : "Transient",
      bounceSubType: permanent
        ? randomChoice(["General", "NoEmail", "Suppressed"])
        : randomChoice(["General", "MailboxFull", "ContentRejected"]),
      events: (sentAt) => {
        const bouncedAt = afterDate(sentAt, 1000, 30_000);
        return [
          { eventType: "Send", timestamp: sentAt },
          { eventType: "Bounce", timestamp: bouncedAt },
        ];
      },
    };
  }
  if (roll < 0.9805) {
    // 0.05% — complained (well below 0.08% SES threshold)
    return {
      status: "complained",
      events: (sentAt) => {
        const deliveredAt = afterDate(sentAt, 500, 5000);
        const complainedAt = afterDate(deliveredAt, 3_600_000, 172_800_000);
        return [
          { eventType: "Send", timestamp: sentAt },
          { eventType: "Delivery", timestamp: deliveredAt },
          { eventType: "Complaint", timestamp: complainedAt },
        ];
      },
    };
  }
  if (roll < 0.99) {
    // 0.95% — suppressed
    return {
      status: "suppressed",
      events: (sentAt) => [{ eventType: "Suppressed", timestamp: sentAt }],
    };
  }
  // 1% — failed/rejected
  return {
    status: "failed",
    error: randomChoice([
      "MessageRejected: Email address is on the suppression list",
      "Throttling: Maximum sending rate exceeded",
      "AccountSendingPausedException: Account suspended",
    ]),
    events: (sentAt) => [{ eventType: "Reject", timestamp: sentAt }],
  };
}

// --- SMS lifecycle ---
//
// Demo-optimized rates:
//   Delivery: ~93%+ (high for SMS)
//   Failure:  ~4%   (carrier issues)

type SmsLifecycle = {
  status: "sent" | "delivered" | "clicked" | "failed" | "opted_out";
  events: (sentAt: Date) => Array<{ eventType: string; timestamp: Date }>;
  error?: string;
};

function randomSmsLifecycle(): SmsLifecycle {
  const roll = Math.random();

  if (roll < 0.75) {
    // 75% — delivered
    return {
      status: "delivered",
      events: (sentAt) => {
        const deliveredAt = afterDate(sentAt, 1000, 15_000);
        return [
          { eventType: "TEXT_QUEUED", timestamp: sentAt },
          { eventType: "TEXT_SENT", timestamp: afterDate(sentAt, 100, 1000) },
          { eventType: "TEXT_DELIVERED", timestamp: deliveredAt },
        ];
      },
    };
  }
  if (roll < 0.84) {
    // 9% — clicked (delivered + link tracked)
    return {
      status: "clicked",
      events: (sentAt) => {
        const deliveredAt = afterDate(sentAt, 1000, 15_000);
        return [
          { eventType: "TEXT_QUEUED", timestamp: sentAt },
          { eventType: "TEXT_SENT", timestamp: afterDate(sentAt, 100, 1000) },
          { eventType: "TEXT_DELIVERED", timestamp: deliveredAt },
        ];
      },
    };
  }
  if (roll < 0.9) {
    // 6% — sent but pending
    return {
      status: "sent",
      events: (sentAt) => [
        { eventType: "TEXT_QUEUED", timestamp: sentAt },
        { eventType: "TEXT_SENT", timestamp: afterDate(sentAt, 100, 1000) },
      ],
    };
  }
  if (roll < 0.94) {
    // 4% — failed
    return {
      status: "failed",
      error: randomChoice([
        "UNREACHABLE: Phone number is not reachable",
        "UNKNOWN: Carrier did not accept the message",
        "CARRIER_UNREACHABLE: Carrier is not available",
        "BLOCKED: Destination is blocked",
      ]),
      events: (sentAt) => [
        { eventType: "TEXT_QUEUED", timestamp: sentAt },
        { eventType: "TEXT_UNKNOWN", timestamp: afterDate(sentAt, 1000, 5000) },
      ],
    };
  }
  if (roll < 0.97) {
    // 3% — opted out (delivered then opted out)
    return {
      status: "opted_out",
      events: (sentAt) => {
        const deliveredAt = afterDate(sentAt, 1000, 15_000);
        return [
          { eventType: "TEXT_QUEUED", timestamp: sentAt },
          { eventType: "TEXT_SENT", timestamp: afterDate(sentAt, 100, 1000) },
          { eventType: "TEXT_DELIVERED", timestamp: deliveredAt },
        ];
      },
    };
  }
  // 3% — delayed delivery (still counts as delivered)
  return {
    status: "delivered",
    events: (sentAt) => {
      const deliveredAt = afterDate(sentAt, 60_000, 3_600_000);
      return [
        { eventType: "TEXT_QUEUED", timestamp: sentAt },
        { eventType: "TEXT_SENT", timestamp: afterDate(sentAt, 100, 1000) },
        { eventType: "TEXT_DELIVERED", timestamp: deliveredAt },
      ];
    },
  };
}

// --- DynamoDB batch writer ---

async function writeDynamoBatch(
  dynamoClient: DynamoDBClient,
  tableName: string,
  items: Record<string, unknown>[]
): Promise<number> {
  // DynamoDB BatchWriteItem limit is 25
  let written = 0;
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    const requestItems = chunk.map((item) => ({
      PutRequest: { Item: marshall(item, { removeUndefinedValues: true }) },
    }));

    try {
      await dynamoClient.send(
        new BatchWriteItemCommand({
          RequestItems: { [tableName]: requestItems },
        })
      );
      written += chunk.length;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ResourceNotFoundException"
      ) {
        console.error(
          `\n  Table "${tableName}" not found. Has infrastructure been deployed?`
        );
        return 0;
      }
      throw error;
    }
  }
  return written;
}

// --- Main ---

async function main() {
  console.log("Seeding demo email & SMS activity...\n");

  const messageCount = Number.parseInt(
    process.env.MESSAGE_COUNT || "10000",
    10
  );
  const daysBack = Number.parseInt(process.env.DAYS_BACK || "90", 10);
  const skipDynamo = process.env.SKIP_DYNAMO === "true";

  let organizationId = process.env.ORG_ID;

  if (!organizationId) {
    const org = await db.query.organization.findFirst();
    if (!org) {
      console.error("No organization found. Create one first.");
      process.exit(1);
    }
    organizationId = org.id;
    console.log(`Using organization: ${org.name} (${org.id})`);
  }

  // Get AWS account
  const account = await db.query.awsAccount.findFirst({
    where: eq(schema.awsAccount.organizationId, organizationId),
  });
  if (!account) {
    console.error("No AWS account found for this organization.");
    process.exit(1);
  }
  console.log(`Using AWS account: ${account.name} (${account.id})`);
  console.log(
    `  AWS Account ID: ${account.accountId}, Region: ${account.region}`
  );

  // Set up DynamoDB client (uses ambient credentials — same AWS account as CLI)
  let dynamoClient: DynamoDBClient | null = null;
  if (skipDynamo) {
    console.log("  DynamoDB: SKIPPED (SKIP_DYNAMO=true)");
  } else {
    dynamoClient = new DynamoDBClient({ region: account.region });
    console.log(`  DynamoDB: writing to ${account.region}`);
  }

  // Get contacts
  const emailContacts = await db.query.contact.findMany({
    where: and(
      eq(schema.contact.organizationId, organizationId),
      isNotNull(schema.contact.email)
    ),
    limit: 500,
  });

  const smsContacts = await db.query.contact.findMany({
    where: and(
      eq(schema.contact.organizationId, organizationId),
      isNotNull(schema.contact.phone)
    ),
    limit: 500,
  });

  const batches = await db.query.batchSend.findMany({
    where: eq(schema.batchSend.organizationId, organizationId),
    limit: 20,
  });

  console.log(
    `\nFound ${emailContacts.length} email contacts, ${smsContacts.length} SMS contacts`
  );
  console.log(`Found ${batches.length} existing batch sends`);
  console.log(
    `Generating activity over ${daysBack} days (growth curve + weekday patterns)`
  );

  const emailCount = Math.round(messageCount * 0.75);
  const smsCount = messageCount - emailCount;
  const retentionMs = 90 * 24 * 60 * 60 * 1000; // 90 day TTL

  console.log(
    `Target: ~${messageCount} messages (${emailCount} email, ${smsCount} SMS)\n`
  );

  const stats = {
    email: {} as Record<string, number>,
    sms: {} as Record<string, number>,
    sourceTypes: {} as Record<string, number>,
    dynamoEmail: 0,
    dynamoSms: 0,
  };

  const pgBatchSize = 50;

  // --- Seed email messages (day by day) ---
  if (emailContacts.length > 0) {
    const dailyVolumes = calculateDailyVolumes(emailCount, daysBack);
    let pgBatch: Record<string, unknown>[] = [];
    let dynamoBatch: Record<string, unknown>[] = [];
    let totalGenerated = 0;
    let isFirstDynamoFlush = true;

    for (const { date, count } of dailyVolumes) {
      for (let j = 0; j < count; j++) {
        const contact = randomChoice(emailContacts);
        const lifecycle = randomEmailLifecycle();
        const sentAt = randomTimeOnDay(date);
        const events = lifecycle.events(sentAt);
        const messageId = fakeMessageId();

        const sourceRoll = Math.random();
        let sourceType: "transactional" | "batch" | "workflow";
        let batchSendId: string | null = null;
        let emailMeta: { subject: string; from: string };

        if (sourceRoll < 0.4) {
          sourceType = "transactional";
          emailMeta = randomChoice(transactionalSubjects);
        } else if (sourceRoll < 0.8) {
          sourceType = "batch";
          emailMeta = randomChoice(batchSubjects);
          if (batches.length > 0) {
            const linkedBatch = randomChoice(
              batches.filter((b) => b.channel === "email")
            );
            if (linkedBatch) batchSendId = linkedBatch.id;
          }
        } else {
          sourceType = "workflow";
          emailMeta = randomChoice([
            ...transactionalSubjects,
            ...batchSubjects,
          ]);
        }

        const domain = randomChoice(fromDomains);
        const fromAddr = `${emailMeta.from}${domain}`;

        stats.email[lifecycle.status] =
          (stats.email[lifecycle.status] || 0) + 1;
        stats.sourceTypes[sourceType] =
          (stats.sourceTypes[sourceType] || 0) + 1;

        // Postgres record
        pgBatch.push({
          organizationId,
          contactId: contact.id,
          awsAccountId: account.id,
          channel: "email" as const,
          sourceType,
          batchSendId,
          recipient: contact.email!,
          subject: emailMeta.subject,
          from: fromAddr,
          fromName: "Wraps Demo",
          messageId,
          status: lifecycle.status,
          sentAt: events.find((e) => e.eventType === "Send")?.timestamp,
          deliveredAt: events.find((e) => e.eventType === "Delivery")
            ?.timestamp,
          openedAt: events.find((e) => e.eventType === "Open")?.timestamp,
          clickedAt: events.find((e) => e.eventType === "Click")?.timestamp,
          bouncedAt: events.find((e) => e.eventType === "Bounce")?.timestamp,
          complainedAt: events.find((e) => e.eventType === "Complaint")
            ?.timestamp,
          suppressedAt: events.find((e) => e.eventType === "Suppressed")
            ?.timestamp,
          bounceType: lifecycle.bounceType ?? null,
          bounceSubType: lifecycle.bounceSubType ?? null,
          error: lifecycle.error ?? null,
          createdAt: sentAt,
        });

        // DynamoDB records — one per event in the lifecycle
        if (dynamoClient) {
          for (const event of events) {
            const additionalData: Record<string, unknown> = {
              timestamp: event.timestamp.toISOString(),
            };

            if (event.eventType === "Open") {
              additionalData.userAgent = randomChoice([
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
              ]);
              additionalData.ipAddress = `${randomInt(10, 200)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
            }

            if (event.eventType === "Click") {
              additionalData.link = randomChoice([
                "https://example.com/dashboard",
                "https://example.com/upgrade",
                "https://example.com/blog/latest",
                "https://example.com/unsubscribe",
              ]);
              additionalData.userAgent =
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
            }

            if (event.eventType === "Bounce") {
              additionalData.bounceType = lifecycle.bounceType;
              additionalData.bounceSubType = lifecycle.bounceSubType;
              additionalData.bouncedRecipients = [
                { emailAddress: contact.email },
              ];
            }

            if (event.eventType === "Delivery") {
              additionalData.processingTimeMillis = randomInt(200, 3000);
              additionalData.recipients = [contact.email];
            }

            if (event.eventType === "Complaint") {
              additionalData.complainedRecipients = [
                { emailAddress: contact.email },
              ];
              additionalData.complaintFeedbackType = "abuse";
            }

            dynamoBatch.push({
              messageId,
              sentAt: event.timestamp.getTime(),
              accountId: account.accountId,
              from: fromAddr,
              to: [contact.email!],
              subject: emailMeta.subject,
              eventType: event.eventType,
              eventData: JSON.stringify({ demo: true }),
              additionalData: JSON.stringify(additionalData),
              createdAt: Date.now(),
              expiresAt: Date.now() + retentionMs,
            });
          }
        }

        // Flush batch when full
        if (pgBatch.length >= pgBatchSize) {
          await db.insert(schema.messageSend).values(pgBatch as never);

          if (dynamoClient && dynamoBatch.length > 0) {
            const written = await writeDynamoBatch(
              dynamoClient,
              "wraps-email-history",
              dynamoBatch
            );
            stats.dynamoEmail += written;
            if (written === 0 && isFirstDynamoFlush) {
              dynamoClient = null;
              console.log("  (skipping remaining DynamoDB email writes)");
            }
            isFirstDynamoFlush = false;
          }

          totalGenerated += pgBatch.length;
          pgBatch = [];
          dynamoBatch = [];
          process.stdout.write(`\r  Email: ${totalGenerated}/${emailCount}`);
        }
      }
    }

    // Flush remaining records
    if (pgBatch.length > 0) {
      await db.insert(schema.messageSend).values(pgBatch as never);

      if (dynamoClient && dynamoBatch.length > 0) {
        const written = await writeDynamoBatch(
          dynamoClient,
          "wraps-email-history",
          dynamoBatch
        );
        stats.dynamoEmail += written;
      }

      totalGenerated += pgBatch.length;
    }
    console.log(`\r  Email: ${totalGenerated}/${emailCount}`);
  } else {
    console.log("  Skipping email messages (no email contacts)");
  }

  // --- Seed SMS messages (day by day) ---
  let smsDynamoClient = skipDynamo
    ? null
    : new DynamoDBClient({ region: account.region });

  if (smsContacts.length > 0) {
    const dailyVolumes = calculateDailyVolumes(smsCount, daysBack);
    let pgBatch: Record<string, unknown>[] = [];
    let dynamoBatch: Record<string, unknown>[] = [];
    let totalGenerated = 0;
    let isFirstDynamoFlush = true;

    for (const { date, count } of dailyVolumes) {
      for (let j = 0; j < count; j++) {
        const contact = randomChoice(smsContacts);
        const lifecycle = randomSmsLifecycle();
        const sentAt = randomTimeOnDay(date);
        const events = lifecycle.events(sentAt);
        const messageId = fakeMessageId();
        const message = randomChoice(smsMessages);
        const segments = message.length > 160 ? 2 : 1;

        const sourceRoll = Math.random();
        let sourceType: "transactional" | "batch" | "workflow";
        let batchSendId: string | null = null;

        if (sourceRoll < 0.6) {
          sourceType = "transactional";
        } else if (sourceRoll < 0.8) {
          sourceType = "batch";
          if (batches.length > 0) {
            const linkedBatch = randomChoice(
              batches.filter((b) => b.channel === "sms")
            );
            if (linkedBatch) batchSendId = linkedBatch.id;
          }
        } else {
          sourceType = "workflow";
        }

        stats.sms[lifecycle.status] = (stats.sms[lifecycle.status] || 0) + 1;
        stats.sourceTypes[sourceType] =
          (stats.sourceTypes[sourceType] || 0) + 1;

        // Postgres
        pgBatch.push({
          organizationId,
          contactId: contact.id,
          awsAccountId: account.id,
          channel: "sms" as const,
          sourceType,
          batchSendId,
          recipient: contact.phone!,
          body: message,
          senderId: "+15551000000",
          smsSegmentCount: segments,
          messageId,
          status: lifecycle.status,
          sentAt: events.find(
            (e) => e.eventType === "TEXT_SENT" || e.eventType === "TEXT_QUEUED"
          )?.timestamp,
          deliveredAt: events.find((e) => e.eventType === "TEXT_DELIVERED")
            ?.timestamp,
          clickedAt:
            lifecycle.status === "clicked"
              ? afterDate(events.at(-1)!.timestamp, 10_000, 600_000)
              : undefined,
          optedOutAt:
            lifecycle.status === "opted_out"
              ? afterDate(events.at(-1)!.timestamp, 30_000, 300_000)
              : undefined,
          error: lifecycle.error ?? null,
          createdAt: sentAt,
        });

        // DynamoDB records — one per SMS event
        if (smsDynamoClient) {
          for (const event of events) {
            const additionalData: Record<string, unknown> = {
              isoCountryCode: "US",
              messageType: "TRANSACTIONAL",
            };

            if (event.eventType === "TEXT_DELIVERED") {
              additionalData.carrierName = randomChoice([
                "AT&T",
                "T-Mobile",
                "Verizon",
                "US Cellular",
              ]);
              additionalData.deliveryTimestamp = event.timestamp.toISOString();
            }

            if (event.eventType === "TEXT_UNKNOWN") {
              additionalData.failureReason = lifecycle.error;
            }

            dynamoBatch.push({
              messageId,
              sentAt: event.timestamp.getTime(),
              accountId: account.accountId,
              destinationNumber: contact.phone!,
              originationNumber: "+15551000000",
              messageBody: "", // AWS SMS events don't include the body
              eventType: event.eventType,
              segments,
              eventData: JSON.stringify({ demo: true }),
              additionalData: JSON.stringify(additionalData),
              createdAt: Date.now(),
              expiresAt: Date.now() + retentionMs,
            });
          }
        }

        // Flush batch when full
        if (pgBatch.length >= pgBatchSize) {
          await db.insert(schema.messageSend).values(pgBatch as never);

          if (smsDynamoClient && dynamoBatch.length > 0) {
            const written = await writeDynamoBatch(
              smsDynamoClient,
              "wraps-sms-history",
              dynamoBatch
            );
            stats.dynamoSms += written;
            if (written === 0 && isFirstDynamoFlush) {
              smsDynamoClient = null;
              console.log("  (skipping remaining DynamoDB SMS writes)");
            }
            isFirstDynamoFlush = false;
          }

          totalGenerated += pgBatch.length;
          pgBatch = [];
          dynamoBatch = [];
          process.stdout.write(`\r  SMS: ${totalGenerated}/${smsCount}`);
        }
      }
    }

    // Flush remaining
    if (pgBatch.length > 0) {
      await db.insert(schema.messageSend).values(pgBatch as never);

      if (smsDynamoClient && dynamoBatch.length > 0) {
        const written = await writeDynamoBatch(
          smsDynamoClient,
          "wraps-sms-history",
          dynamoBatch
        );
        stats.dynamoSms += written;
      }

      totalGenerated += pgBatch.length;
    }
    console.log(`\r  SMS: ${totalGenerated}/${smsCount}`);
  } else {
    console.log("  Skipping SMS messages (no SMS contacts)");
  }

  console.log("\nEmail status distribution:");
  for (const [status, count] of Object.entries(stats.email).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${status}: ${count}`);
  }

  console.log("\nSMS status distribution:");
  for (const [status, count] of Object.entries(stats.sms).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${status}: ${count}`);
  }

  console.log("\nSource types:");
  for (const [type, count] of Object.entries(stats.sourceTypes).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${type}: ${count}`);
  }

  if (stats.dynamoEmail > 0 || stats.dynamoSms > 0) {
    console.log("\nDynamoDB items written:");
    console.log(`  wraps-email-history: ${stats.dynamoEmail}`);
    console.log(`  wraps-sms-history: ${stats.dynamoSms}`);
  }

  const totalEmail = Object.values(stats.email).reduce((a, b) => a + b, 0);
  const totalSms = Object.values(stats.sms).reduce((a, b) => a + b, 0);
  console.log(
    `\nDone! Created ${totalEmail + totalSms} demo messages (${totalEmail} email, ${totalSms} SMS)\n`
  );
}

main().catch(console.error);
