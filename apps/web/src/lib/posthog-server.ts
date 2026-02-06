import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

/**
 * Check if we're in a test or CI environment where tracking should be disabled
 */
function shouldDisableTracking(): boolean {
  // Vitest sets this
  if (process.env.VITEST === "true") {
    return true;
  }

  // Jest sets this
  if (process.env.JEST_WORKER_ID !== undefined) {
    return true;
  }

  // General test environment
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  // CI environments (GitHub Actions, etc.)
  if (process.env.CI === "true") {
    return true;
  }

  // Explicit opt-out
  if (process.env.POSTHOG_DISABLED === "true") {
    return true;
  }

  return false;
}

/**
 * No-op PostHog client that implements the same interface but does nothing.
 * Used in test/CI environments to prevent polluting analytics.
 */
const noopClient = {
  capture: () => {},
  captureException: () => {},
  identify: () => {},
  flush: async () => {},
  shutdown: async () => {},
} as unknown as PostHog;

export function getPostHogClient(): PostHog {
  // Return no-op client for test/CI environments
  if (shouldDisableTracking()) {
    return noopClient;
  }

  if (!posthogClient) {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) {
      // No API key configured - return no-op to avoid errors
      return noopClient;
    }

    posthogClient = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
