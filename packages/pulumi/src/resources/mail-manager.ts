// Type-only import — erased at runtime, safe for Pulumi closure serialization.
import type { RetentionPeriod } from "@aws-sdk/client-mailmanager";
import * as pulumi from "@pulumi/pulumi";
import type { ArchiveRetention, ResolvedConfig } from "../types.js";

/**
 * Mail Manager archive result
 *
 * Cost: $2/GB ingestion + $0.19/GB/month storage
 * See: https://docs.aws.amazon.com/ses/latest/dg/eb-archiving.html
 */
export type MailManagerResult = {
  /** The archive ARN */
  archiveArn: pulumi.Output<string | undefined>;
  /** Whether archiving is enabled */
  enabled: pulumi.Output<boolean>;
};

/**
 * Convert our retention types to AWS SDK RetentionPeriod enum
 */
export function retentionToAWSPeriod(
  retention: ArchiveRetention
): RetentionPeriod {
  switch (retention) {
    case "3months":
      return "THREE_MONTHS";
    case "6months":
      return "SIX_MONTHS";
    case "9months":
      return "NINE_MONTHS";
    case "1year":
      return "ONE_YEAR";
    case "18months":
      return "EIGHTEEN_MONTHS";
    case "2years":
      return "TWO_YEARS";
    case "30months":
      return "THIRTY_MONTHS";
    case "3years":
      return "THREE_YEARS";
    case "4years":
      return "FOUR_YEARS";
    case "5years":
      return "FIVE_YEARS";
    case "6years":
      return "SIX_YEARS";
    case "7years":
      return "SEVEN_YEARS";
    case "8years":
      return "EIGHT_YEARS";
    case "9years":
      return "NINE_YEARS";
    case "10years":
      return "TEN_YEARS";
    case "permanent":
    case "indefinite":
      return "PERMANENT";
    default:
      return "THREE_MONTHS";
  }
}

const MAX_NAME_ATTEMPTS = 10;

// Fixed AWS archive name. Like every other resource in this package
// (`wraps-email-role`, `wraps-email-tracking`, …) the archive uses the fixed
// `wraps-email-` service prefix — NOT the component's logical name — so it
// matches the CLI (`email-stack.ts` passes `name: "email"`) and the shared
// deployment-verification harness (`tests/deployment/verify.sh`).
const ARCHIVE_NAME = "wraps-email-archive";

// ============================================
// DYNAMIC PROVIDER TYPES
// ============================================

type MailManagerArchiveInputs = {
  retention: string;
  configSetName: string;
  region: string;
  tags: Record<string, string>;
};

type MailManagerArchiveOutputs = MailManagerArchiveInputs & {
  archiveId: string;
  archiveArn: string;
};

// ============================================
// DYNAMIC PROVIDER
// ============================================

/**
 * Pulumi dynamic provider for Mail Manager archives.
 *
 * Exported so unit tests can call provider methods directly.
 *
 * IMPORTANT: All AWS SDK imports live INSIDE each method body to avoid
 * Pulumi closure-serialization errors. Do NOT move them to module scope.
 */
export const mailManagerArchiveProvider: pulumi.dynamic.ResourceProvider = {
  async create(
    inputs: MailManagerArchiveInputs
  ): Promise<pulumi.dynamic.CreateResult> {
    const { region, retention, configSetName, tags } = inputs;
    const baseArchiveName = ARCHIVE_NAME;
    const namePattern = new RegExp(`^${baseArchiveName}(-\\d+)?$`);

    // Dynamic import required — module-scope imports break Pulumi serialization.
    const mm = await import("@aws-sdk/client-mailmanager");
    const mailManagerClient = new mm.MailManagerClient({ region });
    const awsRetention = retentionToAWSPeriod(retention as ArchiveRetention);

    let archiveId: string | undefined;
    let archiveArn: string | undefined;

    // 1. Look for an existing ACTIVE archive matching our naming pattern.
    //    Skip any in PENDING_DELETION — they can't be reused and will block
    //    creating a new archive with the same name.
    try {
      const listResult = await mailManagerClient.send(
        new mm.ListArchivesCommand({})
      );
      const existing = listResult.Archives?.find(
        (a) =>
          a.ArchiveState === mm.ArchiveState.ACTIVE &&
          a.ArchiveName !== undefined &&
          namePattern.test(a.ArchiveName)
      );

      if (existing?.ArchiveId) {
        archiveId = existing.ArchiveId;
        const getResult = await mailManagerClient.send(
          new mm.GetArchiveCommand({ ArchiveId: archiveId })
        );
        archiveArn = getResult.ArchiveArn;
      }
    } catch (error) {
      // An empty result set does NOT throw — ListArchives returns no Archives —
      // so any error here is a real failure (throttling, AccessDenied, network).
      // Surface it rather than silently falling through to create, which could
      // create a duplicate archive when an ACTIVE one already exists.
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to list existing Mail Manager archives in ${region}: ${detail}`
      );
    }

    // 2. Create a new archive if no active one was found.
    //    On ConflictException (name blocked by a PENDING_DELETION archive),
    //    retry with an incrementing suffix: -2, -3, …
    if (!archiveId) {
      for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
        const archiveName =
          attempt === 1 ? baseArchiveName : `${baseArchiveName}-${attempt}`;

        try {
          const result = await mailManagerClient.send(
            new mm.CreateArchiveCommand({
              ArchiveName: archiveName,
              Retention: { RetentionPeriod: awsRetention },
              Tags: [
                // Spread base tags (includes ManagedBy: "wraps-pulumi")
                ...Object.entries(tags)
                  .filter(([k]) => k !== "Name" && k !== "Retention")
                  .map(([Key, Value]) => ({ Key, Value })),
                // Archive-specific tags
                { Key: "Name", Value: archiveName },
                { Key: "Retention", Value: retention },
              ],
            })
          );

          archiveId = result.ArchiveId;
          if (!archiveId) {
            throw new Error(
              "Mail Manager archive creation returned no ArchiveId"
            );
          }

          // CreateArchive only returns ArchiveId; use GetArchive to resolve the ARN.
          const getResult = await mailManagerClient.send(
            new mm.GetArchiveCommand({ ArchiveId: archiveId })
          );
          archiveArn = getResult.ArchiveArn;

          break;
        } catch (error) {
          // AWS SDK v3 sometimes reports the error name as "Error" with the
          // real exception type only in the message — check both.
          const isConflict =
            error instanceof Error &&
            (error.name === "ConflictException" ||
              error.message.includes("ConflictException"));
          if (isConflict && attempt < MAX_NAME_ATTEMPTS) {
            continue;
          }
          throw error;
        }
      }
    }

    if (!(archiveId && archiveArn)) {
      throw new Error(
        "Failed to create or locate Mail Manager archive: no ArchiveId or ArchiveArn resolved"
      );
    }

    // 3. Link archive to SES Configuration Set.
    const ses = await import("@aws-sdk/client-sesv2");
    const sesClient = new ses.SESv2Client({ region });

    try {
      await sesClient.send(
        new ses.PutConfigurationSetArchivingOptionsCommand({
          ConfigurationSetName: configSetName,
          ArchiveArn: archiveArn,
        })
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to link Mail Manager archive to SES config set '${configSetName}' in ${region}: ${detail}`
      );
    }

    const outs: MailManagerArchiveOutputs = {
      ...inputs,
      archiveId,
      archiveArn,
    };

    return { id: archiveId, outs };
  },

  async delete(_id: string, props: MailManagerArchiveOutputs): Promise<void> {
    // Non-Destructive: we do NOT call DeleteArchiveCommand.
    // Deleting a Mail Manager archive would permanently destroy customer mail history.
    // Per the Wraps Non-Destructive principle, we only de-associate the archive from
    // the SES configuration set and leave the archive intact in the customer's account.
    try {
      const ses = await import("@aws-sdk/client-sesv2");
      const sesClient = new ses.SESv2Client({ region: props.region });
      await sesClient.send(
        new ses.PutConfigurationSetArchivingOptionsCommand({
          ConfigurationSetName: props.configSetName,
          // Omitting ArchiveArn clears the archive association on the config set
        })
      );
    } catch {
      // Best-effort de-association — archive data is preserved regardless
    }
  },

  async diff(
    _id: string,
    olds: MailManagerArchiveOutputs,
    news: MailManagerArchiveInputs
  ): Promise<pulumi.dynamic.DiffResult> {
    // Retention is immutable after creation — changing it would require destroying and
    // recreating the archive, losing all archived mail in the process.
    // We surface this as a hard error rather than emitting a replacement (which would
    // trigger delete → recreate and violate the Non-Destructive principle).
    if (olds.retention !== news.retention) {
      throw new Error(
        "Mail Manager archive retention cannot be changed after creation " +
          `(current: "${olds.retention}", requested: "${news.retention}"). ` +
          "Retention is immutable to protect archived mail. " +
          "To use a different retention period, manually create a new archive."
      );
    }

    // The archive lives in the region where it was created. Changing region
    // would orphan the archived mail (and a replace would delete it), so we
    // reject it the same way as a retention change rather than silently no-op.
    if (olds.region !== news.region) {
      throw new Error(
        "Mail Manager archive region cannot be changed after creation " +
          `(current: "${olds.region}", requested: "${news.region}"). ` +
          "To archive in a different region, manually create a new archive there."
      );
    }

    const changes: string[] = [];
    if (olds.configSetName !== news.configSetName) {
      changes.push("configSetName");
    }

    return {
      changes: changes.length > 0,
      replaces: [],
      stables: ["archiveId", "archiveArn", "retention", "region"],
      deleteBeforeReplace: false,
    };
  },

  async update(
    _id: string,
    olds: MailManagerArchiveOutputs,
    news: MailManagerArchiveInputs
  ): Promise<pulumi.dynamic.UpdateResult> {
    // Only configSetName can change in-place.
    // Retention changes are rejected in diff() before update() is ever called.
    if (news.configSetName !== olds.configSetName) {
      const ses = await import("@aws-sdk/client-sesv2");
      const sesClient = new ses.SESv2Client({ region: news.region });
      await sesClient.send(
        new ses.PutConfigurationSetArchivingOptionsCommand({
          ConfigurationSetName: news.configSetName,
          ArchiveArn: olds.archiveArn,
        })
      );
    }

    return {
      outs: {
        ...news,
        archiveId: olds.archiveId,
        archiveArn: olds.archiveArn,
      },
    };
  },
};

// ============================================
// DYNAMIC RESOURCE CLASS
// ============================================

/**
 * Pulumi custom resource wrapping a Mail Manager archive.
 * Lifecycle is managed by {@link mailManagerArchiveProvider}.
 */
class MailManagerArchiveResource extends pulumi.dynamic.Resource {
  public readonly archiveId!: pulumi.Output<string>;
  public readonly archiveArn!: pulumi.Output<string>;

  constructor(
    name: string,
    props: {
      retention: pulumi.Input<string>;
      configSetName: pulumi.Input<string>;
      region: pulumi.Input<string>;
      tags: pulumi.Input<Record<string, string>>;
    },
    opts?: pulumi.CustomResourceOptions
  ) {
    super(
      mailManagerArchiveProvider,
      name,
      {
        // Output-only properties (populated by provider create/update)
        archiveId: undefined,
        archiveArn: undefined,
        ...props,
      },
      opts
    );
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Create a Mail Manager archive for storing full email content.
 *
 * Implements idempotent create-or-reuse: if an ACTIVE archive named
 * `wraps-email-archive` already exists it is reused rather than creating
 * a duplicate. On `ConflictException` (archive name blocked by one in
 * `PENDING_DELETION`) the provider retries with suffix `-2`, `-3`, … (up
 * to 10 attempts).
 *
 * Archiving is opt-in — when `config.archiving?.enabled` is false or
 * undefined this function returns disabled placeholder outputs without
 * creating any AWS resources.
 *
 * @param name - Component logical name (used only for the Pulumi resource node name; the AWS archive is always `wraps-email-archive`)
 * @param config - Resolved component configuration (reads `config.archiving`)
 * @param configSetName - SES configuration set to associate the archive with
 * @param region - AWS region
 * @param tags - Tags applied to the created archive
 * @param opts - Pulumi resource options
 */
export function createMailManagerArchive(
  name: string,
  config: ResolvedConfig,
  configSetName: pulumi.Input<string>,
  region: pulumi.Input<string>,
  tags: Record<string, string>,
  opts?: pulumi.ComponentResourceOptions
): MailManagerResult {
  const archiving = config.archiving;

  if (!archiving?.enabled) {
    return {
      archiveArn: pulumi.output(undefined),
      enabled: pulumi.output(false),
    };
  }

  const retention: ArchiveRetention = archiving.retention ?? "1year";

  const archive = new MailManagerArchiveResource(
    `${name}-mail-manager-archive`,
    {
      retention,
      configSetName,
      region,
      tags,
    },
    opts ? { parent: opts.parent } : undefined
  );

  return {
    archiveArn: archive.archiveArn,
    enabled: pulumi.output(true),
  };
}
