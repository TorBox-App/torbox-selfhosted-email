import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArchiveRetention } from "../types.js";
import {
  mailManagerArchiveProvider,
  retentionToAWSPeriod,
} from "./mail-manager.js";

// ---------------------------------------------------------------------------
// Hoisted mock handles — must be defined before vi.mock() factory runs.
// vi.hoisted() values are available inside vi.mock() factory functions.
// ---------------------------------------------------------------------------
const { mockMMSend, mockSESSend } = vi.hoisted(() => ({
  mockMMSend: vi.fn(),
  mockSESSend: vi.fn(),
}));

// Use regular `function` (not arrow) so vi.fn() mocks can be called with `new`.
vi.mock("@aws-sdk/client-mailmanager", () => ({
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  MailManagerClient: vi.fn(function () {
    return { send: mockMMSend };
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  ListArchivesCommand: vi.fn(function (args: unknown) {
    return { _type: "list", ...(typeof args === "object" ? args : {}) };
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  GetArchiveCommand: vi.fn(function (args: unknown) {
    return { _type: "get", ...(typeof args === "object" ? args : {}) };
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  CreateArchiveCommand: vi.fn(function (args: unknown) {
    return { _type: "create", ...(typeof args === "object" ? args : {}) };
  }),
  ArchiveState: { ACTIVE: "ACTIVE", PENDING_DELETION: "PENDING_DELETION" },
}));

vi.mock("@aws-sdk/client-sesv2", () => ({
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  SESv2Client: vi.fn(function () {
    return { send: mockSESSend };
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  PutConfigurationSetArchivingOptionsCommand: vi.fn(function (args: unknown) {
    return {
      _type: "put-archiving",
      ...(typeof args === "object" ? args : {}),
    };
  }),
}));

// ---------------------------------------------------------------------------
// Shared test inputs
// ---------------------------------------------------------------------------
const baseInputs = {
  name: "test",
  retention: "1year",
  configSetName: "wraps-email-tracking",
  region: "us-east-1",
  tags: { ManagedBy: "wraps-pulumi", Environment: "test" },
};

const baseOutputs = {
  ...baseInputs,
  archiveId: "arc-existing-123",
  archiveArn:
    "arn:aws:ses:us-east-1:123456789012:mailmanager-archive/arc-existing-123",
};

// ---------------------------------------------------------------------------

beforeEach(() => {
  mockMMSend.mockReset();
  mockSESSend.mockReset();
  vi.clearAllMocks();
});

// ===========================================================================
// 1. retentionToAWSPeriod — pure function, no mocks needed
// ===========================================================================
describe("retentionToAWSPeriod", () => {
  it("maps permanent to PERMANENT", () => {
    expect(retentionToAWSPeriod("permanent")).toBe("PERMANENT");
  });

  it("maps indefinite to PERMANENT", () => {
    expect(retentionToAWSPeriod("indefinite")).toBe("PERMANENT");
  });

  it("maps 3months to THREE_MONTHS", () => {
    expect(retentionToAWSPeriod("3months")).toBe("THREE_MONTHS");
  });

  it("maps 1year to ONE_YEAR", () => {
    expect(retentionToAWSPeriod("1year")).toBe("ONE_YEAR");
  });

  it("maps 10years to TEN_YEARS", () => {
    expect(retentionToAWSPeriod("10years")).toBe("TEN_YEARS");
  });

  it("maps unknown value to THREE_MONTHS (default)", () => {
    expect(retentionToAWSPeriod("unknown" as ArchiveRetention)).toBe(
      "THREE_MONTHS"
    );
  });
});

// ===========================================================================
// 2. create() — no existing archive → creates new one
// ===========================================================================
describe("mailManagerArchiveProvider.create() — new archive", () => {
  it("issues CreateArchiveCommand with wraps-{name}-archive naming and Pulumi ManagedBy tag", async () => {
    // ListArchives → empty
    mockMMSend.mockResolvedValueOnce({ Archives: [] });
    // CreateArchive → returns ID
    mockMMSend.mockResolvedValueOnce({ ArchiveId: "arc-new-456" });
    // GetArchive (after create) → returns ARN
    mockMMSend.mockResolvedValueOnce({
      ArchiveArn:
        "arn:aws:ses:us-east-1:123456789012:mailmanager-archive/arc-new-456",
    });
    // PutConfigurationSetArchivingOptions → success
    mockSESSend.mockResolvedValueOnce({});

    const result = await mailManagerArchiveProvider.create!(baseInputs);

    expect(result.id).toBe("arc-new-456");
    expect(result.outs.archiveArn).toBe(
      "arn:aws:ses:us-east-1:123456789012:mailmanager-archive/arc-new-456"
    );

    // CreateArchiveCommand was called with the right archive name
    const { CreateArchiveCommand } = await import(
      "@aws-sdk/client-mailmanager"
    );
    const createCalls = vi.mocked(CreateArchiveCommand).mock.calls;
    expect(createCalls).toHaveLength(1);

    const createArgs = createCalls[0][0] as {
      ArchiveName: string;
      Tags: Array<{ Key: string; Value: string }>;
    };
    expect(createArgs.ArchiveName).toBe("wraps-test-archive");

    const managedByTag = createArgs.Tags.find((t) => t.Key === "ManagedBy");
    expect(managedByTag?.Value).toBe("wraps-pulumi");

    const nameTag = createArgs.Tags.find((t) => t.Key === "Name");
    expect(nameTag?.Value).toBe("wraps-test-archive");

    const retentionTag = createArgs.Tags.find((t) => t.Key === "Retention");
    expect(retentionTag?.Value).toBe("1year");
  });

  it("calls PutConfigurationSetArchivingOptionsCommand with the new archive ARN", async () => {
    mockMMSend.mockResolvedValueOnce({ Archives: [] });
    mockMMSend.mockResolvedValueOnce({ ArchiveId: "arc-new-456" });
    mockMMSend.mockResolvedValueOnce({
      ArchiveArn:
        "arn:aws:ses:us-east-1:123456789012:mailmanager-archive/arc-new-456",
    });
    mockSESSend.mockResolvedValueOnce({});

    await mailManagerArchiveProvider.create!(baseInputs);

    const { PutConfigurationSetArchivingOptionsCommand } = await import(
      "@aws-sdk/client-sesv2"
    );
    const putCalls = vi.mocked(PutConfigurationSetArchivingOptionsCommand).mock
      .calls;
    expect(putCalls).toHaveLength(1);

    const putArgs = putCalls[0][0] as {
      ConfigurationSetName: string;
      ArchiveArn: string;
    };
    expect(putArgs.ConfigurationSetName).toBe("wraps-email-tracking");
    expect(putArgs.ArchiveArn).toBe(
      "arn:aws:ses:us-east-1:123456789012:mailmanager-archive/arc-new-456"
    );
  });
});

// ===========================================================================
// 3. create() — existing ACTIVE archive → reuses it, skips CreateArchive
// ===========================================================================
describe("mailManagerArchiveProvider.create() — reuse existing active archive", () => {
  it("calls GetArchiveCommand for the existing ID but NOT CreateArchiveCommand", async () => {
    // ListArchives → one ACTIVE archive matching our pattern
    mockMMSend.mockResolvedValueOnce({
      Archives: [
        {
          ArchiveId: "arc-existing-123",
          ArchiveName: "wraps-test-archive",
          ArchiveState: "ACTIVE",
        },
      ],
    });
    // GetArchive → returns the ARN
    mockMMSend.mockResolvedValueOnce({
      ArchiveArn:
        "arn:aws:ses:us-east-1:123456789012:mailmanager-archive/arc-existing-123",
    });
    // PutConfigurationSetArchivingOptions → success
    mockSESSend.mockResolvedValueOnce({});

    const result = await mailManagerArchiveProvider.create!(baseInputs);

    expect(result.id).toBe("arc-existing-123");

    const { CreateArchiveCommand, GetArchiveCommand } = await import(
      "@aws-sdk/client-mailmanager"
    );
    expect(vi.mocked(CreateArchiveCommand).mock.calls).toHaveLength(0);
    expect(vi.mocked(GetArchiveCommand).mock.calls).toHaveLength(1);
  });
});

// ===========================================================================
// 3b. create() — ListArchives failure surfaces instead of silently creating
// ===========================================================================
describe("mailManagerArchiveProvider.create() — ListArchives error", () => {
  it("throws (does not fall through to create) when ListArchives fails", async () => {
    // ListArchives → real API failure (e.g. AccessDenied / throttling)
    mockMMSend.mockRejectedValueOnce(new Error("AccessDenied: not authorized"));

    await expect(
      mailManagerArchiveProvider.create!(baseInputs)
    ).rejects.toThrow(/Failed to list existing Mail Manager archives/i);

    // Must NOT have attempted to create a (possibly duplicate) archive.
    const { CreateArchiveCommand } = await import(
      "@aws-sdk/client-mailmanager"
    );
    expect(vi.mocked(CreateArchiveCommand).mock.calls).toHaveLength(0);
  });
});

// ===========================================================================
// 4. create() — ConflictException on first attempt → retries with suffix -2
// ===========================================================================
describe("mailManagerArchiveProvider.create() — ConflictException retry", () => {
  it("retries with wraps-{name}-archive-2 after ConflictException on attempt 1", async () => {
    // ListArchives → empty
    mockMMSend.mockResolvedValueOnce({ Archives: [] });
    // CreateArchive attempt 1 → ConflictException
    const conflict = new Error("Archive name conflicts with existing archive");
    conflict.name = "ConflictException";
    mockMMSend.mockRejectedValueOnce(conflict);
    // CreateArchive attempt 2 → success
    mockMMSend.mockResolvedValueOnce({ ArchiveId: "arc-suffix-789" });
    // GetArchive (after create) → ARN
    mockMMSend.mockResolvedValueOnce({
      ArchiveArn:
        "arn:aws:ses:us-east-1:123456789012:mailmanager-archive/arc-suffix-789",
    });
    // PutConfigurationSetArchivingOptions → success
    mockSESSend.mockResolvedValueOnce({});

    await mailManagerArchiveProvider.create!(baseInputs);

    const { CreateArchiveCommand } = await import(
      "@aws-sdk/client-mailmanager"
    );
    const createCalls = vi.mocked(CreateArchiveCommand).mock.calls;
    expect(createCalls).toHaveLength(2);

    const attempt1 = createCalls[0][0] as { ArchiveName: string };
    const attempt2 = createCalls[1][0] as { ArchiveName: string };
    expect(attempt1.ArchiveName).toBe("wraps-test-archive");
    expect(attempt2.ArchiveName).toBe("wraps-test-archive-2");
  });

  it("detects ConflictException by message when the error name is generic (AWS SDK v3 quirk)", async () => {
    mockMMSend.mockResolvedValueOnce({ Archives: [] });
    // name stays the default "Error"; the type only appears in the message.
    mockMMSend.mockRejectedValueOnce(
      new Error("ConflictException: Archive name already in use")
    );
    mockMMSend.mockResolvedValueOnce({ ArchiveId: "arc-msg-789" });
    mockMMSend.mockResolvedValueOnce({
      ArchiveArn:
        "arn:aws:ses:us-east-1:123456789012:mailmanager-archive/arc-msg-789",
    });
    mockSESSend.mockResolvedValueOnce({});

    await mailManagerArchiveProvider.create!(baseInputs);

    const { CreateArchiveCommand } = await import(
      "@aws-sdk/client-mailmanager"
    );
    const createCalls = vi.mocked(CreateArchiveCommand).mock.calls;
    expect(createCalls).toHaveLength(2);
    expect((createCalls[1][0] as { ArchiveName: string }).ArchiveName).toBe(
      "wraps-test-archive-2"
    );
  });
});

// ===========================================================================
// 5. delete() — Non-Destructive: does NOT call any MailManager destructive API
// ===========================================================================
describe("mailManagerArchiveProvider.delete()", () => {
  it("does not call MailManagerClient at all (Non-Destructive)", async () => {
    mockSESSend.mockResolvedValueOnce({});

    await mailManagerArchiveProvider.delete!("arc-existing-123", baseOutputs);

    // MailManagerClient should NOT have been instantiated during delete
    const { MailManagerClient } = await import("@aws-sdk/client-mailmanager");
    expect(vi.mocked(MailManagerClient).mock.calls).toHaveLength(0);
  });

  it("de-associates the archive from the config set on delete (best-effort)", async () => {
    mockSESSend.mockResolvedValueOnce({});

    await mailManagerArchiveProvider.delete!("arc-existing-123", baseOutputs);

    const { PutConfigurationSetArchivingOptionsCommand } = await import(
      "@aws-sdk/client-sesv2"
    );
    const putCalls = vi.mocked(PutConfigurationSetArchivingOptionsCommand).mock
      .calls;
    expect(putCalls).toHaveLength(1);

    const putArgs = putCalls[0][0] as { ConfigurationSetName: string };
    expect(putArgs.ConfigurationSetName).toBe("wraps-email-tracking");
  });
});

// ===========================================================================
// 6. diff() — retention change → hard error, no replaces emitted
// ===========================================================================
describe("mailManagerArchiveProvider.diff()", () => {
  it("throws a hard error when retention changes (protects archived mail)", async () => {
    const oldProps = { ...baseOutputs, retention: "1year" };
    const newProps = { ...baseInputs, retention: "3months" };

    await expect(
      mailManagerArchiveProvider.diff!("arc-existing-123", oldProps, newProps)
    ).rejects.toThrow(/retention cannot be changed after creation/i);
  });

  it("throws a hard error when region changes (archive is region-bound)", async () => {
    const oldProps = { ...baseOutputs, region: "us-east-1" };
    const newProps = { ...baseInputs, region: "eu-west-1" };

    await expect(
      mailManagerArchiveProvider.diff!("arc-existing-123", oldProps, newProps)
    ).rejects.toThrow(/region cannot be changed after creation/i);
  });

  it("does not emit replaces when only configSetName changes", async () => {
    const oldProps = { ...baseOutputs };
    const newProps = {
      ...baseInputs,
      configSetName: "wraps-email-tracking-v2",
    };

    const result = await mailManagerArchiveProvider.diff!(
      "arc-existing-123",
      oldProps,
      newProps
    );

    expect(result.replaces).toEqual([]);
    expect(result.changes).toBe(true);
  });

  it("returns no changes when nothing differs", async () => {
    const result = await mailManagerArchiveProvider.diff!(
      "arc-existing-123",
      baseOutputs,
      baseInputs
    );

    expect(result.changes).toBe(false);
    expect(result.replaces).toEqual([]);
  });
});
