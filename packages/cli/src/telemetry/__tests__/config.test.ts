/**
 * Tests for telemetry configuration manager
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TelemetryConfigManager } from "../config";

describe("TelemetryConfigManager", () => {
  let config: TelemetryConfigManager;
  let tempDir: string;

  beforeEach(() => {
    // Create isolated temp directory for each test
    tempDir = mkdtempSync(join(tmpdir(), "wraps-telemetry-test-"));
    config = new TelemetryConfigManager({ cwd: tempDir });
  });

  afterEach(() => {
    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("default configuration", () => {
    it("should be enabled by default", () => {
      expect(config.isEnabled()).toBe(true);
    });

    it("should have a valid UUID as anonymousId", () => {
      const id = config.getAnonymousId();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it("should not have shown notification by default", () => {
      expect(config.hasShownNotification()).toBe(false);
    });
  });

  describe("enable/disable", () => {
    it("should disable telemetry", () => {
      config.setEnabled(false);
      expect(config.isEnabled()).toBe(false);
    });

    it("should re-enable telemetry", () => {
      config.setEnabled(false);
      config.setEnabled(true);
      expect(config.isEnabled()).toBe(true);
    });
  });

  describe("notification tracking", () => {
    it("should mark notification as shown", () => {
      expect(config.hasShownNotification()).toBe(false);
      config.markNotificationShown();
      expect(config.hasShownNotification()).toBe(true);
    });

    it("should persist notification status", () => {
      config.markNotificationShown();

      // Create new instance to test persistence (same temp dir)
      const newConfig = new TelemetryConfigManager({ cwd: tempDir });
      expect(newConfig.hasShownNotification()).toBe(true);
    });
  });

  describe("anonymousId", () => {
    it("should persist anonymousId across instances", () => {
      const id = config.getAnonymousId();

      // Create new instance (same temp dir)
      const newConfig = new TelemetryConfigManager({ cwd: tempDir });
      expect(newConfig.getAnonymousId()).toBe(id);
    });

    it("should generate new anonymousId after reset", () => {
      const oldId = config.getAnonymousId();
      config.reset();
      const newId = config.getAnonymousId();

      expect(newId).not.toBe(oldId);
    });
  });

  describe("config path", () => {
    it("should return a valid file path", () => {
      const path = config.getConfigPath();
      expect(path).toContain("wraps");
      expect(path).toContain("telemetry");
    });
  });

  describe("reset", () => {
    it("should reset all configuration to defaults", () => {
      config.setEnabled(false);
      config.markNotificationShown();
      const oldId = config.getAnonymousId();

      config.reset();

      expect(config.isEnabled()).toBe(true);
      expect(config.hasShownNotification()).toBe(false);
      expect(config.getAnonymousId()).not.toBe(oldId);
    });
  });
});
