import * as fs from "node:fs";
import * as path from "node:path";
import { WrapsEmail } from "@wraps.dev/cdk";
import * as cdk from "aws-cdk-lib";

type TestConfig = {
  domain: string;
  events?: {
    storeHistory?: boolean;
    retention?: string;
  };
  smtp?: {
    enabled?: boolean;
  };
  webhook?: {
    awsAccountNumber: string;
    webhookSecret: string;
    webhookUrl?: string;
  };
};

const configPath = path.join(__dirname, "..", "config.json");
const config: TestConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const app = new cdk.App();
const stack = new cdk.Stack(app, "WrapsDeploymentTest", {
  env: {
    region: process.env.WRAPS_TEST_REGION || "us-east-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

new WrapsEmail(stack, "Email", {
  domain: config.domain,
  events: config.events,
  smtp: config.smtp,
  webhook: config.webhook,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
