/**
 * Name created by the selfhost stack and account-global (not per-region), so
 * its existence proves some selfhost deployment is already present even when
 * local state is missing — deploys run from CI runners and other machines.
 */
const SHARED_SCHEDULER_ROLE = "wraps-selfhost-scheduler-role";

/**
 * Probe AWS for scheduler resources left by an earlier selfhost deploy.
 *
 * `sst deploy` dies partway through with EntityAlreadyExists when the
 * account-global scheduler IAM role already exists, so callers use this to
 * fail fast with an actionable message instead. Best-effort: returns false
 * when nothing is found or the probe isn't permitted.
 */
export async function hasExistingSelfhostResources(
  region: string
): Promise<boolean> {
  try {
    const { IAMClient, GetRoleCommand } = await import("@aws-sdk/client-iam");
    const iam = new IAMClient({ region });
    await iam.send(new GetRoleCommand({ RoleName: SHARED_SCHEDULER_ROLE }));
    return true;
    // baseline:allow-next-line no-swallowed-errors — probe is best-effort
  } catch {
    return false;
  }
}
