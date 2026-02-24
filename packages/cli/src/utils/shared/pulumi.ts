import { exec } from "node:child_process";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type {
  EngineEvent,
  PreviewResult,
  Stack,
} from "@pulumi/pulumi/automation/index.js";
import { PulumiCommand } from "@pulumi/pulumi/automation/index.js";
import { errors } from "./errors.js";
import type { ResourceChange, ResourceOperation } from "./output.js";

const execAsync = promisify(exec);

/**
 * Check if Pulumi CLI is installed
 */
export async function checkPulumiInstalled(): Promise<boolean> {
  try {
    await execAsync("pulumi version");
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Ensure Pulumi CLI is installed, auto-install if missing.
 * When auto-installed, adds the binary to PATH so LocalWorkspace can find it.
 * @returns true if Pulumi was auto-installed, false if it was already installed
 */
export async function ensurePulumiInstalled(): Promise<boolean> {
  const isInstalled = await checkPulumiInstalled();

  if (!isInstalled) {
    try {
      // Auto-install Pulumi CLI matching the SDK version
      const cmd = await PulumiCommand.install();
      // Add installed binary to PATH so LocalWorkspace.createOrSelectStack
      // (which internally calls PulumiCommand.get()) can find it
      const binDir = dirname(cmd.command);
      process.env.PATH = `${binDir}:${process.env.PATH}`;
      return true; // Was auto-installed
    } catch (_error) {
      // If auto-install fails, throw helpful error
      throw errors.pulumiNotInstalled();
    }
  }

  return false; // Was already installed
}

/**
 * Extended preview result with resource changes
 */
export type ExtendedPreviewResult = PreviewResult & {
  resourceChanges: ResourceChange[];
};

/**
 * Map Pulumi operation type to our ResourceOperation type
 */
function mapOperationType(op: string): ResourceOperation {
  switch (op) {
    case "create":
      return "create";
    case "update":
      return "update";
    case "delete":
      return "delete";
    case "replace":
    case "create-replacement":
    case "delete-replaced":
      return "replace";
    case "same":
    case "read":
      return "same";
    default:
      return "same";
  }
}

/**
 * Run preview with resource change capture
 * Captures individual resource operations via the onEvent callback
 */
export async function previewWithResourceChanges(
  stack: Stack,
  options?: { diff?: boolean }
): Promise<ExtendedPreviewResult> {
  const resourceChanges: ResourceChange[] = [];
  const seenResources = new Set<string>();

  const result = await stack.preview({
    diff: options?.diff ?? true,
    onEvent: (event: EngineEvent) => {
      // Handle resource pre-operation events
      if (event.resourcePreEvent) {
        const metadata = event.resourcePreEvent.metadata;
        if (metadata) {
          const resourceKey = `${metadata.type}::${metadata.urn}`;

          // Skip if we've already seen this resource (avoid duplicates)
          if (seenResources.has(resourceKey)) {
            return;
          }
          seenResources.add(resourceKey);

          // Skip the root stack resource
          if (metadata.type === "pulumi:pulumi:Stack") {
            return;
          }

          const operation = mapOperationType(metadata.op || "same");

          // Extract resource name from URN (last segment after ::)
          const urnParts = metadata.urn?.split("::") || [];
          const name = urnParts.at(-1) || metadata.urn || "unknown";

          // Collect property diffs for updates
          const diffs: string[] = [];
          if (metadata.diffs && metadata.diffs.length > 0) {
            for (const diff of metadata.diffs) {
              diffs.push(diff);
            }
          }

          resourceChanges.push({
            name,
            type: metadata.type || "unknown",
            operation,
            diffs: diffs.length > 0 ? diffs : undefined,
          });
        }
      }
    },
  });

  return {
    ...result,
    resourceChanges,
  };
}
