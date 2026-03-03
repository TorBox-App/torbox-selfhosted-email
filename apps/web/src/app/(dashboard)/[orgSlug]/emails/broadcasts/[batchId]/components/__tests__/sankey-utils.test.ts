import { describe, expect, it } from "vitest";
import { buildSankeyData, truncateUrl } from "../sankey-utils";

describe("buildSankeyData", () => {
  it("returns correct nodes and links for email batch", () => {
    const result = buildSankeyData({
      channel: "email",
      sent: 12_450,
      delivered: 12_380,
      opened: 4952,
      clicked: 1238,
      failed: 50,
      bounced: 20,
      complained: 2,
      hardBounced: 12,
      softBounced: 8,
    });

    // Nodes: Sent, Delivered, Hard Bounce, Soft Bounce, Failed,
    //        Opened, Not Opened, Complained, Clicked, No Click
    const nodeNames = result.nodes.map((n) => n.name);
    expect(nodeNames).toContain("Sent");
    expect(nodeNames).toContain("Delivered");
    expect(nodeNames).toContain("Hard Bounce");
    expect(nodeNames).toContain("Soft Bounce");
    expect(nodeNames).toContain("Failed");
    expect(nodeNames).toContain("Opened");
    expect(nodeNames).toContain("Not Opened");
    expect(nodeNames).toContain("Complained");
    expect(nodeNames).toContain("Clicked");
    expect(nodeNames).toContain("No Click");

    // Links from Sent
    const sentLinks = result.links.filter(
      (l) => result.nodes[l.source as number]!.name === "Sent"
    );
    expect(sentLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 12_380 }), // → Delivered
        expect.objectContaining({ value: 12 }), // → Hard Bounce
        expect.objectContaining({ value: 8 }), // → Soft Bounce
        expect.objectContaining({ value: 50 }), // → Failed
      ])
    );

    // Links from Delivered
    const deliveredIdx = result.nodes.findIndex((n) => n.name === "Delivered");
    const deliveredLinks = result.links.filter(
      (l) => (l.source as number) === deliveredIdx
    );
    expect(deliveredLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 4952 }), // → Opened
        expect.objectContaining({ value: 2 }), // → Complained
      ])
    );
    // Not Opened = delivered - opened - complained
    const notOpenedLink = deliveredLinks.find(
      (l) => result.nodes[l.target as number]!.name === "Not Opened"
    );
    expect(notOpenedLink!.value).toBe(12_380 - 4952 - 2);

    // Links from Opened
    const openedIdx = result.nodes.findIndex((n) => n.name === "Opened");
    const openedLinks = result.links.filter(
      (l) => (l.source as number) === openedIdx
    );
    expect(openedLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 1238 }), // → Clicked
        expect.objectContaining({ value: 4952 - 1238 }), // → No Click
      ])
    );
  });

  it("returns only 2 columns for SMS (no opened/clicked)", () => {
    const result = buildSankeyData({
      channel: "sms",
      sent: 5000,
      delivered: 4800,
      opened: 0,
      clicked: 0,
      failed: 100,
      bounced: 50,
      complained: 0,
      hardBounced: 30,
      softBounced: 20,
    });

    const nodeNames = result.nodes.map((n) => n.name);
    expect(nodeNames).toContain("Sent");
    expect(nodeNames).toContain("Delivered");
    expect(nodeNames).not.toContain("Opened");
    expect(nodeNames).not.toContain("Clicked");
  });

  it("handles zero sent gracefully", () => {
    const result = buildSankeyData({
      channel: "email",
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      bounced: 0,
      complained: 0,
      hardBounced: 0,
      softBounced: 0,
    });

    expect(result.nodes.length).toBeGreaterThan(0);
    // No links with value > 0
    expect(result.links.every((l) => l.value === 0)).toBe(true);
  });

  it("omits zero-value links", () => {
    const result = buildSankeyData({
      channel: "email",
      sent: 1000,
      delivered: 1000,
      opened: 500,
      clicked: 100,
      failed: 0,
      bounced: 0,
      complained: 0,
      hardBounced: 0,
      softBounced: 0,
    });

    // No link should have value 0
    for (const link of result.links) {
      expect(link.value).toBeGreaterThan(0);
    }
    // No Hard Bounce / Soft Bounce / Failed / Complained nodes
    const nodeNames = result.nodes.map((n) => n.name);
    expect(nodeNames).not.toContain("Hard Bounce");
    expect(nodeNames).not.toContain("Soft Bounce");
    expect(nodeNames).not.toContain("Failed");
    expect(nodeNames).not.toContain("Complained");
  });

  it("creates per-URL nodes when clicksByUrl is provided", () => {
    const result = buildSankeyData({
      channel: "email",
      sent: 10_000,
      delivered: 9900,
      opened: 5000,
      clicked: 1200,
      failed: 50,
      bounced: 50,
      complained: 0,
      hardBounced: 30,
      softBounced: 20,
      clicksByUrl: [
        { url: "https://example.com/pricing", count: 500 },
        { url: "https://example.com/docs", count: 350 },
        { url: "https://example.com/blog/post-1", count: 200 },
        { url: "https://other.com/signup", count: 100 },
        { url: "https://third.com/", count: 50 },
      ],
    });

    const nodeNames = result.nodes.map((n) => n.name);

    // Should have per-URL nodes instead of "Clicked"
    expect(nodeNames).not.toContain("Clicked");
    expect(nodeNames).toContain("example.com/pricing");
    expect(nodeNames).toContain("example.com/docs");
    expect(nodeNames).toContain("example.com/blog/post-1");
    expect(nodeNames).toContain("other.com/signup");
    expect(nodeNames).toContain("third.com");
    expect(nodeNames).toContain("No Click");

    // Check link values from Opened
    const openedIdx = result.nodes.findIndex((n) => n.name === "Opened");
    const openedLinks = result.links.filter(
      (l) => (l.source as number) === openedIdx
    );

    const linkMap = new Map(
      openedLinks.map((l) => [result.nodes[l.target as number]!.name, l.value])
    );
    expect(linkMap.get("example.com/pricing")).toBe(500);
    expect(linkMap.get("example.com/docs")).toBe(350);
    expect(linkMap.get("No Click")).toBe(5000 - 1200);
  });

  it("groups URLs beyond top 5 into 'Other URLs'", () => {
    const result = buildSankeyData({
      channel: "email",
      sent: 10_000,
      delivered: 9900,
      opened: 5000,
      clicked: 1500,
      failed: 50,
      bounced: 50,
      complained: 0,
      hardBounced: 30,
      softBounced: 20,
      clicksByUrl: [
        { url: "https://a.com/1", count: 400 },
        { url: "https://b.com/2", count: 300 },
        { url: "https://c.com/3", count: 250 },
        { url: "https://d.com/4", count: 200 },
        { url: "https://e.com/5", count: 150 },
        { url: "https://f.com/6", count: 100 },
        { url: "https://g.com/7", count: 50 },
        { url: "https://h.com/8", count: 50 },
      ],
    });

    const nodeNames = result.nodes.map((n) => n.name);

    // Top 5 shown individually
    expect(nodeNames).toContain("a.com/1");
    expect(nodeNames).toContain("e.com/5");
    // 6+ grouped
    expect(nodeNames).not.toContain("f.com/6");
    expect(nodeNames).toContain("Other URLs");

    // Other URLs = 100 + 50 + 50 = 200
    const openedIdx = result.nodes.findIndex((n) => n.name === "Opened");
    const otherLink = result.links.find(
      (l) =>
        (l.source as number) === openedIdx &&
        result.nodes[l.target as number]!.name === "Other URLs"
    );
    expect(otherLink!.value).toBe(200);
  });

  it("falls back to aggregate Clicked when clicksByUrl is empty", () => {
    const result = buildSankeyData({
      channel: "email",
      sent: 1000,
      delivered: 1000,
      opened: 500,
      clicked: 100,
      failed: 0,
      bounced: 0,
      complained: 0,
      hardBounced: 0,
      softBounced: 0,
      clicksByUrl: [],
    });

    const nodeNames = result.nodes.map((n) => n.name);
    expect(nodeNames).toContain("Clicked");
    expect(nodeNames).not.toContain("Other URLs");
  });
});

describe("truncateUrl", () => {
  it("strips protocol and trailing slash", () => {
    expect(truncateUrl("https://example.com/")).toBe("example.com");
  });

  it("keeps path but strips query params", () => {
    expect(truncateUrl("https://example.com/pricing?ref=email")).toBe(
      "example.com/pricing"
    );
  });

  it("handles invalid URLs gracefully", () => {
    expect(truncateUrl("not-a-url")).toBe("not-a-url");
  });

  it("truncates long non-URL strings", () => {
    const long = "a".repeat(50);
    expect(truncateUrl(long).length).toBeLessThanOrEqual(40);
  });
});
