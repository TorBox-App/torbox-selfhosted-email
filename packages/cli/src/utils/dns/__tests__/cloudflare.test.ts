/**
 * Tests for Cloudflare DNS client
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareDNSClient } from "../cloudflare.js";

describe("CloudflareDNSClient", () => {
  let client: CloudflareDNSClient;
  const mockZoneId = "test-zone-id";
  const mockApiToken = "test-api-token";

  beforeEach(() => {
    client = new CloudflareDNSClient(mockZoneId, mockApiToken);
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({ success: true, result: { id: "record-1" } }),
      } as Response)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createEmailRecords", () => {
    it("should create all required email records", async () => {
      const result = await client.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1", "token2", "token3"],
        mailFromDomain: "mail.example.com",
        region: "us-east-1",
      });

      expect(result.success).toBe(true);
      // 3 DKIM + 1 SPF + 1 DMARC + 1 MX + 1 MAIL FROM SPF = 7 records
      expect(result.recordsCreated).toBe(7);
      expect(result.errors).toBeUndefined();
    });

    it("should create records without mailFromDomain", async () => {
      const result = await client.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1", "token2", "token3"],
        region: "us-east-1",
      });

      expect(result.success).toBe(true);
      // 3 DKIM + 1 SPF + 1 DMARC = 5 records
      expect(result.recordsCreated).toBe(5);
    });

    it("should use correct API endpoint", async () => {
      await client.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/zones/${mockZoneId}/dns_records`),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiToken}`,
          }),
        })
      );
    });

    it("should handle API errors", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              success: false,
              errors: [{ code: 1000, message: "Invalid token" }],
            }),
        } as Response)
      );

      const result = await client.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() =>
        Promise.reject(new Error("Network error"))
      );

      const result = await client.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Network error");
    });

    it("should set proxied to false for email records", async () => {
      await client.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      const calls = vi.mocked(fetch).mock.calls;
      const body = JSON.parse(calls[0][1]?.body as string);
      expect(body.proxied).toBe(false);
    });
  });

  describe("deleteEmailRecords", () => {
    it("should delete existing records", async () => {
      // Mock findRecord to return a record
      vi.spyOn(global, "fetch").mockImplementation((url) => {
        if (String(url).includes("?name=")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                success: true,
                result: [
                  {
                    id: "record-1",
                    name: "test",
                    type: "CNAME",
                    content: "value",
                  },
                ],
              }),
          } as Response);
        }
        return Promise.resolve({
          json: () =>
            Promise.resolve({ success: true, result: { id: "record-1" } }),
        } as Response);
      });

      const result = await client.deleteEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(result.success).toBe(true);
    });

    it("should handle missing records gracefully", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true, result: [] }),
        } as Response)
      );

      const result = await client.deleteEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(0);
    });
  });

  describe("verifyRecords", () => {
    it("should report missing records", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true, result: [] }),
        } as Response)
      );

      const result = await client.verifyRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(result.verified).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    it("should verify all records exist and are correct", async () => {
      vi.spyOn(global, "fetch").mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("_domainkey")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                success: true,
                result: [
                  {
                    id: "1",
                    name: "token1._domainkey.example.com",
                    type: "CNAME",
                    content: "token1.dkim.amazonses.com",
                  },
                ],
              }),
          } as Response);
        }
        if (urlStr.includes("_dmarc")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                success: true,
                result: [
                  {
                    id: "2",
                    name: "_dmarc.example.com",
                    type: "TXT",
                    content: "v=DMARC1; p=quarantine",
                  },
                ],
              }),
          } as Response);
        }
        if (urlStr.includes("type=TXT")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                success: true,
                result: [
                  {
                    id: "3",
                    name: "example.com",
                    type: "TXT",
                    content: "v=spf1 include:amazonses.com ~all",
                  },
                ],
              }),
          } as Response);
        }
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, result: [] }),
        } as Response);
      });

      const result = await client.verifyRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(result.missing).toEqual([]);
      expect(result.incorrect).toEqual([]);
      expect(result.verified).toBe(true);
    });

    it("should detect incorrect record values", async () => {
      vi.spyOn(global, "fetch").mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("_domainkey")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                success: true,
                result: [
                  {
                    id: "1",
                    name: "token1._domainkey.example.com",
                    type: "CNAME",
                    content: "wrong-value",
                  },
                ],
              }),
          } as Response);
        }
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, result: [] }),
        } as Response);
      });

      const result = await client.verifyRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(result.verified).toBe(false);
      expect(result.incorrect.length).toBeGreaterThan(0);
    });
  });
});
