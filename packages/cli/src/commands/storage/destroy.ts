import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { trackError, trackServiceRemoved } from "../../telemetry/events.js";
import { findHostedZone } from "../../utils/route53.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import { errors } from "../../utils/shared/errors.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import {
  findConnectionsWithService,
  loadConnectionMetadata,
  removeServiceFromConnection,
  saveConnectionMetadata,
} from "../../utils/shared/metadata.js";
import {
  DeploymentProgress,
  displayPreview,
} from "../../utils/shared/output.js";
import { previewWithResourceChanges } from "../../utils/shared/pulumi.js";

/**
 * Storage destroy command options
 */
export type StorageDestroyOptions = {
  region?: string;
  force?: boolean;
  preview?: boolean;
};

/**
 * Storage Destroy command - Remove storage infrastructure
 */
export async function storageDestroy(options: StorageDestroyOptions): Promise<void> {
  const startTime = Date.now();

  clack.intro(
    pc.bold(
      options.preview
        ? "Storage Infrastructure Destruction Preview"
        : "Storage Infrastructure Teardown"
    )
  );

  const progress = new DeploymentProgress();

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region - check flag, then env, then metadata, then default
  let region = options.region || (await getAWSRegion());

  // If using default region (us-east-1), check if we have metadata for other regions
  if (
    !(
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION
    )
  ) {
    const storageConnections = await findConnectionsWithService(
      identity.accountId,
      "storage"
    );

    if (storageConnections.length === 1) {
      region = storageConnections[0].region;
    } else if (storageConnections.length > 1) {
      const selectedRegion = await clack.select({
        message: "Multiple storage deployments found. Which region to destroy?",
        options: storageConnections.map((conn) => ({
          value: conn.region,
          label: conn.region,
        })),
      });

      if (clack.isCancel(selectedRegion)) {
        clack.cancel("Operation cancelled");
        process.exit(0);
      }

      region = selectedRegion as string;
    }
  }

  // 3. Load connection metadata to get custom domain and stack name
  const metadata = await loadConnectionMetadata(identity.accountId, region);
  const storageService = metadata?.services?.storage;
  const storageConfig = storageService?.config;
  const customDomain = storageConfig?.cdn?.customDomain;
  const storedStackName = storageService?.pulumiStackName;

  // 4. Confirm destruction (skip if --force or --preview)
  if (!(options.force || options.preview)) {
    clack.log.warn(
      pc.yellow("This will delete your S3 bucket and all files in it!")
    );

    const confirmed = await clack.confirm({
      message: pc.red(
        "Are you sure you want to destroy all storage infrastructure?"
      ),
      initialValue: false,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Destruction cancelled.");
      process.exit(0);
    }
  }

  // 5. Check for Route53 hosted zone and offer to clean up DNS
  let shouldCleanDNS = false;
  let hostedZone: { id: string; name: string } | null = null;

  if (customDomain && !options.preview) {
    hostedZone = await findHostedZone(customDomain, region);

    if (hostedZone) {
      if (options.force) {
        shouldCleanDNS = true; // Auto-clean with --force
      } else {
        const cleanDNS = await clack.confirm({
          message: `Found Route53 hosted zone for ${pc.cyan(customDomain)}. Delete DNS records?`,
          initialValue: true,
        });

        if (clack.isCancel(cleanDNS)) {
          clack.cancel("Destruction cancelled.");
          process.exit(0);
        }

        shouldCleanDNS = cleanDNS;
      }
    }
  }

  // 6. Preview or Destroy infrastructure using Pulumi
  if (options.preview) {
    // PREVIEW MODE - show what would be destroyed without actually destroying
    try {
      const previewResult = await progress.execute(
        "Generating destruction preview",
        async () => {
          await ensurePulumiWorkDir();

          // Use stored stack name from metadata, fallback to generated name
          const stackName =
            storedStackName || `wraps-storage-${identity.accountId}-${region}`;

          // Try to select the stack
          let stack;
          try {
            stack = await pulumi.automation.LocalWorkspace.selectStack({
              stackName,
              workDir: getPulumiWorkDir(),
            });
          } catch (_error) {
            throw new Error("No storage infrastructure found to preview");
          }

          // Run preview with resource change capture
          const result = await previewWithResourceChanges(stack, {
            diff: true,
          });
          return result;
        }
      );

      // Display preview results with detailed resource changes
      displayPreview({
        changeSummary: previewResult.changeSummary,
        resourceChanges: previewResult.resourceChanges,
        costEstimate: "Monthly cost after destruction: $0.00",
        commandName: "wraps storage destroy",
      });

      // Show DNS cleanup info
      if (customDomain) {
        const previewHostedZone = await findHostedZone(customDomain, region);
        if (previewHostedZone) {
          clack.log.info(
            `DNS records in Route53 for ${pc.cyan(customDomain)} will also be deleted`
          );
        }
      }

      clack.outro(
        pc.green("Preview complete. Run without --preview to destroy.")
      );

      // Track preview completion
      trackServiceRemoved("storage", {
        preview: true,
        region,
        duration_ms: Date.now() - startTime,
      });
      return;
    } catch (error: any) {
      progress.stop();
      if (error.message.includes("No storage infrastructure found")) {
        clack.log.warn("No storage infrastructure found to preview");
        process.exit(0);
      }
      trackError("PREVIEW_FAILED", "storage destroy", { step: "preview" });
      throw new Error(`Preview failed: ${error.message}`);
    }
  }

  // DESTROY MODE - actually remove infrastructure

  // 7. Clean up DNS records first
  if (shouldCleanDNS && hostedZone && customDomain) {
    try {
      await progress.execute(
        `Deleting DNS records for ${customDomain}`,
        async () => {
          await deleteStorageDNSRecords(hostedZone!.id, customDomain);
        }
      );
    } catch (error: any) {
      clack.log.warn(`Could not delete DNS records: ${error.message}`);
      clack.log.info("You may need to delete them manually from Route53");
    }
  }

  // 8. Empty the S3 bucket first (required before deletion)
  const bucketName = `wraps-storage-${identity.accountId}`;
  try {
    await progress.execute(
      "Emptying S3 bucket (this may take a while for large buckets)",
      async () => {
        await emptyS3Bucket(bucketName, region);
      }
    );
  } catch (error: any) {
    // Bucket might not exist or already be empty
    clack.log.info(`Note: ${error.message}`);
  }

  // 9. Destroy Pulumi infrastructure
  try {
    await progress.execute(
      "Destroying storage infrastructure (this may take 2-3 minutes)",
      async () => {
        await ensurePulumiWorkDir();

        // Use stored stack name from metadata, fallback to generated name
        const stackName =
          storedStackName || `wraps-storage-${identity.accountId}-${region}`;

        // Try to select the stack
        let stack;
        try {
          stack = await pulumi.automation.LocalWorkspace.selectStack({
            stackName,
            workDir: getPulumiWorkDir(),
          });
        } catch (_error) {
          throw new Error("No storage infrastructure found to destroy");
        }

        // Run destroy
        await stack.destroy({ onOutput: () => {} });

        // Remove the stack from workspace
        await stack.workspace.removeStack(stackName);
      }
    );
  } catch (error: any) {
    progress.stop();
    if (error.message.includes("No storage infrastructure found")) {
      clack.log.warn("No storage infrastructure found");
      // Still update metadata if it exists
      if (metadata) {
        removeServiceFromConnection(metadata, "storage");
        await saveConnectionMetadata(metadata);
      }
      process.exit(0);
    }
    // Check if it's a lock file error
    if (error.message?.includes("stack is currently locked")) {
      trackError("STACK_LOCKED", "storage destroy", { step: "destroy" });
      throw errors.stackLocked();
    }
    trackError("DESTROY_FAILED", "storage destroy", { step: "destroy" });
    clack.log.error("Storage infrastructure destruction failed");
    throw error;
  }

  // 10. Update connection metadata (remove storage service)
  if (metadata) {
    removeServiceFromConnection(metadata, "storage");
    // Save or delete based on remaining services
    const hasOtherServices =
      Object.keys(metadata.services).length > 0;
    if (hasOtherServices) {
      await saveConnectionMetadata(metadata);
    } else {
      // Delete the entire metadata file if no services remain
      const { deleteConnectionMetadata } = await import(
        "../../utils/shared/metadata.js"
      );
      await deleteConnectionMetadata(identity.accountId, region);
    }
  }

  // 11. Display success message
  progress.stop();

  const deletedItems = ["S3 bucket and all files", "CloudFront distribution"];
  if (shouldCleanDNS && hostedZone) {
    deletedItems.push("Route53 DNS records");
  }

  clack.outro(pc.green("Storage infrastructure has been removed"));

  console.log(`\n${pc.bold("Cleaned up:")}`);
  for (const item of deletedItems) {
    console.log(`  ${pc.green("OK")} ${item}`);
  }

  console.log(
    `\nRun ${pc.cyan("wraps storage init")} to deploy storage infrastructure again.\n`
  );

  // 12. Track successful destruction
  trackServiceRemoved("storage", {
    reason: "user_initiated",
    region,
    duration_ms: Date.now() - startTime,
    dns_cleaned: shouldCleanDNS,
  });
}

/**
 * Empty all objects from an S3 bucket
 */
async function emptyS3Bucket(bucketName: string, region: string): Promise<void> {
  const {
    S3Client,
    ListObjectVersionsCommand,
    DeleteObjectsCommand,
  } = await import("@aws-sdk/client-s3");

  const s3 = new S3Client({ region });

  // List and delete all object versions (handles versioned buckets)
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  do {
    const listResponse = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: bucketName,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      })
    );

    const objectsToDelete = [
      ...(listResponse.Versions || []),
      ...(listResponse.DeleteMarkers || []),
    ].map((obj) => ({
      Key: obj.Key!,
      VersionId: obj.VersionId,
    }));

    if (objectsToDelete.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: objectsToDelete },
        })
      );
    }

    keyMarker = listResponse.NextKeyMarker;
    versionIdMarker = listResponse.NextVersionIdMarker;
  } while (keyMarker);
}

/**
 * Delete DNS records for storage custom domain
 */
async function deleteStorageDNSRecords(
  hostedZoneId: string,
  customDomain: string
): Promise<void> {
  const {
    Route53Client,
    ListResourceRecordSetsCommand,
    ChangeResourceRecordSetsCommand,
  } = await import("@aws-sdk/client-route-53");

  const route53 = new Route53Client({ region: "us-east-1" });

  // List all records that match the custom domain
  const listResponse = await route53.send(
    new ListResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
    })
  );

  const recordsToDelete = (listResponse.ResourceRecordSets || []).filter(
    (record) => {
      const name = record.Name?.replace(/\.$/, "");
      // Match the custom domain and any ACM validation records
      return (
        name === customDomain ||
        (name?.includes("_") && name?.includes(customDomain))
      );
    }
  );

  if (recordsToDelete.length === 0) {
    return;
  }

  const changes = recordsToDelete.map((record) => ({
    Action: "DELETE" as const,
    ResourceRecordSet: record,
  }));

  await route53.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: { Changes: changes },
    })
  );
}
