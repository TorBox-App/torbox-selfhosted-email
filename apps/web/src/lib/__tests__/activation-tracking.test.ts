import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock PostHog (not the focus of this test)
vi.mock("../posthog-server", () => ({
  getPostHogClient: vi.fn(() => ({
    capture: vi.fn(),
    flush: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

// Track whether POST was called and completed
const mockPost = vi.fn(() =>
  Promise.resolve({ data: { success: true }, error: null })
);

vi.mock("@wraps.dev/client", () => ({
  createPlatformClient: vi.fn(() => ({
    POST: mockPost,
  })),
}));

// Mock database — return count=1 so activation events fire
vi.mock("@wraps/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ count: 1 }])),
      })),
    })),
  },
  awsAccount: { organizationId: "organizationId" },
  contact: { organizationId: "organizationId" },
  template: { organizationId: "organizationId" },
  batchSend: { organizationId: "organizationId" },
  apiKey: { organizationId: "organizationId" },
  messageSend: { organizationId: "organizationId", status: "status" },
}));

vi.mock("drizzle-orm", () => ({
  count: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
}));

// Import AFTER mocks
import {
  trackApiKeyCreated,
  trackAwsConnected,
  trackBroadcastCreated,
  trackContactCreated,
  trackContactsImported,
  trackDomainVerified,
  trackFirstEmailSent,
  trackTemplateCreated,
  trackTemplatePublished,
  trackWorkflowCreated,
} from "../activation-tracking";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("activation-tracking: emit() calls to Wraps platform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WRAPS_API_KEY = "test-wraps-api-key";
  });

  it("trackAwsConnected should await emit() so the HTTP call completes", async () => {
    // Track whether the POST promise was fully resolved before trackAwsConnected returns
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          // Simulate a short async delay like a real HTTP call
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackAwsConnected("user@example.com", "org-123", {
      region: "us-east-1",
      accountId: "123456789012",
    });

    // BUG: emit() is not awaited inside trackAwsConnected, so the POST
    // promise is still pending when trackAwsConnected resolves.
    // This means the HTTP call to Wraps never completes in serverless
    // environments (Next.js server actions, Lambda, etc.)
    expect(postResolved).toBe(true);
  });

  it("trackDomainVerified should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackDomainVerified("user@example.com", "org-123", {
      domain: "example.com",
      isFirstDomain: true,
    });

    expect(postResolved).toBe(true);
  });

  it("trackFirstEmailSent should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackFirstEmailSent("user@example.com", "org-123", {
      channel: "email",
      source: "broadcast",
    });

    expect(postResolved).toBe(true);
  });

  it("trackContactCreated should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackContactCreated("user@example.com", "org-123");

    expect(postResolved).toBe(true);
  });

  it("trackApiKeyCreated should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackApiKeyCreated("user@example.com", "org-123");

    expect(postResolved).toBe(true);
  });

  it("trackBroadcastCreated should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackBroadcastCreated("user@example.com", "org-123", {
      channel: "email",
      recipientCount: 10,
    });

    expect(postResolved).toBe(true);
  });

  it("trackTemplateCreated should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackTemplateCreated("user@example.com", "org-123");

    expect(postResolved).toBe(true);
  });

  it("trackTemplatePublished should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackTemplatePublished("user@example.com", "org-123");

    expect(postResolved).toBe(true);
  });

  it("trackContactsImported should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackContactsImported("user@example.com", "org-123", { count: 50 });

    expect(postResolved).toBe(true);
  });

  it("trackWorkflowCreated should await emit() so the HTTP call completes", async () => {
    let postResolved = false;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            postResolved = true;
            resolve({ data: { success: true }, error: null });
          }, 10);
        })
    );

    await trackWorkflowCreated("user@example.com", "org-123");

    expect(postResolved).toBe(true);
  });

  it("emit() should be called with correct event name and contact email", async () => {
    mockPost.mockResolvedValue({ data: { success: true }, error: null });

    await trackAwsConnected("user@example.com", "org-123", {
      region: "us-east-1",
      accountId: "123456789012",
    });

    // Should be called for both the regular event AND the activation event (count === 1)
    expect(mockPost).toHaveBeenCalledWith("/v1/events/", {
      body: {
        name: "aws_account.connected",
        contactEmail: "user@example.com",
        properties: expect.objectContaining({
          organization_id: "org-123",
        }),
      },
    });

    expect(mockPost).toHaveBeenCalledWith("/v1/events/", {
      body: {
        name: "activation.aws_connected",
        contactEmail: "user@example.com",
        properties: expect.objectContaining({
          organization_id: "org-123",
        }),
      },
    });
  });
});
