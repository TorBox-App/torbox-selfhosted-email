import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

export function createWrapsAuthClient(baseURL?: string) {
  return createAuthClient({
    baseURL: baseURL || process.env.NEXT_PUBLIC_APP_URL || "https://app.wraps.dev",
    plugins: [deviceAuthorizationClient()],
  });
}

export type WrapsAuthClient = ReturnType<typeof createWrapsAuthClient>;
