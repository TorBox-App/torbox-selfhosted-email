import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Plan 182 (round 2): the pure-function tests in
 * `infrastructure/resources/__tests__/ses.test.ts` only proved the default
 * (`resolveMatchingEventTypes(undefined)`) is byte-identical to the old
 * hardcoded ten-type array. They did NOT catch that `PRODUCTION_PRESET` and
 * `promptCustomConfig()` both built their own eight-type literal (dropping
 * `DELIVERY_DELAY`/`SUBSCRIPTION`) — dead code before this plan, since
 * `matchingEventTypes` was hardcoded regardless, but live and
 * behavior-changing the moment `config.eventTypes` started being read.
 *
 * This file iterates every real config-producing path — every preset from
 * `getPreset()`, and the default output of `promptCustomConfig()` — through
 * the same `resolveMatchingEventTypes`/`validateEventTypes` functions the
 * deploy path uses, so a reintroduced eight-type literal anywhere fails a
 * test instead of shipping as a silent regression.
 */

vi.mock("@clack/prompts", () => {
  const confirm = vi.fn(
    async ({ initialValue }: { initialValue?: boolean }) => initialValue ?? true
  );
  const select = vi.fn(
    async ({ initialValue }: { initialValue?: string }) => initialValue
  );
  const multiselect = vi.fn(
    async ({ initialValues }: { initialValues?: string[] }) =>
      initialValues ?? []
  );
  const text = vi.fn(
    async ({ initialValue }: { initialValue?: string }) => initialValue ?? ""
  );
  const isCancel = vi.fn(() => false);
  const cancel = vi.fn();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { confirm, select, multiselect, text, isCancel, cancel, log };
});

import { ALL_EVENT_TYPES } from "@wraps/core";
import {
  resolveMatchingEventTypes,
  validateEventTypes,
} from "../../../infrastructure/resources/ses.js";
import { promptCustomConfig } from "../../shared/prompts.js";
import { getPreset } from "../presets.js";

describe("every real config path resolves to all ten event types by default", () => {
  // promptCustomConfig() below is the real implementation (only
  // @clack/prompts is mocked), and it's now guarded by ensureInteractive —
  // simulate an interactive TTY so the guard is a no-op here, matching
  // pre-guard behavior.
  beforeEach(() => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    delete process.env.CI;
  });

  afterEach(() => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
  });

  const presetNames = ["starter", "production", "enterprise"] as const;

  it.each(presetNames)("preset %s", (presetName) => {
    const config = getPreset(presetName);
    expect(config).not.toBeNull();

    if (!config?.eventTracking?.enabled) {
      // starter ships eventTracking.enabled: false — it never reaches
      // matchingEventTypes at all, so there's nothing to resolve.
      expect(config?.eventTracking?.enabled).toBe(false);
      return;
    }

    const resolved = resolveMatchingEventTypes(config.eventTracking.events);
    expect(resolved).toEqual(ALL_EVENT_TYPES);
    expect(() =>
      validateEventTypes(config.eventTracking?.events)
    ).not.toThrow();
  });

  it("promptCustomConfig() defaults to all ten when event tracking is enabled", async () => {
    const config = await promptCustomConfig();

    expect(config.eventTracking.enabled).toBe(true);
    const resolved = resolveMatchingEventTypes(config.eventTracking.events);
    expect(resolved).toEqual(ALL_EVENT_TYPES);
    expect(() => validateEventTypes(config.eventTracking.events)).not.toThrow();
  });
});
