import { SELFHOST_API_FUNCTION_NAME } from "./api-url.js";

/**
 * Which selfhost implementation deployed into an account.
 *
 * - `pulumi` — `wraps selfhost deploy` (API-only control plane, Pulumi stack)
 * - `sst`    — `pnpm selfhost:deploy` from a fork (full platform, SST)
 *
 * The two cannot coexist: both create the account-global IAM role
 * `wraps-selfhost-scheduler-role` and the `wraps-selfhost-schedulers`
 * schedule group, so a second deploy of the other variant fails partway
 * through with EntityAlreadyExists.
 */
export type SelfhostVariant = "sst" | "pulumi";

/**
 * Name shared by BOTH selfhost stacks — its existence proves some selfhost
 * deployment is present even when local metadata is missing (deploys run on
 * other machines / CI runners).
 */
const SHARED_SCHEDULER_ROLE = "wraps-selfhost-scheduler-role";

/**
 * Probe AWS for an existing selfhost deployment and report which variant
 * owns it. Best-effort: returns null when nothing is found or the probes
 * aren't permitted.
 *
 * Order matters: the Pulumi Lambda (`wraps-selfhost-api`) is unique to the
 * Pulumi stack, while the scheduler role is created by both — so the role
 * only implies SST when the Pulumi Lambda is absent.
 */
export async function detectSelfhostVariant(
  region: string
): Promise<SelfhostVariant | null> {
  try {
    const { LambdaClient, GetFunctionCommand } = await import(
      "@aws-sdk/client-lambda"
    );
    const lambda = new LambdaClient({ region });
    await lambda.send(
      new GetFunctionCommand({ FunctionName: SELFHOST_API_FUNCTION_NAME })
    );
    return "pulumi";
    // baseline:allow-next-line no-swallowed-errors — probe is best-effort
  } catch {
    // fall through to the SST probe
  }

  try {
    const { IAMClient, GetRoleCommand } = await import("@aws-sdk/client-iam");
    const iam = new IAMClient({ region });
    await iam.send(new GetRoleCommand({ RoleName: SHARED_SCHEDULER_ROLE }));
    return "sst";
    // baseline:allow-next-line no-swallowed-errors — probe is best-effort
  } catch {
    return null;
  }
}
