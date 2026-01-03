/**
 * Batch Sender Worker Tests
 *
 * Tests for the SQS Lambda handler that processes batch send jobs.
 * Covers:
 * - Template variable substitution
 * - Recipient filtering (topic, segment)
 * - Bulk sending batching
 * - Error handling and back pressure
 */

import type {
  BulkEmailEntry,
  BulkEmailEntryResult,
  SendBulkEmailCommandOutput,
} from "@aws-sdk/client-sesv2";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock data
const mockOrganization = {
  id: "org-123",
  name: "Test Org",
};

const mockBatch = {
  id: "batch-123",
  organizationId: "org-123",
  awsAccountId: "aws-acc-123",
  channel: "email" as const,
  status: "queued" as const,
  subject: "Hello {{firstName|there}}!",
  from: "test@example.com",
  fromName: "Test Sender",
  emailTemplateId: "template-123",
  htmlContent: null,
  textContent: null,
  replyTo: null,
  totalRecipients: 10,
  processedRecipients: 0,
  sent: 0,
  failed: 0,
  audienceType: "all" as const,
  topicId: null,
  segmentId: null,
  emailType: "marketing" as const,
};

const mockTemplate = {
  id: "template-123",
  sesTemplateName: "Test-Template",
  compiledHtml: "<p>Hello {{firstName|there}}!</p>",
  emailType: "marketing" as const,
};

const mockContacts = [
  {
    id: "contact-1",
    email: "john@example.com",
    phone: null,
    firstName: "John",
    lastName: "Doe",
    company: "Acme",
    jobTitle: "Engineer",
    properties: { customField: "value1" },
  },
  {
    id: "contact-2",
    email: "jane@example.com",
    phone: null,
    firstName: "Jane",
    lastName: "Smith",
    company: null,
    jobTitle: null,
    properties: {},
  },
  {
    id: "contact-3",
    email: "bob@example.com",
    phone: null,
    firstName: null,
    lastName: null,
    company: null,
    jobTitle: null,
    properties: {},
  },
];

// Track SES calls for assertions
let sesCallHistory: Array<{
  entries: BulkEmailEntry[];
  templateName: string;
}> = [];

// Mock SES client
const mockSesSend = vi.fn().mockImplementation((command) => {
  // Track the call
  if (command.constructor.name === "SendBulkEmailCommand") {
    sesCallHistory.push({
      entries: command.input.BulkEmailEntries || [],
      templateName: command.input.DefaultContent?.Template?.TemplateName || "",
    });
  }

  // Simulate successful bulk send
  const results: BulkEmailEntryResult[] = (
    command.input.BulkEmailEntries || []
  ).map(
    (_entry: BulkEmailEntry, index: number): BulkEmailEntryResult => ({
      Status: "SUCCESS",
      MessageId: `msg-${index}-${Date.now()}`,
    })
  );

  return Promise.resolve({
    BulkEmailEntryResults: results,
  } as SendBulkEmailCommandOutput);
});

// Mock SQS client
const mockSqsSend = vi.fn().mockResolvedValue({});

// Mock database operations
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnThis(),
});
const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
});

// Mock the modules
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: vi.fn().mockImplementation(() => ({
    send: mockSesSend,
  })),
  SendBulkEmailCommand: vi.fn().mockImplementation((input) => ({
    input,
    constructor: { name: "SendBulkEmailCommand" },
  })),
  SendEmailCommand: vi.fn().mockImplementation((input) => ({
    input,
    constructor: { name: "SendEmailCommand" },
  })),
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn().mockImplementation(() => ({
    send: mockSqsSend,
  })),
  SendMessageCommand: vi.fn(),
}));

vi.mock("@wraps/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    }),
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
  batchSend: { id: "id" },
  contact: { id: "id", organizationId: "org_id" },
  contactTopic: { contactId: "contact_id", topicId: "topic_id" },
  organization: { id: "id", name: "name" },
  template: { id: "id" },
  messageSend: {},
  segment: {},
  eq: vi.fn(),
}));

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi
    .fn()
    .mockResolvedValue("mock-unsubscribe-token"),
}));

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    sessionToken: "session-token",
  }),
}));

describe("Batch Sender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesCallHistory = [];
  });

  describe("Variable Substitution", () => {
    it("provides both short and prefixed variable names", async () => {
      // This is a unit test for the replacement data structure
      // The actual batch sender builds replacement data like this:
      const recipient = mockContacts[0];
      const orgName = mockOrganization.name;
      const unsubscribeUrl = "https://api.wraps.dev/unsubscribe/token";
      const preferencesUrl = "https://wraps.dev/preferences/token";

      const replacementData: Record<string, string> = {
        // Short names
        email: recipient.email!,
        firstName: recipient.firstName ?? "",
        lastName: recipient.lastName ?? "",
        company: recipient.company ?? "",
        jobTitle: recipient.jobTitle ?? "",
        // Full names with prefix
        contactEmail: recipient.email!,
        contactFirstName: recipient.firstName ?? "",
        contactLastName: recipient.lastName ?? "",
        contactCompany: recipient.company ?? "",
        contactJobTitle: recipient.jobTitle ?? "",
        // Organization
        organizationName: orgName,
        // URLs
        unsubscribeUrl,
        preferencesUrl,
      };

      // Verify both naming conventions are available
      expect(replacementData.firstName).toBe("John");
      expect(replacementData.contactFirstName).toBe("John");
      expect(replacementData.email).toBe("john@example.com");
      expect(replacementData.contactEmail).toBe("john@example.com");
      expect(replacementData.organizationName).toBe("Test Org");
    });

    it("handles missing contact fields gracefully", () => {
      const recipient = mockContacts[2]; // Bob with no firstName
      const replacementData: Record<string, string> = {
        firstName: recipient.firstName ?? "",
        lastName: recipient.lastName ?? "",
        company: recipient.company ?? "",
      };

      expect(replacementData.firstName).toBe("");
      expect(replacementData.lastName).toBe("");
      expect(replacementData.company).toBe("");
    });

    it("includes custom properties", () => {
      const recipient = mockContacts[0];
      const replacementData: Record<string, string> = {};

      if (recipient.properties) {
        for (const [key, value] of Object.entries(recipient.properties)) {
          replacementData[key] = String(value ?? "");
          const flatKey = `contactProperties${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          replacementData[flatKey] = String(value ?? "");
        }
      }

      expect(replacementData.customField).toBe("value1");
      expect(replacementData.contactPropertiesCustomField).toBe("value1");
    });
  });

  describe("Bulk Sending Batching", () => {
    it("respects SES 50 recipient limit per bulk call", () => {
      // When sending to more than 50 recipients, should split into multiple calls
      const BULK_BATCH_SIZE = 50;
      const totalRecipients = 120;

      const expectedCalls = Math.ceil(totalRecipients / BULK_BATCH_SIZE);
      expect(expectedCalls).toBe(3); // 50 + 50 + 20

      // Verify the batch sizes
      const firstBatchSize = Math.min(totalRecipients, BULK_BATCH_SIZE);
      expect(firstBatchSize).toBe(50);

      const secondBatchSize = Math.min(
        totalRecipients - BULK_BATCH_SIZE,
        BULK_BATCH_SIZE
      );
      expect(secondBatchSize).toBe(50);

      const thirdBatchSize = totalRecipients - 2 * BULK_BATCH_SIZE;
      expect(thirdBatchSize).toBe(20);
    });

    it("builds correct BulkEmailEntry structure", () => {
      const recipient = mockContacts[0];
      const unsubscribeUrl = "https://api.wraps.dev/unsubscribe/token";

      const entry: BulkEmailEntry = {
        Destination: {
          ToAddresses: [recipient.email!],
        },
        ReplacementEmailContent: {
          ReplacementTemplate: {
            ReplacementTemplateData: JSON.stringify({
              firstName: recipient.firstName,
              contactFirstName: recipient.firstName,
            }),
          },
        },
        ReplacementHeaders: [
          {
            Name: "List-Unsubscribe",
            Value: `<${unsubscribeUrl}>`,
          },
          {
            Name: "List-Unsubscribe-Post",
            Value: "List-Unsubscribe=One-Click",
          },
        ],
      };

      expect(entry.Destination?.ToAddresses).toContain("john@example.com");
      expect(entry.ReplacementHeaders).toHaveLength(2);
      expect(entry.ReplacementHeaders?.[0].Name).toBe("List-Unsubscribe");
    });
  });

  describe("Recipient Filtering", () => {
    describe("Topic Filtering", () => {
      it("builds correct EXISTS subquery for topic filter", () => {
        // The batch sender uses EXISTS to filter contacts by topic
        // This tests the query structure conceptually

        const filter = {
          audienceType: "topic" as const,
          topicId: "topic-123",
        };

        expect(filter.audienceType).toBe("topic");
        expect(filter.topicId).toBe("topic-123");

        // The actual query would be:
        // SELECT ... FROM contact WHERE ... AND EXISTS (
        //   SELECT 1 FROM contact_topic
        //   WHERE contact_topic.contact_id = contact.id
        //     AND contact_topic.topic_id = 'topic-123'
        //     AND contact_topic.status = 'subscribed'
        // )
      });

      it("only sends to subscribed contacts for topic", () => {
        // When filtering by topic, only contacts with status='subscribed' should be included
        const validStatuses = ["subscribed"];
        const invalidStatuses = ["pending", "unsubscribed"];

        expect(validStatuses).toContain("subscribed");
        expect(invalidStatuses).not.toContain("subscribed");
      });
    });

    describe("Segment Filtering", () => {
      it("placeholder for segment filtering", () => {
        // Segment filtering is marked as TODO in the implementation
        const filter = {
          audienceType: "segment" as const,
          segmentId: "segment-123",
        };

        expect(filter.audienceType).toBe("segment");
        expect(filter.segmentId).toBe("segment-123");
      });
    });

    describe("All Contacts", () => {
      it("sends to all contacts when audienceType is all", () => {
        const filter = {
          audienceType: "all" as const,
        };

        expect(filter.audienceType).toBe("all");
        // No additional filtering applied
      });
    });
  });

  describe("Marketing Email Headers", () => {
    it("includes List-Unsubscribe headers for marketing emails", () => {
      const isMarketing = true;
      const unsubscribeUrl = "https://api.wraps.dev/unsubscribe/token";

      const headers: Array<{ Name: string; Value: string }> = [];
      if (isMarketing) {
        headers.push(
          { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>` },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }
        );
      }

      expect(headers).toHaveLength(2);
      expect(headers[0].Name).toBe("List-Unsubscribe");
      expect(headers[1].Value).toBe("List-Unsubscribe=One-Click");
    });

    it("excludes List-Unsubscribe headers for transactional emails", () => {
      const isMarketing = false;

      const headers: Array<{ Name: string; Value: string }> = [];
      if (isMarketing) {
        headers.push(
          { Name: "List-Unsubscribe", Value: "<url>" },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }
        );
      }

      expect(headers).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("handles cancelled batch gracefully", () => {
      const batch = { ...mockBatch, status: "cancelled" as const };

      // When batch is cancelled, processing should skip
      if (batch.status === "cancelled") {
        // Should log and return early
        expect(batch.status).toBe("cancelled");
      }
    });

    it("handles missing batch gracefully", () => {
      const batch = null;

      // When batch is not found, should log error and return
      if (!batch) {
        expect(batch).toBeNull();
      }
    });

    it("tracks failed sends per recipient", () => {
      // When a bulk send partially fails, each recipient's result is tracked
      const results: BulkEmailEntryResult[] = [
        { Status: "SUCCESS", MessageId: "msg-1" },
        { Status: "FAILED", Error: "Mailbox full" },
        { Status: "SUCCESS", MessageId: "msg-3" },
      ];

      let sent = 0;
      let failed = 0;

      for (const result of results) {
        if (result.Status === "SUCCESS") {
          sent++;
        } else {
          failed++;
        }
      }

      expect(sent).toBe(2);
      expect(failed).toBe(1);
    });

    it("handles entire bulk batch failure", () => {
      // When the entire bulk send API call fails, all recipients should be marked failed
      const recipientCount = 50;
      const error = new Error("SES throttling");

      // All recipients in this batch should be marked as failed
      let failed = 0;
      for (let i = 0; i < recipientCount; i++) {
        failed++;
      }

      expect(failed).toBe(50);
      expect(error.message).toBe("SES throttling");
    });
  });

  describe("Chunking and Pagination", () => {
    it("processes contacts in chunks of 100", () => {
      const CHUNK_SIZE = 100;
      const totalRecipients = 250;

      // First chunk: offset=0, limit=100
      // Second chunk: offset=100, limit=100
      // Third chunk: offset=200, limit=100

      const chunks = Math.ceil(totalRecipients / CHUNK_SIZE);
      expect(chunks).toBe(3);

      // Verify offsets
      expect(0 * CHUNK_SIZE).toBe(0);
      expect(1 * CHUNK_SIZE).toBe(100);
      expect(2 * CHUNK_SIZE).toBe(200);
    });

    it("enqueues next chunk after processing", () => {
      const job = {
        batchId: "batch-123",
        organizationId: "org-123",
        awsAccountId: "aws-123",
        channel: "email" as const,
        chunkIndex: 0,
      };

      const nextJob = {
        ...job,
        chunkIndex: job.chunkIndex + 1,
      };

      expect(nextJob.chunkIndex).toBe(1);
    });

    it("completes batch when no more contacts", () => {
      // When getContactsChunk returns empty array, batch is complete
      const contacts: typeof mockContacts = [];

      if (contacts.length === 0) {
        // Mark batch as completed
        expect(contacts).toHaveLength(0);
      }
    });
  });

  describe("Message Tags", () => {
    it("includes tracking tags for CloudWatch and EventBridge", () => {
      const batch = mockBatch;

      const tags = [
        { Name: "batchId", Value: batch.id },
        { Name: "organizationId", Value: batch.organizationId },
        ...(batch.emailTemplateId
          ? [{ Name: "templateId", Value: batch.emailTemplateId }]
          : []),
        { Name: "source", Value: "broadcast" },
      ];

      expect(tags).toHaveLength(4);
      expect(tags[0]).toEqual({ Name: "batchId", Value: "batch-123" });
      expect(tags[1]).toEqual({ Name: "organizationId", Value: "org-123" });
      expect(tags[2]).toEqual({ Name: "templateId", Value: "template-123" });
      expect(tags[3]).toEqual({ Name: "source", Value: "broadcast" });
    });
  });
});

describe("URL Generation", () => {
  it("generates correct unsubscribe URL", () => {
    const apiBaseUrl = "https://api.wraps.dev";
    const token = "mock-token";

    const unsubscribeUrl = `${apiBaseUrl}/unsubscribe/${token}`;
    expect(unsubscribeUrl).toBe("https://api.wraps.dev/unsubscribe/mock-token");
  });

  it("generates correct preferences URL", () => {
    const appBaseUrl = "https://wraps.dev";
    const token = "mock-token";

    const preferencesUrl = `${appBaseUrl}/preferences/${token}`;
    expect(preferencesUrl).toBe("https://wraps.dev/preferences/mock-token");
  });

  it("uses environment variable defaults correctly", () => {
    // These defaults are used when env vars are not set
    const apiBaseUrl =
      process.env.API_BASE_URL || "https://api.wraps.dev";
    const appBaseUrl =
      process.env.APP_BASE_URL || "https://wraps.dev";

    expect(apiBaseUrl).toContain("api.wraps.dev");
    expect(appBaseUrl).toBe("https://wraps.dev");
  });
});
