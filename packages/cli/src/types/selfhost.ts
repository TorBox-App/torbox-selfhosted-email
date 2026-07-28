export type SelfhostDeployOptions = {
  region?: string;
  databaseUrl?: string;
  neonApiKey?: string;
  neonOrgId?: string;
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

export type SelfhostEnvOptions = {
  region?: string;
  json?: boolean;
};

export type SelfhostLogsOptions = {
  region?: string;
  /** Keep streaming instead of printing one window and exiting. */
  follow?: boolean;
  /** Show only genuine error lines (server pre-filter + structured refine). */
  errors?: boolean;
  /** Restrict to one component: api, web, workers, other. Defaults to all. */
  source?: string;
  /** Lookback window, e.g. `30m`, `6h`, `2d`. Defaults to `1h`. */
  since?: string;
  /** Raw CloudWatch Logs filter pattern; takes precedence over --errors. */
  filter?: string;
  /** Poll interval in seconds while following. Defaults to 3. */
  interval?: string;
  /** Use CloudWatch Live Tail (billed per minute) instead of polling. */
  live?: boolean;
  /** Include Lambda START/END/REPORT lines, hidden by default. */
  platform?: boolean;
  /** Print the full raw log line rather than the structured message body. */
  verbose?: boolean;
  json?: boolean;
};

export type SelfhostConfig = {
  neonProjectId?: string;
  databaseUrl: string;
  licenseKey: string;
  appUrl: string;
  unsubscribeSecret: string;
  betterAuthSecret: string;
  webDomain?: string;
  aiGatewayApiKey?: string;
  sentryDsn?: string;
};

export type SelfhostDestroyOptions = {
  region?: string;
  yes?: boolean;
  force?: boolean;
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
