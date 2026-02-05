/**
 * Telemetry client for Wraps CLI
 * @module telemetry/client
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { isCI } from "../utils/shared/ci-detection.js";
import { readAuthConfig } from "../utils/shared/config.js";
import { TelemetryConfigManager } from "./config.js";
import type {
  TelemetryClientOptions,
  TelemetryEvent,
  TelemetryRequest,
} from "./types.js";

const DEFAULT_ENDPOINT = "https://wraps.dev/api/telemetry";
const DEFAULT_TIMEOUT = 2000; // 2 seconds

/**
 * Main telemetry client for tracking CLI usage
 *
 * Features:
 * - Non-blocking event tracking with automatic batching
 * - Respects DO_NOT_TRACK and WRAPS_TELEMETRY_DISABLED environment variables
 * - Auto-disabled in CI environments
 * - 2-second timeout with silent failure
 * - Debug mode for development
 *
 * @example
 * ```typescript
 * const client = getTelemetryClient();
 *
 * client.track('command:init', {
 *   service: 'email',
 *   success: true
 * });
 *
 * await client.shutdown(); // Flush remaining events
 * ```
 */
export class TelemetryClient {
  private readonly config: TelemetryConfigManager;
  private readonly endpoint: string;
  private readonly timeout: number;
  private readonly debug: boolean;
  private enabled: boolean;
  private eventQueue: TelemetryEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private hasShownFooter = false;
  private userId: string | undefined;
  private userIdResolved = false;

  constructor(options: TelemetryClientOptions = {}) {
    this.config = new TelemetryConfigManager();
    this.endpoint = options.endpoint || DEFAULT_ENDPOINT;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.debug = options.debug || process.env.WRAPS_TELEMETRY_DEBUG === "1";

    // Check if telemetry should be enabled
    this.enabled = this.shouldBeEnabled();

    // Kick off async auth resolution (non-blocking)
    this.resolveUserId();
  }

  /**
   * Resolve authenticated user identity from CLI auth config.
   * Uses the first organization ID as the user identifier,
   * linking CLI telemetry to the same org tracked on the web dashboard.
   */
  private async resolveUserId(): Promise<void> {
    try {
      const config = await readAuthConfig();
      if (config?.auth?.token && config.auth.organizations?.length) {
        this.userId = config.auth.organizations[0].id;
      }
    } catch {
      // Silent — don't break telemetry if auth config is unreadable
    } finally {
      this.userIdResolved = true;
    }
  }

  /**
   * Determine if telemetry should be enabled based on environment and config
   */
  private shouldBeEnabled(): boolean {
    // Check DO_NOT_TRACK first (universal standard)
    if (process.env.DO_NOT_TRACK === "1") {
      return false;
    }

    // Check Wraps-specific env var
    if (process.env.WRAPS_TELEMETRY_DISABLED === "1") {
      return false;
    }

    // Check CI environment
    if (isCI()) {
      return false;
    }

    // Check config file
    if (!this.config.isEnabled()) {
      return false;
    }

    return true;
  }

  /**
   * Track an event
   *
   * @param event - Event name in format "category:action" (e.g., "command:init")
   * @param properties - Additional event properties (no PII)
   */
  track(event: string, properties?: Record<string, unknown>): void {
    const telemetryEvent: TelemetryEvent = {
      event,
      properties: {
        ...properties,
        cli_version: this.getCLIVersion(),
        os: process.platform,
        node_version: process.version,
        ci: isCI(),
      },
      anonymousId: this.config.getAnonymousId(),
      ...(this.userId ? { userId: this.userId } : {}),
      timestamp: new Date().toISOString(),
    };

    // Debug mode: show what would be sent (even if disabled)
    if (this.debug) {
      console.log(
        "[Telemetry Debug] Event:",
        JSON.stringify(telemetryEvent, null, 2)
      );
      return;
    }

    // Check if telemetry is enabled (after debug check)
    if (!this.enabled) {
      return;
    }

    // Add to queue
    this.eventQueue.push(telemetryEvent);

    // Flush after short delay (batch events from same command)
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => this.flush(), 100);
  }

  /**
   * Flush queued events to server
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const requestBody: TelemetryRequest = {
        events: eventsToSend,
        batch: true,
      };

      await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      // Silent failure - never break user's workflow
      if (this.debug) {
        console.error("[Telemetry Debug] Failed to send events:", error);
      }
    }
  }

  /**
   * Flush and wait for all events to be sent
   * Should be called before CLI exits
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    // Wait briefly for auth resolution if still pending, so queued events get userId
    if (!this.userIdResolved) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (this.userIdResolved) return resolve();
          setTimeout(check, 10);
        };
        check();
        // Don't block more than 100ms
        setTimeout(resolve, 100);
      });
    }

    // Backfill userId on any queued events that were tracked before resolution
    if (this.userId) {
      for (const evt of this.eventQueue) {
        if (!evt.userId) {
          evt.userId = this.userId;
        }
      }
    }

    await this.flush();
  }

  /**
   * Enable telemetry
   * Note: Won't override environment variable opt-outs (DO_NOT_TRACK, CI, etc.)
   */
  enable(): void {
    this.config.setEnabled(true);

    // Check if environment variables prevent telemetry
    if (
      process.env.DO_NOT_TRACK === "1" ||
      process.env.DO_NOT_TRACK === "true"
    ) {
      this.enabled = false;
      return;
    }

    if (process.env.WRAPS_TELEMETRY_DISABLED === "1") {
      this.enabled = false;
      return;
    }

    if (isCI()) {
      this.enabled = false;
      return;
    }

    // No env restrictions, enable telemetry
    this.enabled = true;
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.config.setEnabled(false);
    this.enabled = false;
    this.eventQueue = [];
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.config.getConfigPath();
  }

  /**
   * Show first-run notification
   */
  shouldShowNotification(): boolean {
    return this.enabled && !this.config.hasShownNotification();
  }

  /**
   * Mark notification as shown
   */
  markNotificationShown(): void {
    this.config.markNotificationShown();
  }

  /**
   * Show promotional footer once per CLI session.
   * Call this after successful completion of status/list commands.
   * Returns true if footer was shown, false if already shown this session.
   */
  showFooterOnce(): boolean {
    if (this.hasShownFooter) {
      return false;
    }
    this.hasShownFooter = true;

    console.log();
    console.log(pc.dim("─────────────────────────────────────"));
    console.log("📊 Wraps Platform — analytics, templates, automations");
    console.log(`   From $10/mo → ${pc.cyan("https://wraps.dev/platform")}`);
    console.log();
    console.log(`💬 ${pc.cyan("hey@wraps.sh")}`);
    console.log(pc.dim("─────────────────────────────────────"));

    return true;
  }

  /**
   * Get CLI version from package.json
   */
  private getCLIVersion(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const pkg = JSON.parse(
        readFileSync(join(__dirname, "../package.json"), "utf-8")
      );
      return pkg.version;
    } catch {
      return "unknown";
    }
  }
}

// Singleton instance
let telemetryInstance: TelemetryClient | null = null;

/**
 * Get the singleton telemetry client instance
 *
 * @example
 * ```typescript
 * const client = getTelemetryClient();
 * client.track('command:init', { success: true });
 * ```
 */
export function getTelemetryClient(): TelemetryClient {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryClient();
  }
  return telemetryInstance;
}
