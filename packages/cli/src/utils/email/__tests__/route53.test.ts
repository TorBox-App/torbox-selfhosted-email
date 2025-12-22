import {
  ChangeResourceRecordSetsCommand,
  ListHostedZonesByNameCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { createDNSRecords, findHostedZone } from "../route53.js";

const route53Mock = mockClient(Route53Client);

describe("utils/email/route53", () => {
  beforeEach(() => {
    route53Mock.reset();
  });

  describe("findHostedZone", () => {
    it("should return hosted zone when exact domain matches", async () => {
      route53Mock.on(ListHostedZonesByNameCommand).resolves({
        HostedZones: [
          {
            Id: "/hostedzone/Z1234567890ABC",
            Name: "example.com.",
            CallerReference: "ref-1",
          },
        ],
      });

      const result = await findHostedZone("example.com", "us-east-1");

      expect(result).toEqual({
        id: "Z1234567890ABC",
        name: "example.com.",
      });
    });

    it("should strip /hostedzone/ prefix from zone ID", async () => {
      route53Mock.on(ListHostedZonesByNameCommand).resolves({
        HostedZones: [
          {
            Id: "/hostedzone/Z999",
            Name: "test.com.",
            CallerReference: "ref-1",
          },
        ],
      });

      const result = await findHostedZone("test.com", "us-east-1");

      expect(result?.id).toBe("Z999");
    });

    it("should return null when no hosted zones found", async () => {
      route53Mock.on(ListHostedZonesByNameCommand).resolves({
        HostedZones: [],
      });

      const result = await findHostedZone("example.com", "us-east-1");

      expect(result).toBeNull();
    });

    it("should return null when zone name does not match", async () => {
      route53Mock.on(ListHostedZonesByNameCommand).resolves({
        HostedZones: [
          {
            Id: "/hostedzone/Z123",
            Name: "different.com.",
            CallerReference: "ref-1",
          },
        ],
      });

      const result = await findHostedZone("example.com", "us-east-1");

      expect(result).toBeNull();
    });

    it("should return null when zone has no ID", async () => {
      route53Mock.on(ListHostedZonesByNameCommand).resolves({
        HostedZones: [
          {
            Name: "example.com.",
            CallerReference: "ref-1",
          },
        ],
      });

      const result = await findHostedZone("example.com", "us-east-1");

      expect(result).toBeNull();
    });

    it("should return null on API error", async () => {
      route53Mock
        .on(ListHostedZonesByNameCommand)
        .rejects(new Error("Access denied"));

      const result = await findHostedZone("example.com", "us-east-1");

      expect(result).toBeNull();
    });

    it("should try parent domain for subdomains", async () => {
      // First call for track.example.com returns no match
      route53Mock
        .on(ListHostedZonesByNameCommand, { DNSName: "track.example.com" })
        .resolves({
          HostedZones: [],
        });

      // Second call for example.com returns the zone
      route53Mock
        .on(ListHostedZonesByNameCommand, { DNSName: "example.com" })
        .resolves({
          HostedZones: [
            {
              Id: "/hostedzone/Z123",
              Name: "example.com.",
              CallerReference: "ref-1",
            },
          ],
        });

      const result = await findHostedZone("track.example.com", "us-east-1");

      expect(result).toEqual({
        id: "Z123",
        name: "example.com.",
      });
    });

    it("should return null when parent domain also not found", async () => {
      route53Mock.on(ListHostedZonesByNameCommand).resolves({
        HostedZones: [],
      });

      const result = await findHostedZone("sub.example.com", "us-east-1");

      expect(result).toBeNull();
    });
  });

  describe("createDNSRecords", () => {
    it("should create DKIM, SPF, and DMARC records", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords(
        "Z123",
        "example.com",
        ["token1", "token2", "token3"],
        "us-east-1"
      );

      expect(
        route53Mock.commandCalls(ChangeResourceRecordSetsCommand)
      ).toHaveLength(1);

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      expect(changes).toBeDefined();
      // 3 DKIM + 1 SPF + 1 DMARC = 5 records
      expect(changes).toHaveLength(5);
    });

    it("should create correct DKIM CNAME records", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords("Z123", "example.com", ["abc", "def"], "us-east-1");

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      const dkimRecords = changes?.filter(
        (c) => c.ResourceRecordSet?.Type === "CNAME"
      );
      expect(dkimRecords).toHaveLength(2);

      expect(dkimRecords?.[0].ResourceRecordSet?.Name).toBe(
        "abc._domainkey.example.com"
      );
      expect(dkimRecords?.[0].ResourceRecordSet?.ResourceRecords?.[0].Value).toBe(
        "abc.dkim.amazonses.com"
      );
    });

    it("should create SPF TXT record", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords("Z123", "example.com", ["token1"], "us-east-1");

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      const spfRecord = changes?.find(
        (c) =>
          c.ResourceRecordSet?.Type === "TXT" &&
          c.ResourceRecordSet?.Name === "example.com"
      );

      expect(spfRecord).toBeDefined();
      expect(spfRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value).toBe(
        '"v=spf1 include:amazonses.com ~all"'
      );
      expect(spfRecord?.ResourceRecordSet?.TTL).toBe(1800);
    });

    it("should create DMARC TXT record with default rua", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords("Z123", "example.com", ["token1"], "us-east-1");

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      const dmarcRecord = changes?.find(
        (c) =>
          c.ResourceRecordSet?.Type === "TXT" &&
          c.ResourceRecordSet?.Name === "_dmarc.example.com"
      );

      expect(dmarcRecord).toBeDefined();
      expect(
        dmarcRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value
      ).toContain("v=DMARC1");
      expect(
        dmarcRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value
      ).toContain("rua=mailto:postmaster@example.com");
    });

    it("should use mailFromDomain for DMARC rua when provided", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords(
        "Z123",
        "example.com",
        ["token1"],
        "us-east-1",
        undefined, // customTrackingDomain
        "mail.example.com" // mailFromDomain
      );

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      const dmarcRecord = changes?.find(
        (c) =>
          c.ResourceRecordSet?.Type === "TXT" &&
          c.ResourceRecordSet?.Name === "_dmarc.example.com"
      );

      expect(
        dmarcRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value
      ).toContain("rua=mailto:postmaster@mail.example.com");
    });

    it("should create custom tracking domain CNAME when provided", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords(
        "Z123",
        "example.com",
        ["token1"],
        "us-east-1",
        "track.example.com" // customTrackingDomain
      );

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      const trackingRecord = changes?.find(
        (c) =>
          c.ResourceRecordSet?.Type === "CNAME" &&
          c.ResourceRecordSet?.Name === "track.example.com"
      );

      expect(trackingRecord).toBeDefined();
      expect(
        trackingRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value
      ).toBe("r.us-east-1.awstrack.me");
    });

    it("should use CloudFront domain for tracking when provided", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords(
        "Z123",
        "example.com",
        ["token1"],
        "us-east-1",
        "track.example.com", // customTrackingDomain
        undefined, // mailFromDomain
        "d1234567890.cloudfront.net" // cloudFrontDomain
      );

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      const trackingRecord = changes?.find(
        (c) =>
          c.ResourceRecordSet?.Type === "CNAME" &&
          c.ResourceRecordSet?.Name === "track.example.com"
      );

      expect(trackingRecord).toBeDefined();
      expect(
        trackingRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value
      ).toBe("d1234567890.cloudfront.net");
    });

    it("should create MAIL FROM domain records when provided", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords(
        "Z123",
        "example.com",
        ["token1"],
        "us-east-1",
        undefined, // customTrackingDomain
        "mail.example.com" // mailFromDomain
      );

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      // Check MX record
      const mxRecord = changes?.find(
        (c) =>
          c.ResourceRecordSet?.Type === "MX" &&
          c.ResourceRecordSet?.Name === "mail.example.com"
      );

      expect(mxRecord).toBeDefined();
      expect(mxRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value).toBe(
        "10 feedback-smtp.us-east-1.amazonses.com"
      );

      // Check SPF record for MAIL FROM domain
      const mailFromSpfRecord = changes?.find(
        (c) =>
          c.ResourceRecordSet?.Type === "TXT" &&
          c.ResourceRecordSet?.Name === "mail.example.com"
      );

      expect(mailFromSpfRecord).toBeDefined();
      expect(
        mailFromSpfRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value
      ).toBe('"v=spf1 include:amazonses.com ~all"');
    });

    it("should use UPSERT action for all records", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords("Z123", "example.com", ["token1"], "us-east-1");

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      expect(changes?.every((c) => c.Action === "UPSERT")).toBe(true);
    });

    it("should pass correct hosted zone ID", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords(
        "Z999888777",
        "example.com",
        ["token1"],
        "us-east-1"
      );

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      expect(call.args[0].input.HostedZoneId).toBe("Z999888777");
    });

    it("should throw error on API failure", async () => {
      route53Mock
        .on(ChangeResourceRecordSetsCommand)
        .rejects(new Error("Access denied"));

      await expect(
        createDNSRecords("Z123", "example.com", ["token1"], "us-east-1")
      ).rejects.toThrow("Access denied");
    });

    it("should handle empty DKIM tokens array", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords("Z123", "example.com", [], "us-east-1");

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      // Should still have SPF and DMARC records
      expect(changes).toHaveLength(2);
      expect(
        changes?.filter((c) => c.ResourceRecordSet?.Type === "CNAME")
      ).toHaveLength(0);
      expect(
        changes?.filter((c) => c.ResourceRecordSet?.Type === "TXT")
      ).toHaveLength(2);
    });

    it("should set TTL to 1800 for all records", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords("Z123", "example.com", ["token1"], "us-east-1");

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      expect(changes?.every((c) => c.ResourceRecordSet?.TTL === 1800)).toBe(
        true
      );
    });

    it("should create records for different regions", async () => {
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: "change-1",
          Status: "PENDING",
          SubmittedAt: new Date(),
        },
      });

      await createDNSRecords(
        "Z123",
        "example.com",
        ["token1"],
        "eu-west-1",
        "track.example.com",
        "mail.example.com"
      );

      const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
      const changes = call.args[0].input.ChangeBatch?.Changes;

      // Check region is used in tracking domain
      const trackingRecord = changes?.find(
        (c) =>
          c.ResourceRecordSet?.Type === "CNAME" &&
          c.ResourceRecordSet?.Name === "track.example.com"
      );
      expect(
        trackingRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value
      ).toBe("r.eu-west-1.awstrack.me");

      // Check region is used in MAIL FROM MX record
      const mxRecord = changes?.find(
        (c) => c.ResourceRecordSet?.Type === "MX"
      );
      expect(mxRecord?.ResourceRecordSet?.ResourceRecords?.[0].Value).toBe(
        "10 feedback-smtp.eu-west-1.amazonses.com"
      );
    });
  });
});
