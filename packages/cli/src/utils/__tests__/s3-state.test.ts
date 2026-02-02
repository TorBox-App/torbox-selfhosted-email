import { existsSync, statSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock @aws-sdk/client-s3 with a class-based S3Client
const mockSend = vi.fn();

class MockS3Client {
  send = mockSend;
}

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: MockS3Client,
  HeadBucketCommand: class {
    constructor(public input: any) {}
  },
  CreateBucketCommand: class {
    constructor(public input: any) {}
  },
  PutBucketEncryptionCommand: class {
    constructor(public input: any) {}
  },
  PutBucketVersioningCommand: class {
    constructor(public input: any) {}
  },
  PutPublicAccessBlockCommand: class {
    constructor(public input: any) {}
  },
  PutBucketTaggingCommand: class {
    constructor(public input: any) {}
  },
  PutObjectCommand: class {
    Bucket: string;
    Key: string;
    Body: string;
    ContentType: string;
    constructor(public input: any) {
      this.Bucket = input.Bucket;
      this.Key = input.Key;
      this.Body = input.Body;
      this.ContentType = input.ContentType;
    }
  },
  GetObjectCommand: class {
    constructor(public input: any) {}
  },
}));

// Mock Pulumi automation
vi.mock("@pulumi/pulumi/automation/index.js", () => ({
  LocalWorkspace: {
    selectStack: vi.fn(),
    createOrSelectStack: vi.fn(),
  },
}));

import {
  downloadMetadata,
  ensureStateBucket,
  getS3BackendUrl,
  getStateBucketName,
  migrateLocalPulumiState,
  needsMigration,
  stateBucketExists,
  uploadMetadata,
} from "../shared/s3-state.js";

describe("s3-state utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStateBucketName", () => {
    it("should return correct bucket name format", () => {
      const name = getStateBucketName("123456789012", "us-east-1");
      expect(name).toBe("wraps-state-123456789012-us-east-1");
    });

    it("should work with different regions", () => {
      const name = getStateBucketName("999888777666", "eu-west-1");
      expect(name).toBe("wraps-state-999888777666-eu-west-1");
    });
  });

  describe("getS3BackendUrl", () => {
    it("should return s3:// URL format", () => {
      const url = getS3BackendUrl("123456789012", "us-east-1");
      expect(url).toBe("s3://wraps-state-123456789012-us-east-1");
    });
  });

  describe("stateBucketExists", () => {
    it("should return true when bucket exists", async () => {
      mockSend.mockResolvedValueOnce({}); // HeadBucket success

      const result = await stateBucketExists("123456789012", "us-east-1");
      expect(result).toBe(true);
    });

    it("should return false when bucket does not exist (NotFound)", async () => {
      const error = new Error("Not found");
      error.name = "NotFound";
      mockSend.mockRejectedValueOnce(error);

      const result = await stateBucketExists("123456789012", "us-east-1");
      expect(result).toBe(false);
    });

    it("should return false when bucket does not exist (404)", async () => {
      const error = Object.assign(new Error("Not found"), {
        $metadata: { httpStatusCode: 404 },
      });
      mockSend.mockRejectedValueOnce(error);

      const result = await stateBucketExists("123456789012", "us-east-1");
      expect(result).toBe(false);
    });

    it("should throw on permission errors", async () => {
      const error = new Error("Access denied");
      error.name = "AccessDenied";
      Object.assign(error, { $metadata: { httpStatusCode: 403 } });
      mockSend.mockRejectedValueOnce(error);

      await expect(
        stateBucketExists("123456789012", "us-east-1")
      ).rejects.toThrow("Access denied");
    });
  });

  describe("ensureStateBucket", () => {
    it("should return existing bucket name when bucket exists", async () => {
      mockSend.mockResolvedValueOnce({}); // HeadBucket success

      const name = await ensureStateBucket("123456789012", "us-east-1");
      expect(name).toBe("wraps-state-123456789012-us-east-1");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should create bucket with full configuration when not found", async () => {
      // HeadBucket fails (not found)
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFound";
      mockSend.mockRejectedValueOnce(notFoundError);

      // CreateBucket, PutBucketEncryption, PutBucketVersioning, PutPublicAccessBlock, PutBucketTagging
      mockSend.mockResolvedValueOnce({}); // CreateBucket
      mockSend.mockResolvedValueOnce({}); // PutBucketEncryption
      mockSend.mockResolvedValueOnce({}); // PutBucketVersioning
      mockSend.mockResolvedValueOnce({}); // PutPublicAccessBlock
      mockSend.mockResolvedValueOnce({}); // PutBucketTagging

      const name = await ensureStateBucket("123456789012", "us-east-1");
      expect(name).toBe("wraps-state-123456789012-us-east-1");
      expect(mockSend).toHaveBeenCalledTimes(6); // HeadBucket + 5 creation calls
    });
  });

  describe("uploadMetadata", () => {
    it("should write correct S3 key with JSON content", async () => {
      mockSend.mockResolvedValueOnce({}); // PutObject

      const metadata = {
        version: "1.0.0",
        accountId: "123456789012",
        region: "us-east-1",
        provider: "vercel" as const,
        timestamp: "2024-01-01T00:00:00.000Z",
        services: {},
      };

      await uploadMetadata("wraps-state-123456789012-us-east-1", metadata);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const putCall = mockSend.mock.calls[0][0];
      expect(putCall.Bucket).toBe("wraps-state-123456789012-us-east-1");
      expect(putCall.Key).toBe("metadata/123456789012-us-east-1.json");
      expect(putCall.ContentType).toBe("application/json");
    });
  });

  describe("downloadMetadata", () => {
    it("should parse JSON from S3", async () => {
      const metadata = {
        version: "1.0.0",
        accountId: "123456789012",
        region: "us-east-1",
        provider: "vercel",
        timestamp: "2024-01-01T00:00:00.000Z",
        services: {},
      };

      mockSend.mockResolvedValueOnce({
        Body: {
          transformToString: () => Promise.resolve(JSON.stringify(metadata)),
        },
      });

      const result = await downloadMetadata(
        "wraps-state-123456789012-us-east-1",
        "123456789012",
        "us-east-1"
      );

      expect(result).toEqual(metadata);
    });

    it("should return null on NoSuchKey", async () => {
      const error = new Error("Key not found");
      error.name = "NoSuchKey";
      mockSend.mockRejectedValueOnce(error);

      const result = await downloadMetadata(
        "wraps-state-123456789012-us-east-1",
        "123456789012",
        "us-east-1"
      );

      expect(result).toBeNull();
    });

    it("should return null on 404 status", async () => {
      const error = Object.assign(new Error("Not found"), {
        $metadata: { httpStatusCode: 404 },
      });
      mockSend.mockRejectedValueOnce(error);

      const result = await downloadMetadata(
        "wraps-state-123456789012-us-east-1",
        "123456789012",
        "us-east-1"
      );

      expect(result).toBeNull();
    });

    it("should throw on other errors", async () => {
      const error = new Error("Internal error");
      error.name = "InternalError";
      Object.assign(error, { $metadata: { httpStatusCode: 500 } });
      mockSend.mockRejectedValueOnce(error);

      await expect(
        downloadMetadata(
          "wraps-state-123456789012-us-east-1",
          "123456789012",
          "us-east-1"
        )
      ).rejects.toThrow("Internal error");
    });
  });

  describe("needsMigration", () => {
    it("should return false when marker file exists", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path === "string" && path.includes(".migrated-")) {
          return true;
        }
        return false;
      });

      const result = await needsMigration(
        "/home/user/.wraps/pulumi",
        "123456789012",
        "us-east-1"
      );

      expect(result).toBe(false);
    });

    it("should return false when stacks directory does not exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await needsMigration(
        "/home/user/.wraps/pulumi",
        "123456789012",
        "us-east-1"
      );

      expect(result).toBe(false);
    });

    it("should return true when local stacks exist for account/region", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path === "string" && path.includes(".migrated-")) {
          return false;
        }
        if (typeof path === "string" && path.includes("stacks")) {
          return true;
        }
        return false;
      });

      // First readdir returns project directories
      vi.mocked(readdir).mockResolvedValueOnce(["wraps-email"] as any);
      // statSync says it's a directory
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      // Second readdir returns stack files within the project dir
      vi.mocked(readdir).mockResolvedValueOnce([
        "wraps-123456789012-us-east-1.json",
        "other-stack.json",
      ] as any);

      const result = await needsMigration(
        "/home/user/.wraps/pulumi",
        "123456789012",
        "us-east-1"
      );

      expect(result).toBe(true);
    });

    it("should return false when no matching stacks exist", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path === "string" && path.includes(".migrated-")) {
          return false;
        }
        return true;
      });

      // First readdir returns project directories
      vi.mocked(readdir).mockResolvedValueOnce(["wraps-email"] as any);
      // statSync says it's a directory
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      // Second readdir returns stack files that don't match
      vi.mocked(readdir).mockResolvedValueOnce([
        "wraps-other-account-us-east-1.json",
      ] as any);

      const result = await needsMigration(
        "/home/user/.wraps/pulumi",
        "123456789012",
        "us-east-1"
      );

      expect(result).toBe(false);
    });
  });

  describe("migrateLocalPulumiState", () => {
    it("should write marker file after migration", async () => {
      // First readdir returns project directories
      vi.mocked(readdir).mockResolvedValueOnce(["wraps-email"] as any);
      // statSync says it's a directory
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      // Second readdir returns matching stack files within project dir
      vi.mocked(readdir).mockResolvedValueOnce([
        "wraps-123456789012-us-east-1.json",
      ] as any);

      // Mock Pulumi automation
      const pulumi = await import("@pulumi/pulumi/automation/index.js");
      const mockExportStack = vi
        .fn()
        .mockResolvedValue({ version: 3, deployment: {} });
      const mockImportStack = vi.fn().mockResolvedValue(undefined);

      vi.mocked(pulumi.LocalWorkspace.selectStack).mockResolvedValue({
        exportStack: mockExportStack,
      } as any);

      vi.mocked(pulumi.LocalWorkspace.createOrSelectStack).mockResolvedValue({
        importStack: mockImportStack,
      } as any);

      vi.mocked(writeFile).mockResolvedValue(undefined);

      await migrateLocalPulumiState(
        "/home/user/.wraps/pulumi",
        "wraps-state-123456789012-us-east-1",
        "123456789012",
        "us-east-1"
      );

      // Verify marker file was written
      expect(writeFile).toHaveBeenCalledWith(
        "/home/user/.wraps/pulumi/.migrated-123456789012-us-east-1",
        expect.any(String),
        "utf-8"
      );
    });
  });
});
