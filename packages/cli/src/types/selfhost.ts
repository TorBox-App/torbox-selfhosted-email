export type SelfhostDeployOptions = {
  region?: string;
  neonApiKey?: string;
  licenseKey?: string;
  appUrl?: string;
  yes?: boolean;
  preview?: boolean;
  json?: boolean;
};

export type SelfhostUpgradeOptions = {
  region?: string;
  yes?: boolean;
  preview?: boolean;
  json?: boolean;
};

export type SelfhostStatusOptions = {
  region?: string;
  json?: boolean;
};

export type SelfhostConfig = {
  neonProjectId: string;
  databaseUrl: string;
  licenseKey: string;
  appUrl: string;
  unsubscribeSecret: string;
  betterAuthSecret: string;
};

export type SelfhostStackConfig = {
  accountId: string;
  region: string;
  lambdaZipPath: string;
  databaseUrl: string;
  licenseKey: string;
  appUrl: string;
  unsubscribeSecret: string;
  betterAuthSecret: string;
};

export type SelfhostStackOutputs = {
  apiUrl: string;
  lambdaArn: string;
  lambdaRoleArn: string;
  rateLimitTableName: string;
  batchQueueUrl: string;
  batchQueueArn: string;
  workflowQueueUrl: string;
  workflowQueueArn: string;
  schedulerRoleArn: string;
  schedulerGroupName: string;
};
