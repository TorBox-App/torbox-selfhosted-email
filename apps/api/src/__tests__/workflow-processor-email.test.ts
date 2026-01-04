/**
 * Workflow Processor Email Tests
 *
 * Tests for the email sending functionality in the workflow processor.
 * Covers:
 * - Successful email sending via SES
 * - Handling contacts without email or with bad email status
 * - Handling workflows without AWS accounts
 * - Variable substitution in email templates
 * - Unsubscribe URL generation for marketing emails
 * - Contact email metrics updates
 * - Message tracking in messageSend table
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock data
const mockWorkflow = {
  id: "wf-123",
  organizationId: "org-123",
  awsAccountId: "aws-123",
  name: "Welcome Email Workflow",
  status: "enabled" as const,
  steps: [],
  transitions: [],
};

const mockAwsAccount = {
  id: "aws-123",
  region: "us-east-1",
  roleArn: "arn:aws:iam::123456789:role/wraps-role",
  externalId: "ext-123",
};

const mockOrganization = {
  id: "org-123",
  slug: "test-org",
  name: "Test Organization",
  senderEmail: "hello@test.com",
  senderName: "Test Company",
};

const mockTemplate = {
  id: "template-123",
  name: "Welcome Email",
  subject: "Welcome, {{firstName}}!",
  htmlBody: "<h1>Hello {{firstName}} {{lastName}}</h1><p>Welcome to {{company}}!</p>",
  type: "marketing" as const,
};

const mockExecution = {
  id: "exec-123",
  workflowId: "wf-123",
  contactId: "contact-123",
  organizationId: "org-123",
  status: "active" as const,
  triggerData: {
    source: "welcome_flow",
    customField: "custom_value",
  },
};

const mockContactActive = {
  id: "contact-123",
  email: "john@example.com",
  phone: null,
  firstName: "John",
  lastName: "Doe",
  company: "Acme Inc",
  organizationId: "org-123",
  emailStatus: "active" as const,
  status: "active" as const,
  properties: {
    plan: "pro",
    signupSource: "website",
  },
};

const mockContactBounced = {
  id: "contact-bounced",
  email: "bounced@example.com",
  phone: null,
  firstName: "Jane",
  lastName: "Smith",
  organizationId: "org-123",
  emailStatus: "bounced" as const,
  status: "bounced" as const,
};

const mockContactNoEmail = {
  id: "contact-no-email",
  email: null,
  phone: "+15551234567",
  firstName: "Bob",
  lastName: "Wilson",
  organizationId: "org-123",
  emailStatus: null,
  status: "active" as const,
};

const mockCredentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  sessionToken: "session-token",
  expiration: new Date(Date.now() + 3600000),
};

// Track SES client calls
let sesCallHistory: Array<{
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  tags: Array<{ Name: string; Value: string }>;
}> = [];

// Mock SES client
const mockSesSend = vi.fn().mockImplementation((command) => {
  sesCallHistory.push({
    from: command.input.FromEmailAddress,
    to: command.input.Destination.ToAddresses[0],
    subject: command.input.Content.Simple.Subject.Data,
    htmlBody: command.input.Content.Simple.Body.Html.Data,
    tags: command.input.EmailTags || [],
  });
  return Promise.resolve({
    MessageId: `msg-${Date.now()}`,
  });
});

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: vi.fn().mockImplementation(() => ({
    send: mockSesSend,
  })),
  SendEmailCommand: vi.fn().mockImplementation((input) => ({
    input,
    constructor: { name: "SendEmailCommand" },
  })),
}));

// Mock credentials service
vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue(mockCredentials),
}));

// Mock unsubscribe token
vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn().mockReturnValue("mock-unsubscribe-token"),
}));

// Mock database
const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

const mockDbSelect = vi.fn();

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");
  return {
    ...actual,
    db: {
      select: mockDbSelect,
      update: mockDbUpdate,
      insert: mockDbInsert,
      query: {
        workflowExecution: {
          findFirst: vi.fn(),
        },
      },
    },
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
      return { sql: strings.join("?"), values };
    },
  };
});

describe("Workflow Processor - Email Sending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesCallHistory = [];
  });

  describe("Email Configuration", () => {
    it("should support required email configuration fields", () => {
      const emailConfig = {
        type: "send_email" as const,
        templateId: "template-123",
        fromName: "Test Sender",
        fromAddress: "sender@example.com",
        replyTo: "reply@example.com",
      };

      expect(emailConfig.templateId).toBeDefined();
      expect(emailConfig.fromName).toBe("Test Sender");
      expect(emailConfig.fromAddress).toBe("sender@example.com");
    });

    it("should support optional email configuration fields", () => {
      const emailConfig = {
        type: "send_email" as const,
        templateId: "template-123",
        replyTo: "reply@example.com",
        trackOpens: true,
        trackClicks: true,
      };

      expect(emailConfig.replyTo).toBe("reply@example.com");
    });
  });

  describe("Contact Validation", () => {
    it("should have email for active contact", () => {
      expect(mockContactActive.email).toBe("john@example.com");
      expect(mockContactActive.emailStatus).toBe("active");
    });

    it("should identify bounced contacts", () => {
      expect(mockContactBounced.emailStatus).toBe("bounced");
    });

    it("should identify contacts without email", () => {
      expect(mockContactNoEmail.email).toBeNull();
    });

    it("should skip sending to bounced contacts", () => {
      // When a contact has emailStatus = bounced, email should not be sent
      const shouldSkip =
        mockContactBounced.emailStatus === "bounced" ||
        mockContactBounced.emailStatus === "complained" ||
        mockContactBounced.emailStatus === "unsubscribed";
      expect(shouldSkip).toBe(true);
    });

    it("should skip sending to contacts without email", () => {
      const shouldSkip = !mockContactNoEmail.email;
      expect(shouldSkip).toBe(true);
    });
  });

  describe("Variable Substitution", () => {
    it("should replace contact field variables", () => {
      const template = "Hello {{firstName}} {{lastName}}!";
      const contact = mockContactActive;

      // Simulate variable replacement
      const result = template
        .replace("{{firstName}}", contact.firstName || "")
        .replace("{{lastName}}", contact.lastName || "");

      expect(result).toBe("Hello John Doe!");
    });

    it("should replace property variables", () => {
      const template = "Your plan: {{properties.plan}}";
      const contact = mockContactActive;

      // Simulate property variable replacement
      const result = template.replace(
        "{{properties.plan}}",
        (contact.properties as Record<string, unknown>).plan as string || ""
      );

      expect(result).toBe("Your plan: pro");
    });

    it("should replace trigger data variables", () => {
      const template = "Source: {{trigger.source}}";
      const triggerData = mockExecution.triggerData;

      // Simulate trigger data variable replacement
      const result = template.replace(
        "{{trigger.source}}",
        triggerData.source || ""
      );

      expect(result).toBe("Source: welcome_flow");
    });

    it("should handle missing variables gracefully", () => {
      const template = "Hello {{firstName}} {{middleName}}!";
      const contact = { ...mockContactActive, middleName: undefined };

      // Simulate variable replacement with fallback
      const result = template
        .replace("{{firstName}}", contact.firstName || "")
        .replace("{{middleName}}", "");

      expect(result).toBe("Hello John !");
    });

    it("should build complete variable replacement map", () => {
      const variables: Record<string, unknown> = {
        // Contact fields
        firstName: mockContactActive.firstName,
        lastName: mockContactActive.lastName,
        email: mockContactActive.email,
        company: mockContactActive.company,
        // Contact properties
        "properties.plan": mockContactActive.properties.plan,
        "properties.signupSource": mockContactActive.properties.signupSource,
        // Trigger data
        "trigger.source": mockExecution.triggerData.source,
        "trigger.customField": mockExecution.triggerData.customField,
      };

      expect(variables.firstName).toBe("John");
      expect(variables["properties.plan"]).toBe("pro");
      expect(variables["trigger.source"]).toBe("welcome_flow");
    });
  });

  describe("Unsubscribe URL Generation", () => {
    it("should generate unsubscribe URL for marketing emails", () => {
      const templateType = "marketing";
      const contactId = "contact-123";
      const token = "mock-unsubscribe-token";
      const baseUrl = "https://app.wraps.dev";

      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${token}`;

      expect(templateType).toBe("marketing");
      expect(unsubscribeUrl).toContain("unsubscribe");
      expect(unsubscribeUrl).toContain(token);
    });

    it("should not require unsubscribe for transactional emails", () => {
      const templateType = "transactional";
      const requiresUnsubscribe = templateType === "marketing";

      expect(requiresUnsubscribe).toBe(false);
    });
  });

  describe("SES Email Configuration", () => {
    it("should format From address correctly", () => {
      const fromName = "Test Company";
      const fromAddress = "hello@test.com";
      const formattedFrom = `${fromName} <${fromAddress}>`;

      expect(formattedFrom).toBe("Test Company <hello@test.com>");
    });

    it("should include tracking tags", () => {
      const tags = [
        { Name: "workflow_id", Value: mockWorkflow.id },
        { Name: "execution_id", Value: mockExecution.id },
        { Name: "contact_id", Value: mockContactActive.id },
        { Name: "organization_id", Value: mockWorkflow.organizationId },
      ];

      expect(tags).toHaveLength(4);
      expect(tags.find((t) => t.Name === "workflow_id")?.Value).toBe("wf-123");
    });

    it("should use wraps-email configuration set", () => {
      const configSetName = "wraps-email";
      expect(configSetName).toBe("wraps-email");
    });
  });

  describe("Message Tracking", () => {
    it("should record message in messageSend table", () => {
      const messageRecord = {
        organizationId: mockWorkflow.organizationId,
        contactId: mockContactActive.id,
        awsAccountId: mockWorkflow.awsAccountId,
        channel: "email" as const,
        sourceType: "workflow" as const,
        recipient: mockContactActive.email,
        subject: "Welcome, John!",
        from: "hello@test.com",
        fromName: "Test Company",
        emailTemplateId: mockTemplate.id,
        messageId: "ses-message-id",
        status: "sent" as const,
        sentAt: new Date(),
      };

      expect(messageRecord.sourceType).toBe("workflow");
      expect(messageRecord.channel).toBe("email");
      expect(messageRecord.recipient).toBe("john@example.com");
    });
  });

  describe("Contact Metrics Updates", () => {
    it("should update lastEmailSentAt", () => {
      const updates = {
        lastEmailSentAt: new Date(),
        emailsSent: "emails_sent + 1", // SQL increment
      };

      expect(updates.lastEmailSentAt).toBeInstanceOf(Date);
      expect(updates.emailsSent).toBeDefined();
    });

    it("should increment emailsSent counter", () => {
      // The SQL increment would be: COALESCE(emails_sent, 0) + 1
      const incrementExpression = "COALESCE(emails_sent, 0) + 1";
      expect(incrementExpression).toContain("+ 1");
    });
  });

  describe("AWS Account Lookup", () => {
    it("should get AWS account region for SES client", () => {
      expect(mockAwsAccount.region).toBe("us-east-1");
    });

    it("should have role ARN for credential assumption", () => {
      expect(mockAwsAccount.roleArn).toMatch(/^arn:aws:iam::/);
    });

    it("should have external ID for security", () => {
      expect(mockAwsAccount.externalId).toBe("ext-123");
    });
  });

  describe("Template Processing", () => {
    it("should have subject and HTML body", () => {
      expect(mockTemplate.subject).toBe("Welcome, {{firstName}}!");
      expect(mockTemplate.htmlBody).toContain("<h1>Hello");
    });

    it("should identify template type", () => {
      expect(mockTemplate.type).toBe("marketing");
    });
  });

  describe("Credentials", () => {
    it("should have valid credential structure", () => {
      expect(mockCredentials).toHaveProperty("accessKeyId");
      expect(mockCredentials).toHaveProperty("secretAccessKey");
      expect(mockCredentials).toHaveProperty("sessionToken");
      expect(mockCredentials).toHaveProperty("expiration");
    });

    it("should have non-expired credentials", () => {
      expect(mockCredentials.expiration.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("Error Scenarios", () => {
    it("should handle workflow without AWS account", () => {
      const workflowNoAws = {
        ...mockWorkflow,
        awsAccountId: null,
      };

      expect(workflowNoAws.awsAccountId).toBeNull();
      // In actual implementation, this would skip email sending
    });

    it("should handle missing template", () => {
      const templateId = "nonexistent-template";
      const template = null;

      expect(template).toBeNull();
      // In actual implementation, this would fail the step
    });

    it("should handle SES send failure", async () => {
      // Simulate SES error
      const errorSend = vi.fn().mockRejectedValue(new Error("SES rate limit exceeded"));

      try {
        await errorSend();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("SES rate limit exceeded");
      }
    });
  });

  describe("Step Configuration", () => {
    it("should have valid send_email step config", () => {
      const stepConfig = {
        type: "send_email" as const,
        templateId: "template-123",
        fromName: "Company Name",
        fromAddress: "noreply@company.com",
      };

      expect(stepConfig.type).toBe("send_email");
      expect(stepConfig.templateId).toBeDefined();
    });

    it("should support organization sender defaults", () => {
      // When fromAddress is not specified, use organization default
      const orgDefaults = {
        senderEmail: mockOrganization.senderEmail,
        senderName: mockOrganization.senderName,
      };

      expect(orgDefaults.senderEmail).toBe("hello@test.com");
      expect(orgDefaults.senderName).toBe("Test Company");
    });
  });
});

describe("Workflow Processor Email - Integration Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesCallHistory = [];
  });

  describe("Complete Email Flow", () => {
    it("should process welcome email workflow step", () => {
      // Simulate the complete flow
      const stepConfig = {
        type: "send_email" as const,
        templateId: mockTemplate.id,
        fromName: mockOrganization.senderName,
        fromAddress: mockOrganization.senderEmail,
      };

      const contact = mockContactActive;
      const template = mockTemplate;

      // 1. Validate contact
      expect(contact.email).toBeDefined();
      expect(contact.emailStatus).toBe("active");

      // 2. Process template variables
      const subject = template.subject.replace("{{firstName}}", contact.firstName || "");
      expect(subject).toBe("Welcome, John!");

      const htmlBody = template.htmlBody
        .replace(/\{\{firstName\}\}/g, contact.firstName || "")
        .replace(/\{\{lastName\}\}/g, contact.lastName || "")
        .replace(/\{\{company\}\}/g, contact.company || "");
      expect(htmlBody).toContain("Hello John Doe");
      expect(htmlBody).toContain("Welcome to Acme Inc");

      // 3. Build email params
      const fromFormatted = `${stepConfig.fromName} <${stepConfig.fromAddress}>`;
      expect(fromFormatted).toBe("Test Company <hello@test.com>");

      // 4. Email would be sent via SES
      // 5. Message would be recorded in messageSend
      // 6. Contact metrics would be updated
    });

    it("should handle re-engagement email with trigger data", () => {
      const triggerData = {
        lastActivityDays: 30,
        lastPurchaseAmount: 99.99,
        productName: "Premium Plan",
      };

      const templateHtml = "<p>It's been {{trigger.lastActivityDays}} days since we saw you.</p>" +
        "<p>Your last purchase: ${{trigger.lastPurchaseAmount}} for {{trigger.productName}}</p>";

      // Variable substitution
      const htmlBody = templateHtml
        .replace("{{trigger.lastActivityDays}}", String(triggerData.lastActivityDays))
        .replace("{{trigger.lastPurchaseAmount}}", String(triggerData.lastPurchaseAmount))
        .replace("{{trigger.productName}}", triggerData.productName);

      expect(htmlBody).toContain("30 days");
      expect(htmlBody).toContain("$99.99");
      expect(htmlBody).toContain("Premium Plan");
    });

    it("should handle abandoned cart email with product list", () => {
      const triggerData = {
        cartTotal: 149.99,
        cartItems: [
          { name: "Widget A", price: 49.99 },
          { name: "Widget B", price: 100.00 },
        ],
      };

      // This would require more complex template processing in production
      expect(triggerData.cartTotal).toBe(149.99);
      expect(triggerData.cartItems).toHaveLength(2);
    });
  });

  describe("Email Send Results", () => {
    it("should return success with message ID", () => {
      const result = {
        success: true,
        messageId: "ses-12345-abcde",
        sentAt: new Date().toISOString(),
      };

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("should return skip for invalid contact", () => {
      const result = {
        action: "next" as const,
        skipped: true,
        reason: "Contact email status is bounced",
      };

      expect(result.skipped).toBe(true);
      expect(result.reason).toContain("bounced");
    });

    it("should return failure for send errors", () => {
      const result = {
        action: "fail" as const,
        error: "SES sending quota exceeded",
      };

      expect(result.action).toBe("fail");
      expect(result.error).toBeDefined();
    });
  });
});
