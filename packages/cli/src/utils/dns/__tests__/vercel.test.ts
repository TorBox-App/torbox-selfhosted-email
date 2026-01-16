/**
 * Tests for Vercel DNS client
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VercelDNSClient } from "../vercel.js";

describe("VercelDNSClient", () => {
  let client: VercelDNSClient;
  const mockDomain = "example.com";
  const mockApiToken = "test-api-token";
  const mockTeamId = "test-team-id";

  beforeEach(() => {
    client = new VercelDNSClient(mockDomain, mockApiToken, mockTeamId);
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ id: "record-1" }),
      } as Response)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client with team ID", () => {
      const clientWithTeam = new VercelDNSClient(
        mockDomain,
        mockApiToken,
        mockTeamId
      );
      expect(clientWithTeam).toBeInstanceOf(VercelDNSClient);
    });

    it("should create client without team ID", () => {
      const clientNoTeam = new VercelDNSClient(mockDomain, mockApiToken);
      expect(clientNoTeam).toBeInstanceOf(VercelDNSClient);
    });
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

    it("should use correct API endpoint with team ID", async () => {
      await client.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v2/domains/${mockDomain}/records`),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiToken}`,
          }),
        })
      );

      // Check team ID is included in URL
      const calls = vi.mocked(fetch).mock.calls;
      expect(calls[0][0]).toContain(`teamId=${mockTeamId}`);
    });

    it("should not include teamId when not provided", async () => {
      const clientNoTeam = new VercelDNSClient(mockDomain, mockApiToken);
      await clientNoTeam.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      const calls = vi.mocked(fetch).mock.calls;
      expect(calls[0][0]).not.toContain("teamId=");
    });

    it("should handle API errors", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              error: { code: "forbidden", message: "Access denied" },
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

    it("should convert domain name to relative format", async () => {
      await client.createEmailRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      const calls = vi.mocked(fetch).mock.calls;
      // First call is for DKIM record
      const body = JSON.parse(calls[0][1]?.body as string);
      // Should be relative name (without domain suffix)
      expect(body.name).toBe("token1._domainkey");
    });
  });

  describe("deleteEmailRecords", () => {
    it("should delete existing records", async () => {
      // Mock findRecord to return records, then delete to succeed
      vi.spyOn(global, "fetch").mockImplementation((url) => {
        if (String(url).includes("/v4/domains/")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                records: [
                  {
                    id: "record-1",
                    name: "token1._domainkey",
                    type: "CNAME",
                    value: "test",
                  },
                ],
              }),
          } as Response);
        }
        return Promise.resolve({
          json: () => Promise.resolve({ id: "record-1" }),
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
          json: () => Promise.resolve({ records: [] }),
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
          json: () => Promise.resolve({ records: [] }),
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
      // Each call to findRecord makes an API call that returns all records
      // The client filters locally based on name and type
      vi.spyOn(global, "fetch").mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              records: [
                {
                  id: "1",
                  name: "token1._domainkey",
                  type: "CNAME",
                  value: "token1.dkim.amazonses.com",
                },
                {
                  id: "2",
                  name: "_dmarc",
                  type: "TXT",
                  value: "v=DMARC1; p=quarantine",
                },
                // Use "@" for the root domain SPF record (Vercel uses relative names)
                {
                  id: "3",
                  name: "@",
                  type: "TXT",
                  value: "v=spf1 include:amazonses.com ~all",
                },
              ],
            }),
        } as Response)
      );

      const result = await client.verifyRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      // The SPF record lookup uses domain name "example.com" which gets converted to "@"
      // but the findRecord method tries to match both the relative name and full name
      expect(result.verified).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.incorrect).toEqual([]);
    });

    it("should detect incorrect record values", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              records: [
                {
                  id: "1",
                  name: "token1._domainkey",
                  type: "CNAME",
                  value: "wrong-value",
                },
              ],
            }),
        } as Response)
      );

      const result = await client.verifyRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        region: "us-east-1",
      });

      expect(result.verified).toBe(false);
      expect(result.incorrect.length).toBeGreaterThan(0);
    });

    it("should check MAIL FROM records when provided", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve({ records: [] }),
        } as Response)
      );

      const result = await client.verifyRecords({
        domain: "example.com",
        dkimTokens: ["token1"],
        mailFromDomain: "mail.example.com",
        region: "us-east-1",
      });

      expect(result.verified).toBe(false);
      // Should include MX and SPF for MAIL FROM domain
      expect(result.missing.some((m) => m.includes("MX"))).toBe(true);
    });
  });
});
