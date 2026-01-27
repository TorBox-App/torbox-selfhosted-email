import { describe, expect, it, vi } from "vitest";
import {
  buildEmailDNSRecords,
  formatDNSRecordsForDisplay,
  getDNSProviderDisplayName,
  getDNSProviderTokenUrl,
  type DNSRecordInfo,
} from "../create-records.js";

describe("buildEmailDNSRecords", () => {
  it("should create DKIM CNAME records for all tokens", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1", "token2", "token3"],
      region: "us-east-1",
    };

    const records = buildEmailDNSRecords(data);

    const dkimRecords = records.filter((r) => r.category === "dkim");
    expect(dkimRecords).toHaveLength(3);

    expect(dkimRecords[0]).toEqual({
      name: "token1._domainkey.example.com",
      type: "CNAME",
      value: "token1.dkim.amazonses.com",
      category: "dkim",
    });

    expect(dkimRecords[1]).toEqual({
      name: "token2._domainkey.example.com",
      type: "CNAME",
      value: "token2.dkim.amazonses.com",
      category: "dkim",
    });

    expect(dkimRecords[2]).toEqual({
      name: "token3._domainkey.example.com",
      type: "CNAME",
      value: "token3.dkim.amazonses.com",
      category: "dkim",
    });
  });

  it("should create SPF TXT record for the domain", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1"],
      region: "us-east-1",
    };

    const records = buildEmailDNSRecords(data);
    const spfRecord = records.find((r) => r.category === "spf");

    expect(spfRecord).toEqual({
      name: "example.com",
      type: "TXT",
      value: "v=spf1 include:amazonses.com ~all",
      category: "spf",
    });
  });

  it("should create DMARC TXT record using domain when no mailFromDomain", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1"],
      region: "us-east-1",
    };

    const records = buildEmailDNSRecords(data);
    const dmarcRecord = records.find((r) => r.category === "dmarc");

    expect(dmarcRecord).toEqual({
      name: "_dmarc.example.com",
      type: "TXT",
      value: "v=DMARC1; p=quarantine; rua=mailto:postmaster@example.com",
      category: "dmarc",
    });
  });

  it("should create DMARC TXT record using mailFromDomain when provided", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1"],
      region: "us-east-1",
      mailFromDomain: "mail.example.com",
    };

    const records = buildEmailDNSRecords(data);
    const dmarcRecord = records.find((r) => r.category === "dmarc");

    expect(dmarcRecord?.value).toBe(
      "v=DMARC1; p=quarantine; rua=mailto:postmaster@mail.example.com"
    );
  });

  it("should create MAIL FROM MX record when mailFromDomain is provided", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1"],
      region: "us-east-1",
      mailFromDomain: "mail.example.com",
    };

    const records = buildEmailDNSRecords(data);
    const mxRecord = records.find((r) => r.category === "mailfrom_mx");

    expect(mxRecord).toEqual({
      name: "mail.example.com",
      type: "MX",
      value: "feedback-smtp.us-east-1.amazonses.com",
      priority: 10,
      category: "mailfrom_mx",
    });
  });

  it("should create MAIL FROM SPF record when mailFromDomain is provided", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1"],
      region: "us-east-1",
      mailFromDomain: "mail.example.com",
    };

    const records = buildEmailDNSRecords(data);
    const mailFromSpf = records.find((r) => r.category === "mailfrom_spf");

    expect(mailFromSpf).toEqual({
      name: "mail.example.com",
      type: "TXT",
      value: "v=spf1 include:amazonses.com ~all",
      category: "mailfrom_spf",
    });
  });

  it("should not create MAIL FROM records when mailFromDomain is not provided", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1"],
      region: "us-east-1",
    };

    const records = buildEmailDNSRecords(data);
    const mailFromRecords = records.filter(
      (r) => r.category === "mailfrom_mx" || r.category === "mailfrom_spf"
    );

    expect(mailFromRecords).toHaveLength(0);
  });

  it("should return correct total number of records without mailFromDomain", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1", "token2", "token3"],
      region: "us-east-1",
    };

    const records = buildEmailDNSRecords(data);

    // 3 DKIM + 1 SPF + 1 DMARC = 5 records
    expect(records).toHaveLength(5);
  });

  it("should return correct total number of records with mailFromDomain", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1", "token2", "token3"],
      region: "us-east-1",
      mailFromDomain: "mail.example.com",
    };

    const records = buildEmailDNSRecords(data);

    // 3 DKIM + 1 SPF + 1 DMARC + 1 MX + 1 SPF (mailfrom) = 7 records
    expect(records).toHaveLength(7);
  });

  it("should use correct region in MAIL FROM MX record", () => {
    const data = {
      domain: "example.com",
      dkimTokens: ["token1"],
      region: "eu-west-1",
      mailFromDomain: "mail.example.com",
    };

    const records = buildEmailDNSRecords(data);
    const mxRecord = records.find((r) => r.category === "mailfrom_mx");

    expect(mxRecord?.value).toBe("feedback-smtp.eu-west-1.amazonses.com");
  });
});

describe("formatDNSRecordsForDisplay", () => {
  it("should format records without priority", () => {
    const records: DNSRecordInfo[] = [
      {
        name: "example.com",
        type: "TXT",
        value: "v=spf1 include:amazonses.com ~all",
        category: "spf",
      },
    ];

    const formatted = formatDNSRecordsForDisplay(records);

    expect(formatted).toEqual([
      {
        name: "example.com",
        type: "TXT",
        value: "v=spf1 include:amazonses.com ~all",
      },
    ]);
  });

  it("should format records with priority (MX records)", () => {
    const records: DNSRecordInfo[] = [
      {
        name: "mail.example.com",
        type: "MX",
        value: "feedback-smtp.us-east-1.amazonses.com",
        priority: 10,
        category: "mailfrom_mx",
      },
    ];

    const formatted = formatDNSRecordsForDisplay(records);

    expect(formatted).toEqual([
      {
        name: "mail.example.com",
        type: "MX",
        value: "10 feedback-smtp.us-east-1.amazonses.com",
      },
    ]);
  });

  it("should format multiple records correctly", () => {
    const records: DNSRecordInfo[] = [
      {
        name: "token1._domainkey.example.com",
        type: "CNAME",
        value: "token1.dkim.amazonses.com",
        category: "dkim",
      },
      {
        name: "mail.example.com",
        type: "MX",
        value: "feedback-smtp.us-east-1.amazonses.com",
        priority: 10,
        category: "mailfrom_mx",
      },
    ];

    const formatted = formatDNSRecordsForDisplay(records);

    expect(formatted).toHaveLength(2);
    expect(formatted[0].value).toBe("token1.dkim.amazonses.com");
    expect(formatted[1].value).toBe("10 feedback-smtp.us-east-1.amazonses.com");
  });

  it("should handle empty array", () => {
    const formatted = formatDNSRecordsForDisplay([]);
    expect(formatted).toEqual([]);
  });
});

describe("getDNSProviderDisplayName", () => {
  it("should return correct name for route53", () => {
    expect(getDNSProviderDisplayName("route53")).toBe("AWS Route53");
  });

  it("should return correct name for vercel", () => {
    expect(getDNSProviderDisplayName("vercel")).toBe("Vercel DNS");
  });

  it("should return correct name for cloudflare", () => {
    expect(getDNSProviderDisplayName("cloudflare")).toBe("Cloudflare");
  });

  it("should return correct name for manual", () => {
    expect(getDNSProviderDisplayName("manual")).toBe("Manual");
  });
});

describe("getDNSProviderTokenUrl", () => {
  it("should return correct URL for vercel", () => {
    expect(getDNSProviderTokenUrl("vercel")).toBe(
      "https://vercel.com/account/tokens"
    );
  });

  it("should return correct URL for cloudflare", () => {
    expect(getDNSProviderTokenUrl("cloudflare")).toBe(
      "https://dash.cloudflare.com/profile/api-tokens"
    );
  });
});
