import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

function shouldDisableTracking(): boolean {
  if (process.env.VITEST === "true") return true;
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.CI === "true") return true;
  if (process.env.POSTHOG_DISABLED === "true") return true;
  return false;
}

const noopClient = {
  capture: () => {},
  captureException: () => {},
  identify: () => {},
  flush: async () => {},
  shutdown: async () => {},
} as unknown as PostHog;

export function getPostHogClient(): PostHog {
  if (shouldDisableTracking()) return noopClient;

  if (!posthogClient) {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) return noopClient;

    posthogClient = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
