import { DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
  DetachRolePolicyCommand,
  IAMClient,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand,
} from "@aws-sdk/client-iam";
import { DeleteFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { DeleteConfigurationSetCommand, SESClient } from "@aws-sdk/client-ses";
import { DeleteTopicCommand, SNSClient } from "@aws-sdk/client-sns";
import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { findConnectionsWithService } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import {
  type AWSResourceScan,
  filterWrapsResources,
  scanAWSResources,
} from "../../utils/shared/scanner.js";

export type EmailDoctorOptions = {
  region?: string;
  json?: boolean;
  cleanup?: boolean;
};

type DoctorResult = {
  status: "pass" | "warn" | "fail" | "info";
  category: string;
  name: string;
  details?: string;
};

function runResourceDiagnostics(
  wrapsResources: AWSResourceScan,
  hasStack: boolean
): DoctorResult[] {
  const results: DoctorResult[] = [];

  // When no Pulumi stack exists, all wraps-* resources are orphaned
  const orphanSuffix = hasStack ? undefined : " (orphan — no Pulumi state)";
  const orphanStatus = hasStack ? "pass" : "warn";

  for (const cs of wrapsResources.configurationSets) {
    results.push({
      status: orphanStatus,
      category: "SES Config Set",
      name: cs.name,
      details:
        orphanSuffix || `${cs.eventDestinations.length} event destination(s)`,
    });
  }

  for (const topic of wrapsResources.snsTopics) {
    results.push({
      status: orphanStatus,
      category: "SNS Topic",
      name: topic.name,
      details: orphanSuffix,
    });
  }

  for (const table of wrapsResources.dynamoTables) {
    const baseStatus = table.status === "ACTIVE" ? orphanStatus : "warn";
    results.push({
      status: baseStatus,
      category: "DynamoDB Table",
      name: table.name,
      details: orphanSuffix || `Status: ${table.status}`,
    });
  }

  for (const fn of wrapsResources.lambdaFunctions) {
    results.push({
      status: orphanStatus,
      category: "Lambda Function",
      name: fn.name,
      details: orphanSuffix || fn.runtime,
    });
  }

  for (const role of wrapsResources.iamRoles) {
    results.push({
      status: orphanStatus,
      category: "IAM Role",
      name: role.name,
      details: orphanSuffix,
    });
  }

  return results;
}

function displayDoctorResults(results: DoctorResult[]): void {
  console.log();

  if (results.length === 0) {
    console.log(`  ${pc.dim("No wraps-* resources found")}`);
    console.log();
    return;
  }

  for (const result of results) {
    let icon: string;
    let color: (s: string) => string;

    switch (result.status) {
      case "pass":
        icon = "\u2713";
        color = pc.green;
        break;
      case "warn":
        icon = "!";
        color = pc.yellow;
        break;
      case "fail":
        icon = "\u2717";
        color = pc.red;
        break;
      case "info":
        icon = "i";
        color = pc.blue;
        break;
    }

    console.log(
      `  ${color(`[${icon}]`)} ${pc.dim(result.category)}: ${result.name}`
    );
    if (result.details) {
      console.log(`      ${pc.dim(result.details)}`);
    }
  }

  console.log();
}

export async function emailDoctor(options: EmailDoctorOptions): Promise<void> {
  const startTime = Date.now();

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps Email Doctor"));
  }

  const progress = new DeploymentProgress();

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region — auto-detect from metadata when not explicitly provided
  let region = options.region || (await getAWSRegion());

  if (
    !(
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION
    )
  ) {
    const emailConnections = await findConnectionsWithService(
      identity.accountId,
      "email"
    );

    if (emailConnections.length === 1) {
      region = emailConnections[0].region;
    } else if (emailConnections.length > 1 && !isJsonMode()) {
      const selectedRegion = await clack.select({
        message: "Multiple email deployments found. Which region?",
        options: emailConnections.map((conn) => ({
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

  // 3. Scan AWS resources
  const scan = await progress.execute("Scanning AWS resources", async () =>
    scanAWSResources(region)
  );

  // 4. Filter to wraps-* resources
  const wrapsResources = filterWrapsResources(scan);

  const totalResources =
    wrapsResources.configurationSets.length +
    wrapsResources.snsTopics.length +
    wrapsResources.dynamoTables.length +
    wrapsResources.lambdaFunctions.length +
    wrapsResources.iamRoles.length;

  // 5. Try to load Pulumi stack to detect orphaned resources
  let hasStack = false;
  try {
    await ensurePulumiWorkDir({ accountId: identity.accountId, region });
    await pulumi.automation.LocalWorkspace.selectStack({
      stackName: `wraps-${identity.accountId}-${region}`,
      workDir: getPulumiWorkDir(),
    });
    hasStack = true;
    // baseline:allow-next-line no-swallowed-errors — stack may not exist, Pulumi may not be installed
  } catch (_error) {
    // Any failure (stack not found, Pulumi not installed, missing project file,
    // S3 backend issues) means we can't confirm stack state — treat resources as
    // potentially orphaned. Doctor is a diagnostic tool and must not fail here.
    hasStack = false;
  }

  progress.stop();

  // 6. Run diagnostics
  const results = runResourceDiagnostics(wrapsResources, hasStack);

  if (isJsonMode()) {
    jsonSuccess("email.doctor", {
      region,
      accountId: identity.accountId,
      resources: results.map((r) => ({
        category: r.category,
        name: r.name,
        status: r.status,
        details: r.details,
      })),
      totalResources,
    });
    return;
  }

  // 6. Display results
  if (totalResources === 0) {
    clack.log.info("No wraps-* resources found in this region.");
    clack.outro(pc.dim("Your AWS account is clean."));
  } else {
    clack.log.info(
      `Found ${pc.bold(String(totalResources))} wraps-* resource(s) in ${pc.cyan(region)}`
    );
    displayDoctorResults(results);

    const failCount = results.filter((r) => r.status === "fail").length;
    const warnCount = results.filter((r) => r.status === "warn").length;

    if (failCount > 0) {
      clack.log.error(
        `${failCount} issue(s) found. Run ${pc.cyan("wraps email doctor --cleanup")} to fix.`
      );
    } else if (warnCount > 0) {
      clack.log.warn(`${warnCount} warning(s)`);
    } else {
      clack.log.success("All resources look healthy!");
    }

    // 8. Cleanup orphaned resources if requested
    if (options.cleanup) {
      if (hasStack) {
        clack.log.warn(
          `A Pulumi stack exists for this region. Use ${pc.cyan("wraps email destroy")} to remove managed resources, or ${pc.cyan("wraps email upgrade")} to reconcile.`
        );
      } else {
        const orphanCount = results.filter((r) =>
          r.details?.includes("orphan")
        ).length;

        if (orphanCount > 0) {
          const confirmed = await clack.confirm({
            message: `Delete ${orphanCount} orphaned wraps-* resource(s)?`,
          });

          if (!clack.isCancel(confirmed) && confirmed) {
            await cleanupOrphanedResources(wrapsResources, region);
          }
        }
      }
    }

    clack.outro(pc.dim("Done"));
  }

  trackCommand("email:doctor", {
    success: true,
    duration_ms: Date.now() - startTime,
    resource_count: totalResources,
    region,
  });
}

async function cleanupOrphanedResources(
  resources: AWSResourceScan,
  region: string
): Promise<void> {
  const ses = new SESClient({ region });
  const sns = new SNSClient({ region });
  const dynamo = new DynamoDBClient({ region });
  const lambda = new LambdaClient({ region });
  const iam = new IAMClient({ region });

  for (const cs of resources.configurationSets) {
    try {
      await ses.send(
        new DeleteConfigurationSetCommand({ ConfigurationSetName: cs.name })
      );
      clack.log.success(`Deleted config set: ${cs.name}`);
    } catch (error) {
      clack.log.error(
        `Failed to delete config set ${cs.name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  for (const topic of resources.snsTopics) {
    try {
      await sns.send(new DeleteTopicCommand({ TopicArn: topic.arn }));
      clack.log.success(`Deleted SNS topic: ${topic.name}`);
    } catch (error) {
      clack.log.error(
        `Failed to delete SNS topic ${topic.name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  for (const table of resources.dynamoTables) {
    try {
      await dynamo.send(new DeleteTableCommand({ TableName: table.name }));
      clack.log.success(`Deleted DynamoDB table: ${table.name}`);
    } catch (error) {
      clack.log.error(
        `Failed to delete DynamoDB table ${table.name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  for (const fn of resources.lambdaFunctions) {
    try {
      await lambda.send(new DeleteFunctionCommand({ FunctionName: fn.name }));
      clack.log.success(`Deleted Lambda function: ${fn.name}`);
    } catch (error) {
      clack.log.error(
        `Failed to delete Lambda function ${fn.name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  // Delete IAM roles (must remove all policies first)
  for (const role of resources.iamRoles) {
    try {
      // Delete inline policies
      const inlineResp = await iam.send(
        new ListRolePoliciesCommand({ RoleName: role.name })
      );
      for (const policyName of inlineResp.PolicyNames || []) {
        await iam.send(
          new DeleteRolePolicyCommand({
            RoleName: role.name,
            PolicyName: policyName,
          })
        );
      }

      // Detach managed policies
      const attachedResp = await iam.send(
        new ListAttachedRolePoliciesCommand({ RoleName: role.name })
      );
      for (const policy of attachedResp.AttachedPolicies || []) {
        await iam.send(
          new DetachRolePolicyCommand({
            RoleName: role.name,
            PolicyArn: policy.PolicyArn!,
          })
        );
      }

      await iam.send(new DeleteRoleCommand({ RoleName: role.name }));
      clack.log.success(`Deleted IAM role: ${role.name}`);
    } catch (error) {
      clack.log.error(
        `Failed to delete IAM role ${role.name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }
}
