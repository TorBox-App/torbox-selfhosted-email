import { type ResourceName, roles } from "@wraps/auth/access";

const PERM_DENIED = {
  success: false as const,
  error: "You don't have permission to perform this action",
};

/**
 * Check whether `role` holds any of the given `actions` on `resource`.
 * Returns a `{ success: false, error }` result if denied, or `null` if allowed.
 * Callers should `return permError` when it is non-null.
 */
export function checkPermission(
  role: string,
  resource: ResourceName,
  actions: string[]
): { success: false; error: string } | null {
  const roleInstance = roles[role as keyof typeof roles];
  if (!roleInstance) return PERM_DENIED;
  // Cast through unknown to avoid union-signature incompatibility on .authorize
  type AuthorizeFn = (req: Record<string, string[]>) => { success: boolean };
  const authorize = roleInstance.authorize as unknown as AuthorizeFn;
  const result = authorize({ [resource]: actions });
  return result.success ? null : PERM_DENIED;
}
