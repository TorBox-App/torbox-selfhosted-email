import { auth } from "@wraps/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { Logger } from "pino";
import { requireRoutePermission } from "@/app/api/shared/route-permission";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import { checkAiUsageLimit } from "@/lib/usage/ai-usage";

type OrgWithMembership = NonNullable<
  Awaited<ReturnType<typeof getOrganizationWithMembership>>
>;

export type AIRequestGate = {
  /** Permission resource, e.g. "templates" or "workflows". */
  readonly resource: Parameters<typeof requireRoutePermission>[1];
  readonly permissions: Parameters<typeof requireRoutePermission>[2];
  /** Route path, used for structured logging. */
  readonly path: string;
};

export type AIRequestResult =
  | {
      readonly ok: true;
      readonly orgSlug: string;
      readonly org: OrgWithMembership;
      readonly userId: string;
      readonly log: Logger;
    }
  | { readonly ok: false; readonly response: Response };

/**
 * The gate every AI route runs before touching a model: authenticate, confirm
 * org membership, check the route permission, then check the AI quota.
 *
 * A discriminated union rather than a `withX` wrapper — the three routes differ
 * too much in body parsing and `onFinish` bookkeeping to share a HOF, and a
 * wrapper would have to thread all of that through generics for no gain.
 *
 * Order is load-bearing: the quota check must run before the request body is
 * parsed, so an over-quota caller gets a 429 rather than a validation error.
 */
export async function resolveAIRequest(
  context: { params: Promise<{ orgSlug: string }> },
  gate: AIRequestGate
): Promise<AIRequestResult> {
  const { orgSlug } = await context.params;
  const log = createRequestLogger({
    path: gate.path,
    method: "POST",
    orgSlug,
  });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const org = await getOrganizationWithMembership(orgSlug, session.user.id);
  if (!org) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const denied = requireRoutePermission(
    org.userRole,
    gate.resource,
    gate.permissions
  );
  if (denied) {
    return { ok: false, response: denied };
  }

  const usage = await checkAiUsageLimit(org.id);
  if (!usage.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "AI message limit reached",
          message: `You've used ${usage.current} of ${usage.limit} AI messages this month. Upgrade your plan for more.`,
          limitReached: true,
          current: usage.current,
          limit: usage.limit,
        },
        { status: 429 }
      ),
    };
  }

  return { ok: true, orgSlug, org, userId: session.user.id, log };
}
