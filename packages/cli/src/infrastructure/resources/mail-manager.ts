import {
  ArchiveState,
  CreateArchiveCommand,
  GetArchiveCommand,
  ListArchivesCommand,
  MailManagerClient,
  type RetentionPeriod,
} from "@aws-sdk/client-mailmanager";
import {
  PutConfigurationSetArchivingOptionsCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import type * as pulumi from "@pulumi/pulumi";
import type { ArchiveRetention } from "../../types/index.js";

export type MailManagerArchiveConfig = {
  name: string;
  retention: ArchiveRetention;
  configSetName: pulumi.Output<string>;
  region: string;
  kmsKeyArn?: string;
};

export type MailManagerArchiveResources = {
  archiveId: string;
  archiveArn: string;
  kmsKeyArn?: string;
};

function retentionToAWSPeriod(retention: ArchiveRetention): RetentionPeriod {
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
      return "PERMANENT";
    default:
      return "THREE_MONTHS";
  }
}

/**
 * Create Mail Manager archive for storing full email content.
 *
 * Reuses any existing ACTIVE archive matching the wraps-{name}-archive[-N] pattern.
 * Archives in PENDING_DELETION are skipped — a new name with an incrementing suffix
 * is tried until creation succeeds (up to MAX_NAME_ATTEMPTS).
 *
 * Cost: $2/GB ingestion + $0.19/GB/month storage
 * See: https://docs.aws.amazon.com/ses/latest/dg/eb-archiving.html
 */
export async function createMailManagerArchive(
  config: MailManagerArchiveConfig
): Promise<MailManagerArchiveResources> {
  const region = config.region;
  const baseArchiveName = `wraps-${config.name}-archive`;
  const namePattern = new RegExp(`^${baseArchiveName}(-\\d+)?$`);
  const MAX_NAME_ATTEMPTS = 10;

  const mailManagerClient = new MailManagerClient({ region });
  const sesClient = new SESv2Client({ region });
  const kmsKeyArn = config.kmsKeyArn;
  const awsRetention = retentionToAWSPeriod(config.retention);

  let archiveId: string | undefined;
  let archiveArn: string | undefined;

  // 1. Look for an existing ACTIVE archive matching our naming pattern.
  //    Skip any in PENDING_DELETION — they can't be reused and will block
  //    creating a new archive with the same name.
  try {
    const listResult = await mailManagerClient.send(
      new ListArchivesCommand({})
    );
    const existing = listResult.Archives?.find(
      (a) =>
        a.ArchiveState === ArchiveState.ACTIVE &&
        a.ArchiveName !== undefined &&
        namePattern.test(a.ArchiveName)
    );

    if (existing?.ArchiveId) {
      archiveId = existing.ArchiveId;
      const getResult = await mailManagerClient.send(
        new GetArchiveCommand({ ArchiveId: archiveId })
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
          new CreateArchiveCommand({
            ArchiveName: archiveName,
            Retention: { RetentionPeriod: awsRetention },
            ...(kmsKeyArn && { KmsKeyArn: kmsKeyArn }),
            Tags: [
              { Key: "ManagedBy", Value: "wraps-cli" },
              { Key: "Name", Value: archiveName },
              { Key: "Retention", Value: config.retention },
            ],
          })
        );

        archiveId = result.ArchiveId;
        if (!archiveId) {
          throw new Error(
            "Failed to create Mail Manager Archive: No ArchiveId returned"
          );
        }

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

  // 3. Resolve the ARN if creation didn't return one.
  if (!archiveArn) {
    const identity = await import("@aws-sdk/client-sts").then((m) =>
      new m.STSClient({ region }).send(new m.GetCallerIdentityCommand({}))
    );
    archiveArn = `arn:aws:ses:${region}:${identity.Account}:mailmanager-archive/${archiveId}`;
  }

  // 4. Link archive to SES Configuration Set.
  const configSetName = await new Promise<string>((resolve) => {
    config.configSetName.apply((name) => resolve(name));
  });

  if (!configSetName) {
    throw new Error(
      "Failed to resolve SES configuration set name from Pulumi output"
    );
  }

  try {
    await sesClient.send(
      new PutConfigurationSetArchivingOptionsCommand({
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

  if (!(archiveId && archiveArn)) {
    throw new Error("Failed to get archive ID or ARN");
  }

  return { archiveId, archiveArn, kmsKeyArn };
}
