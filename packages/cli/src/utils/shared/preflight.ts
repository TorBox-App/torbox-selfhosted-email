import * as clack from "@clack/prompts";
import pc from "picocolors";
import {
  type AWSResourceScan,
  checkWrapsResourcesExist,
  filterWrapsResources,
  scanAWSResources,
} from "./scanner.js";

export type PreflightResult = {
  shouldContinue: boolean;
  scan: AWSResourceScan;
};

export async function runPreflightScan(
  region: string,
  domain?: string
): Promise<PreflightResult> {
  const scan = await scanAWSResources(region);
  const filtered = filterWrapsResources(scan);
  const existing = checkWrapsResourcesExist(filtered);

  let hasConflicts = false;

  // Check for existing wraps-* resources
  const resourceTypes: string[] = [];
  if (existing.hasConfigSet) {
    resourceTypes.push("config set");
  }
  if (existing.hasSNSTopics) {
    resourceTypes.push("SNS topic");
  }
  if (existing.hasDynamoTable) {
    resourceTypes.push("DynamoDB table");
  }
  if (existing.hasLambdaFunctions) {
    resourceTypes.push("Lambda function");
  }
  if (existing.hasIAMRole) {
    resourceTypes.push("IAM role");
  }

  if (resourceTypes.length > 0) {
    hasConflicts = true;
    clack.log.warn(
      `Existing Wraps resources detected: ${resourceTypes.join(", ")}`
    );
    clack.log.info(
      `Use ${pc.cyan("wraps email upgrade")} to modify, or ${pc.cyan("wraps email doctor --cleanup")} to remove.`
    );
  }

  // Check if the user's domain already exists as an SES identity
  if (domain) {
    const domainIdentity = scan.identities.find((id) => id.name === domain);
    if (domainIdentity) {
      hasConflicts = true;
      if (domainIdentity.verified) {
        clack.log.warn(
          `Domain ${pc.cyan(domain)} already exists as a verified SES identity.`
        );
      } else {
        clack.log.warn(
          `Domain ${pc.cyan(domain)} exists as an unverified SES identity. Deployment may conflict.`
        );
      }
    }
  }

  if (hasConflicts) {
    const shouldContinue = await clack.confirm({
      message: "Continue anyway?",
      initialValue: false,
    });

    if (clack.isCancel(shouldContinue) || !shouldContinue) {
      return { shouldContinue: false, scan };
    }
  }

  return { shouldContinue: true, scan };
}
