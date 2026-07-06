import type { ResourceName } from "@wraps/auth/access";
import { NextResponse } from "next/server";
import { checkPermission } from "@/actions/shared/permissions";

/**
 * Returns a 403 NextResponse if `role` lacks `actions` on `resource`,
 * or null if allowed. Callers: `const denied = requireRoutePermission(...);
 * if (denied) return denied;`
 */
export function requireRoutePermission(
  role: string,
  resource: ResourceName,
  actions: string[]
): NextResponse | null {
  const permError = checkPermission(role, resource, actions);
  if (permError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
