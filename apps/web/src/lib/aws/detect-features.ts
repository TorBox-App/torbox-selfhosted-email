/**
 * Detect enabled features from CloudFormation stack outputs
 *
 * The wraps-email-infrastructure.yaml template outputs a JSON "Features"
 * field that indicates which features are enabled.
 */

export type DetectedFeatures = {
  domain?: string;
  eventTracking: boolean;
  historyStorage: boolean;
  archiving: boolean;
  smtp: boolean;
  tlsRequired: boolean;
  reputationMetrics: boolean;
  // Resource ARNs/names
  tableName?: string;
  queueUrl?: string;
  dlqUrl?: string;
  archiveArn?: string;
  lambdaArn?: string;
  configSetName?: string;
};

/**
 * Parse CloudFormation stack outputs into a structured features object
 */
export function detectFeaturesFromOutputs(
  outputs: Record<string, string>
): DetectedFeatures {
  // Try to parse the Features JSON output
  let featuresJson: Record<string, unknown> = {};
  if (outputs.Features) {
    try {
      featuresJson = JSON.parse(outputs.Features);
    } catch {
      // Fallback to individual outputs
    }
  }

  // Helper to parse boolean values
  const parseBool = (value: unknown): boolean => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return false;
  };

  return {
    // From Features JSON
    domain: (featuresJson.domain as string) || outputs.Domain || undefined,
    eventTracking:
      parseBool(featuresJson.eventTracking) ||
      parseBool(outputs.EnableEventTracking),
    historyStorage:
      parseBool(featuresJson.historyStorage) ||
      parseBool(outputs.EnableHistoryStorage),
    archiving:
      parseBool(featuresJson.archiving) || parseBool(outputs.EnableArchiving),
    smtp: parseBool(featuresJson.smtp) || parseBool(outputs.EnableSMTP),
    tlsRequired:
      parseBool(featuresJson.tlsRequired) || parseBool(outputs.TLSRequired),
    reputationMetrics:
      parseBool(featuresJson.reputationMetrics) ||
      parseBool(outputs.ReputationMetrics),

    // Resource ARNs/names
    tableName: outputs.TableName,
    queueUrl: outputs.QueueUrl,
    dlqUrl: outputs.DLQUrl,
    archiveArn: outputs.ArchiveArn,
    lambdaArn: outputs.LambdaArn,
    configSetName: outputs.ConfigSetName,
  };
}

/**
 * Get stack outputs from AWS CloudFormation
 */
export async function getStackOutputs(
  stackName: string,
  region: string,
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  }
): Promise<Record<string, string>> {
  const { CloudFormationClient, DescribeStacksCommand } = await import(
    "@aws-sdk/client-cloudformation"
  );

  const client = new CloudFormationClient({
    region,
    credentials,
  });

  const response = await client.send(
    new DescribeStacksCommand({
      StackName: stackName,
    })
  );

  const stack = response.Stacks?.[0];
  if (!stack) {
    throw new Error(`Stack ${stackName} not found`);
  }

  // Convert outputs array to record
  const outputs: Record<string, string> = {};
  for (const output of stack.Outputs ?? []) {
    if (output.OutputKey && output.OutputValue) {
      outputs[output.OutputKey] = output.OutputValue;
    }
  }

  return outputs;
}

/**
 * CloudFormation Output type for type safety
 */
type StackOutput = {
  OutputKey?: string;
  OutputValue?: string;
};

/**
 * Find wraps-email-infrastructure stack by role ARN
 * Searches for stacks that output the given role ARN
 */
export async function findInfrastructureStack(
  roleArn: string,
  region: string,
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  }
): Promise<{ stackName: string; outputs: Record<string, string> } | null> {
  const { CloudFormationClient, ListStacksCommand, DescribeStacksCommand } =
    await import("@aws-sdk/client-cloudformation");

  const client = new CloudFormationClient({
    region,
    credentials,
  });

  // List all active stacks
  const listResponse = await client.send(
    new ListStacksCommand({
      StackStatusFilter: [
        "CREATE_COMPLETE",
        "UPDATE_COMPLETE",
        "ROLLBACK_COMPLETE",
        "UPDATE_ROLLBACK_COMPLETE",
      ],
    })
  );

  // Check known stack names first
  const knownStackNames = [
    "wraps-email-infrastructure",
    "wraps-email",
    "WrapsEmail",
  ];

  for (const stackName of knownStackNames) {
    try {
      const response = await client.send(
        new DescribeStacksCommand({
          StackName: stackName,
        })
      );

      const stack = response.Stacks?.[0];
      if (stack?.Outputs) {
        const roleOutput = (stack.Outputs as StackOutput[]).find(
          (o: StackOutput) =>
            o.OutputKey === "RoleArn" && o.OutputValue === roleArn
        );
        if (roleOutput) {
          const outputs: Record<string, string> = {};
          for (const output of stack.Outputs as StackOutput[]) {
            if (output.OutputKey && output.OutputValue) {
              outputs[output.OutputKey] = output.OutputValue;
            }
          }
          return { stackName, outputs };
        }
      }
    } catch {
      // Stack doesn't exist, continue
    }
  }

  // Search through other stacks
  for (const summary of listResponse.StackSummaries ?? []) {
    if (!summary.StackName || knownStackNames.includes(summary.StackName)) {
      continue;
    }

    try {
      const response = await client.send(
        new DescribeStacksCommand({
          StackName: summary.StackName,
        })
      );

      const stack = response.Stacks?.[0];
      if (stack?.Outputs) {
        const roleOutput = (stack.Outputs as StackOutput[]).find(
          (o: StackOutput) =>
            o.OutputKey === "RoleArn" && o.OutputValue === roleArn
        );
        if (roleOutput) {
          const outputs: Record<string, string> = {};
          for (const output of stack.Outputs as StackOutput[]) {
            if (output.OutputKey && output.OutputValue) {
              outputs[output.OutputKey] = output.OutputValue;
            }
          }
          return { stackName: summary.StackName, outputs };
        }
      }
    } catch {
      // Skip stacks we can't describe
    }
  }

  return null;
}
