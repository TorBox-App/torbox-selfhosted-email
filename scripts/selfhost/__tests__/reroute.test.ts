import { describe, expect, it } from "vitest";
import { sesEventsWebhookUrl } from "../reroute.js";

describe("sesEventsWebhookUrl", () => {
  // The email stack appends `/webhooks/ses/{account}` itself (eventbridge.ts,
  // pulumi events, cdk email all do `webhookUrl || "https://api.wraps.dev"`
  // then concatenate). Returning a full path here produced
  // `.../v1/ses-events/webhooks/ses/{account}` — a route the API does not
  // serve, so EventBridge POSTed into a 404 and every rerouted event was
  // dropped while the deploy printed success.
  it("returns a base url, not an endpoint path", () => {
    expect(sesEventsWebhookUrl("https://api.selfhost.example.com")).toBe(
      "https://api.selfhost.example.com"
    );
  });

  it("does not append the API's own route path", () => {
    const url = sesEventsWebhookUrl("https://api.selfhost.example.com");

    expect(url).not.toContain("/v1/ses-events");
    expect(url).not.toContain("/webhooks");
  });

  it("strips a trailing slash so the appended path cannot double up", () => {
    expect(sesEventsWebhookUrl("https://api.selfhost.example.com/")).toBe(
      "https://api.selfhost.example.com"
    );
  });
});
