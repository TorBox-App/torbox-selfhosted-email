export function register() {
  // No-op for initialization
}

export const onRequestError = async (
  err: Error,
  request: { path: string; method: string; headers: Headers },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    revalidateReason?: string;
  }
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPostHogClient } = await import("./src/lib/posthog-server");
    const posthog = getPostHogClient();

    let distinctId: string | undefined;

    // Extract distinct_id from PostHog cookie
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      // PostHog cookie format: ph_phc_..._posthog
      const postHogCookieMatch = cookieHeader.match(/ph_phc_[^=]+=([^;]+)/);
      if (postHogCookieMatch?.[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
          const postHogData = JSON.parse(decodedCookie);
          distinctId = postHogData.distinct_id;
        } catch {
          // Ignore cookie parsing errors
        }
      }
    }

    posthog.captureException(err, distinctId, {
      $exception_source: "nextjs_server",
      route_path: context.routePath,
      route_type: context.routeType,
      router_kind: context.routerKind,
      request_path: request.path,
      request_method: request.method,
    });

    // Flush immediately since Lambda/serverless may terminate after this
    await posthog.flush();
  }
};
