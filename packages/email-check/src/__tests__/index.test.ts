import { describe, expect, it } from "vitest";
import {
  areDomainsAligned,
  extractDomainFromEmail,
  getOrganizationalDomain,
  isIpAddress,
  isIpv4,
  isIpv6,
  isLocalhost,
  isValidDomain,
  looksGenericHostname,
  reverseIp,
  toAsciiDomain,
  toUnicodeDomain,
} from "../utils/domain.js";

describe("domain utils", () => {
  describe("isValidDomain", () => {
    it("accepts valid domains", () => {
      expect(isValidDomain("example.com")).toBe(true);
      expect(isValidDomain("sub.example.com")).toBe(true);
      expect(isValidDomain("deep.sub.example.com")).toBe(true);
      expect(isValidDomain("a.io")).toBe(true);
      expect(isValidDomain("my-site.co.uk")).toBe(true);
    });

    it("rejects single-label domains", () => {
      expect(isValidDomain("localhost")).toBe(false);
      expect(isValidDomain("invalid")).toBe(false);
    });

    it("rejects empty and too-long domains", () => {
      expect(isValidDomain("")).toBe(false);
      expect(isValidDomain(`${"a".repeat(64)}.com`)).toBe(false); // label > 63 chars
      expect(isValidDomain(`${"a".repeat(250)}.com`)).toBe(false); // total > 253 chars
    });

    it("rejects domains with invalid characters", () => {
      expect(isValidDomain("ex ample.com")).toBe(false);
      expect(isValidDomain("exam_ple.com")).toBe(false);
      expect(isValidDomain(".example.com")).toBe(false);
      expect(isValidDomain("example..com")).toBe(false);
    });

    it("rejects labels starting or ending with hyphens", () => {
      expect(isValidDomain("-example.com")).toBe(false);
      expect(isValidDomain("example-.com")).toBe(false);
    });
  });

  describe("toAsciiDomain", () => {
    it("lowercases domains", () => {
      expect(toAsciiDomain("EXAMPLE.COM")).toBe("example.com");
      expect(toAsciiDomain("Example.Com")).toBe("example.com");
    });

    it("passes through ASCII domains unchanged", () => {
      expect(toAsciiDomain("example.com")).toBe("example.com");
    });

    it("converts IDN domains to punycode", () => {
      expect(toAsciiDomain("münchen.de")).toBe("xn--mnchen-3ya.de");
      expect(toAsciiDomain("例え.jp")).toBe("xn--r8jz45g.jp");
    });

    it("handles invalid input gracefully", () => {
      // Falls back to lowercase
      expect(toAsciiDomain("")).toBe("");
    });
  });

  describe("toUnicodeDomain", () => {
    it("returns non-punycode domains unchanged", () => {
      expect(toUnicodeDomain("example.com")).toBe("example.com");
    });

    it("returns punycode domains as-is (simplified implementation)", () => {
      expect(toUnicodeDomain("xn--mnchen-3ya.de")).toBe("xn--mnchen-3ya.de");
    });
  });

  describe("getOrganizationalDomain", () => {
    it("extracts eTLD+1 for simple domains", () => {
      expect(getOrganizationalDomain("www.example.com")).toBe("example.com");
      expect(getOrganizationalDomain("deep.sub.example.com")).toBe(
        "example.com"
      );
      expect(getOrganizationalDomain("example.com")).toBe("example.com");
    });

    it("handles multi-part TLDs correctly", () => {
      expect(getOrganizationalDomain("www.example.co.uk")).toBe(
        "example.co.uk"
      );
      expect(getOrganizationalDomain("mail.example.com.au")).toBe(
        "example.com.au"
      );
      expect(getOrganizationalDomain("app.example.co.jp")).toBe(
        "example.co.jp"
      );
      expect(getOrganizationalDomain("sub.example.org.br")).toBe(
        "example.org.br"
      );
      expect(getOrganizationalDomain("sub.example.co.in")).toBe(
        "example.co.in"
      );
      expect(getOrganizationalDomain("sub.example.co.nz")).toBe(
        "example.co.nz"
      );
    });

    it("lowercases the result", () => {
      expect(getOrganizationalDomain("WWW.EXAMPLE.COM")).toBe("example.com");
    });

    it("handles bare org domain with multi-part TLD", () => {
      expect(getOrganizationalDomain("example.co.uk")).toBe("example.co.uk");
    });
  });

  describe("areDomainsAligned", () => {
    it("strict mode requires exact match", () => {
      expect(areDomainsAligned("example.com", "example.com", "strict")).toBe(
        true
      );
      expect(
        areDomainsAligned("sub.example.com", "example.com", "strict")
      ).toBe(false);
      expect(
        areDomainsAligned("example.com", "other.com", "strict")
      ).toBe(false);
    });

    it("relaxed mode matches organizational domains", () => {
      expect(
        areDomainsAligned("mail.example.com", "example.com", "relaxed")
      ).toBe(true);
      expect(
        areDomainsAligned("a.example.com", "b.example.com", "relaxed")
      ).toBe(true);
      expect(
        areDomainsAligned("example.com", "other.com", "relaxed")
      ).toBe(false);
    });

    it("relaxed mode handles multi-part TLDs", () => {
      expect(
        areDomainsAligned("mail.example.co.uk", "example.co.uk", "relaxed")
      ).toBe(true);
      expect(
        areDomainsAligned("example.co.uk", "other.co.uk", "relaxed")
      ).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(
        areDomainsAligned("EXAMPLE.COM", "example.com", "strict")
      ).toBe(true);
      expect(
        areDomainsAligned("Mail.Example.Com", "example.com", "relaxed")
      ).toBe(true);
    });
  });

  describe("extractDomainFromEmail", () => {
    it("extracts domain from standard email", () => {
      expect(extractDomainFromEmail("user@example.com")).toBe("example.com");
      expect(extractDomainFromEmail("hello@sub.example.com")).toBe(
        "sub.example.com"
      );
    });

    it("lowercases the extracted domain", () => {
      expect(extractDomainFromEmail("User@EXAMPLE.COM")).toBe("example.com");
    });

    it("does not extract from angle-bracketed emails (regex limitation)", () => {
      // The regex expects domain at end of string — the trailing > prevents match
      expect(extractDomainFromEmail("<user@example.com>")).toBeNull();
    });

    it("returns null for invalid input", () => {
      expect(extractDomainFromEmail("notanemail")).toBeNull();
      expect(extractDomainFromEmail("")).toBeNull();
      expect(extractDomainFromEmail("@")).toBeNull();
    });
  });

  describe("isIpAddress / isIpv4 / isIpv6", () => {
    it("detects valid IPv4 addresses", () => {
      expect(isIpv4("192.168.1.1")).toBe(true);
      expect(isIpv4("0.0.0.0")).toBe(true);
      expect(isIpv4("255.255.255.255")).toBe(true);
      expect(isIpAddress("10.0.0.1")).toBe(true);
    });

    it("rejects invalid IPv4 addresses", () => {
      expect(isIpv4("256.0.0.1")).toBe(false);
      expect(isIpv4("1.2.3")).toBe(false);
      expect(isIpv4("1.2.3.4.5")).toBe(false);
      expect(isIpv4("01.02.03.04")).toBe(false); // leading zeros
      expect(isIpv4("example.com")).toBe(false);
    });

    it("detects valid IPv6 addresses", () => {
      expect(isIpv6("::1")).toBe(true);
      expect(isIpv6("fe80::1")).toBe(true);
      expect(
        isIpv6("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
      ).toBe(true);
      expect(isIpAddress("::1")).toBe(true);
    });

    it("rejects invalid IPv6 addresses", () => {
      expect(isIpv6("not-ipv6")).toBe(false);
      expect(isIpv6("192.168.1.1")).toBe(false);
    });

    it("isIpAddress combines both checks", () => {
      expect(isIpAddress("192.168.1.1")).toBe(true);
      expect(isIpAddress("::1")).toBe(true);
      expect(isIpAddress("example.com")).toBe(false);
    });
  });

  describe("reverseIp", () => {
    it("reverses IPv4 octets for DNSBL lookup", () => {
      expect(reverseIp("1.2.3.4")).toBe("4.3.2.1");
      expect(reverseIp("192.168.1.100")).toBe("100.1.168.192");
    });

    it("throws for IPv6 (not yet implemented)", () => {
      expect(() => reverseIp("::1")).toThrow("IPv6 reverse not yet implemented");
    });
  });

  describe("isLocalhost", () => {
    it("detects IPv4 localhost", () => {
      expect(isLocalhost("127.0.0.1")).toBe(true);
      expect(isLocalhost("127.0.0.2")).toBe(true);
      expect(isLocalhost("127.255.255.255")).toBe(true);
    });

    it("detects IPv6 localhost", () => {
      expect(isLocalhost("::1")).toBe(true);
      expect(isLocalhost("0:0:0:0:0:0:0:1")).toBe(true);
    });

    it("rejects non-localhost IPs", () => {
      expect(isLocalhost("192.168.1.1")).toBe(false);
      expect(isLocalhost("10.0.0.1")).toBe(false);
      expect(isLocalhost("::2")).toBe(false);
    });
  });

  describe("looksGenericHostname", () => {
    it("detects IP-based hostnames", () => {
      expect(looksGenericHostname("192-168-1-1.isp.com", "192.168.1.1")).toBe(
        true
      );
      expect(looksGenericHostname("ip-10-0-0-1.host.com", "10.0.0.1")).toBe(
        true
      );
    });

    it("detects reversed IP patterns", () => {
      expect(looksGenericHostname("1.1.168.192.provider.com", "192.168.1.1")).toBe(
        true
      );
    });

    it("detects common generic patterns", () => {
      expect(looksGenericHostname("dynamic-123.isp.net", "1.2.3.4")).toBe(true);
      expect(looksGenericHostname("dhcp-pool.example.com", "1.2.3.4")).toBe(
        true
      );
      expect(looksGenericHostname("dsl-line.provider.net", "1.2.3.4")).toBe(
        true
      );
      expect(looksGenericHostname("cable-modem.isp.com", "1.2.3.4")).toBe(
        true
      );
      expect(looksGenericHostname("host42.datacenter.com", "1.2.3.4")).toBe(
        true
      );
      expect(looksGenericHostname("node7.cluster.io", "1.2.3.4")).toBe(true);
    });

    it("does not flag legitimate hostnames", () => {
      expect(looksGenericHostname("mail.example.com", "1.2.3.4")).toBe(false);
      expect(looksGenericHostname("smtp.google.com", "1.2.3.4")).toBe(false);
      expect(looksGenericHostname("mx.company.org", "1.2.3.4")).toBe(false);
    });
  });
});
