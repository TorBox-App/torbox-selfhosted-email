import { describe, expect, it } from "vitest";
import {
  orgAutomation,
  orgAutomations,
  orgBroadcast,
  orgBroadcasts,
  orgSegments,
  orgSettings,
  orgTopics,
} from "../routes";

describe("route builders", () => {
  it("orgSettings returns org settings path", () => {
    expect(orgSettings("my-co")).toBe("/my-co/settings");
  });

  it("orgBroadcasts returns org broadcasts path", () => {
    expect(orgBroadcasts("my-co")).toBe("/my-co/emails/broadcasts");
  });

  it("orgBroadcast returns specific broadcast path", () => {
    expect(orgBroadcast("my-co", "batch-1")).toBe(
      "/my-co/emails/broadcasts/batch-1"
    );
  });

  it("orgSegments returns org segments path", () => {
    expect(orgSegments("my-co")).toBe("/my-co/segments");
  });

  it("orgTopics returns org topics path", () => {
    expect(orgTopics("my-co")).toBe("/my-co/topics");
  });

  it("orgAutomations returns org automations path", () => {
    expect(orgAutomations("my-co")).toBe("/my-co/automations");
  });

  it("orgAutomation returns specific automation path", () => {
    expect(orgAutomation("my-co", "wf-1")).toBe("/my-co/automations/wf-1");
  });
});
