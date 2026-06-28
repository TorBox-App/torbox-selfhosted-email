import * as pulumi from "@pulumi/pulumi";
import { WrapsEmail } from "@wraps.dev/pulumi";

const config = new pulumi.Config();
const domain = config.require("domain");
const enableEvents = config.getBoolean("events") ?? false;
const enableSmtp = config.getBoolean("smtp") ?? false;
const enableArchiving = config.getBoolean("archiving") ?? false;
const webhookSecret = config.get("webhookSecret");
const webhookAccountId = config.get("webhookAccountId");

const email = new WrapsEmail("test", {
  domain,
  events: enableEvents
    ? {
        storeHistory: true,
        retention: "90days",
      }
    : undefined,
  smtp: enableSmtp ? { enabled: true } : undefined,
  archiving: enableArchiving ? { enabled: true } : undefined,
  webhook:
    webhookSecret && webhookAccountId
      ? {
          awsAccountNumber: webhookAccountId,
          webhookSecret,
        }
      : undefined,
});

export const roleArn = email.roleArn;
export const configSetName = email.configSetName;
export const tableName = email.tableName;
export const queueUrl = email.queueUrl;
export const smtpEndpoint = email.smtpEndpoint;
export const archiveArn = email.archiveArn;
