import type { CascadeChannelConfig } from "@wraps/db";
import { describe, expect, it } from "vitest";
import { validateCascadeChannels } from "../(ee)/workflow-validation";

// ═══════════════════════════════════════════════════════════════════════════
// CASCADE CHANNEL VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("validateCascadeChannels", () => {
  const nodeId = "cascade-1";

  describe("empty channels", () => {
    it("should error when channels array is empty", () => {
      const errors = validateCascadeChannels(nodeId, []);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(
        expect.objectContaining({
          nodeId,
          field: "channels",
          message: "Cascade must have at least one channel",
          severity: "error",
        })
      );
    });
  });

  describe("email channel validation", () => {
    it("should error when email channel is missing templateId", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "email", templateId: "" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toContainEqual(
        expect.objectContaining({
          nodeId,
          field: "channels[0].templateId",
          message: "Channel 1: Email template is required",
          severity: "error",
        })
      );
    });

    it("should error when email channel templateId is undefined", () => {
      const channels: CascadeChannelConfig[] = [{ type: "email" }];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toContainEqual(
        expect.objectContaining({
          field: "channels[0].templateId",
          message: "Channel 1: Email template is required",
        })
      );
    });

    it("should error when email channel templateId is whitespace only", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "email", templateId: "   " },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toContainEqual(
        expect.objectContaining({
          field: "channels[0].templateId",
          message: "Channel 1: Email template is required",
        })
      );
    });
  });

  describe("SMS channel validation", () => {
    it("should error when SMS channel is missing both body and templateId", () => {
      const channels: CascadeChannelConfig[] = [{ type: "sms" }];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toContainEqual(
        expect.objectContaining({
          nodeId,
          field: "channels[0].body",
          message: "Channel 1: SMS message or template is required",
          severity: "error",
        })
      );
    });

    it("should pass when SMS channel has body", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "sms", body: "Hello there!" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      // No SMS body/template error expected
      const smsBodyErrors = errors.filter((e) =>
        e.message.includes("SMS message or template")
      );
      expect(smsBodyErrors).toHaveLength(0);
    });

    it("should pass when SMS channel has templateId", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "sms", templateId: "sms-template-1" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      const smsBodyErrors = errors.filter((e) =>
        e.message.includes("SMS message or template")
      );
      expect(smsBodyErrors).toHaveLength(0);
    });
  });

  describe("waitDuration validation for non-final channels", () => {
    it("should error when non-final channel is missing waitDuration", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "email", templateId: "t-1" },
        { type: "sms", body: "Fallback SMS" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toContainEqual(
        expect.objectContaining({
          nodeId,
          field: "channels[0].waitDuration",
          message:
            "Channel 1: Wait duration is required for non-final channels",
          severity: "error",
        })
      );
    });

    it("should error when non-final channel has waitDuration of 0", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "email", templateId: "t-1", waitDuration: 0 },
        { type: "sms", body: "Fallback SMS" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toContainEqual(
        expect.objectContaining({
          field: "channels[0].waitDuration",
          message:
            "Channel 1: Wait duration is required for non-final channels",
        })
      );
    });

    it("should error when non-final channel has negative waitDuration", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "email", templateId: "t-1", waitDuration: -10 },
        { type: "sms", body: "Fallback SMS" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toContainEqual(
        expect.objectContaining({
          field: "channels[0].waitDuration",
          message:
            "Channel 1: Wait duration is required for non-final channels",
        })
      );
    });

    // The waitDuration check only applies to email channels, not SMS channels.
    // SMS channels are not expected to have engagement-based wait logic.
    it("should NOT flag non-final SMS channel for missing waitDuration", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "sms", body: "First SMS" },
        { type: "email", templateId: "t-1" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      const waitErrors = errors.filter((e) =>
        e.field?.includes("waitDuration")
      );
      expect(waitErrors).toHaveLength(0);
    });

    it("should not require waitDuration on final channel", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "email", templateId: "t-1", waitDuration: 3600 },
        { type: "sms", body: "Fallback SMS" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      // The final channel (index 1) should not have a waitDuration error
      const finalWaitErrors = errors.filter(
        (e) => e.field === "channels[1].waitDuration"
      );
      expect(finalWaitErrors).toHaveLength(0);
    });
  });

  describe("valid cascade configurations", () => {
    it("should pass for a valid 2-channel cascade (email + sms)", () => {
      const channels: CascadeChannelConfig[] = [
        {
          type: "email",
          templateId: "welcome-email",
          engagement: "opened",
          waitDuration: 86_400,
        },
        { type: "sms", body: "Hey, check your email!" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toHaveLength(0);
    });

    it("should pass for a valid single-channel cascade", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "email", templateId: "solo-email" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toHaveLength(0);
    });

    it("should pass for a valid single SMS channel cascade", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "sms", body: "Hi there!" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toHaveLength(0);
    });

    it("should pass for a valid 3-channel cascade", () => {
      const channels: CascadeChannelConfig[] = [
        {
          type: "email",
          templateId: "first-email",
          engagement: "opened",
          waitDuration: 3600,
        },
        {
          type: "email",
          templateId: "reminder-email",
          engagement: "clicked",
          waitDuration: 7200,
        },
        { type: "sms", body: "Last resort SMS" },
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      expect(errors).toHaveLength(0);
    });
  });

  describe("multiple errors in one cascade", () => {
    it("should report errors on multiple channels", () => {
      const channels: CascadeChannelConfig[] = [
        { type: "email", templateId: "" }, // missing templateId + missing waitDuration
        { type: "sms" }, // missing body/template (final, so no waitDuration error)
      ];

      const errors = validateCascadeChannels(nodeId, channels);

      // Should have: email templateId error, waitDuration error, SMS body error
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: "channels[0].templateId",
        })
      );
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: "channels[0].waitDuration",
        })
      );
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: "channels[1].body",
        })
      );
      expect(errors).toHaveLength(3);
    });
  });
});
