import { describe, expect, it } from "vitest";
import { isBotOpen, isOpenEventBot } from "../email-bot-detection";

describe("isBotOpen", () => {
  describe("empty/missing user agents", () => {
    it("returns true for undefined", () => {
      expect(isBotOpen(undefined)).toBe(true);
    });

    it("returns true for null", () => {
      expect(isBotOpen(null)).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(isBotOpen("")).toBe(true);
    });

    it("returns true for whitespace-only string", () => {
      expect(isBotOpen("   ")).toBe(true);
    });
  });

  describe("known security scanner user agents", () => {
    it.each([
      ["Barracuda/5.0", "Barracuda"],
      ["Mozilla/5.0 (compatible; Mimecast/1.0)", "Mimecast"],
      ["Mozilla/5.0 Proofpoint URL Defense", "Proofpoint"],
      ["FireEye Email Security", "FireEye"],
      ["Symantec Email Security.cloud", "Symantec"],
      ["FortiGuard/1.0", "Fortinet"],
      ["Sophos Email Appliance", "Sophos"],
      ["TrendMicro Email Reputation", "TrendMicro"],
      ["MessageLabs/1.0", "MessageLabs"],
      ["IronPort/1.0", "IronPort"],
      ["Cisco Email Security Appliance", "Cisco Email"],
      ["Forcepoint Email Security", "Forcepoint"],
    ])("returns true for %s (%s)", (ua) => {
      expect(isBotOpen(ua)).toBe(true);
    });
  });

  describe("generic bot patterns", () => {
    it.each([
      ["Googlebot/2.1", "bot keyword"],
      ["Mozilla/5.0 (compatible; crawler)", "crawler keyword"],
      ["Spider/1.0", "spider keyword"],
      ["URLScanner/1.0", "scanner keyword"],
      ["link-prefetch/1.0", "prefetch keyword"],
      ["EmailPreview/1.0", "preview keyword"],
      ["wget/1.21", "wget"],
      ["curl/7.88.0", "curl"],
      ["python-requests/2.28.0", "python-requests"],
      ["Java/17.0.1", "Java client"],
      ["Go-http-client/1.1", "Go HTTP client"],
      ["node-fetch/3.0", "node-fetch"],
    ])("returns true for %s (%s)", (ua) => {
      expect(isBotOpen(ua)).toBe(true);
    });
  });

  describe("legitimate browser user agents", () => {
    it.each([
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Chrome on Windows",
      ],
      [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Safari on macOS",
      ],
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
        "Firefox on Windows",
      ],
      [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Safari on iPhone",
      ],
      [
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Chrome on Android",
      ],
      ["Microsoft Outlook 16.0", "Microsoft Outlook desktop"],
      [
        "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)",
        "Gmail image proxy (real Gmail open)",
      ],
      [
        "YahooMailProxy; https://help.yahoo.com/kb/yahoo-mail-proxy-SLN28749.html",
        "Yahoo mail proxy (real Yahoo open)",
      ],
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        "Edge on Windows",
      ],
    ])("returns false for %s (%s)", (ua) => {
      expect(isBotOpen(ua)).toBe(false);
    });
  });
});

describe("isOpenEventBot", () => {
  it("returns true when additionalData contains a bot user agent", () => {
    const additionalData = JSON.stringify({
      timestamp: "2026-03-09T12:00:00Z",
      userAgent: "Barracuda/5.0",
      ipAddress: "1.2.3.4",
    });
    expect(isOpenEventBot(additionalData)).toBe(true);
  });

  it("returns false when additionalData contains a real browser user agent", () => {
    const additionalData = JSON.stringify({
      timestamp: "2026-03-09T12:00:00Z",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ipAddress: "1.2.3.4",
    });
    expect(isOpenEventBot(additionalData)).toBe(false);
  });

  it("returns false when additionalData is undefined", () => {
    expect(isOpenEventBot(undefined)).toBe(false);
  });

  it("returns false when additionalData is invalid JSON", () => {
    expect(isOpenEventBot("not json")).toBe(false);
  });

  it("returns true when additionalData has no userAgent field", () => {
    const additionalData = JSON.stringify({
      timestamp: "2026-03-09T12:00:00Z",
    });
    expect(isOpenEventBot(additionalData)).toBe(true);
  });
});
