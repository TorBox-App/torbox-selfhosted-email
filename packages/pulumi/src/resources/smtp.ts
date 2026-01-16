import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { convertToSMTPPassword, getSMTPEndpoint } from "@wraps/core";

/**
 * SMTP credentials result
 */
export type SMTPResult = {
  iamUser: aws.iam.User;
  accessKey: aws.iam.AccessKey;
  smtpUsername: pulumi.Output<string>;
  smtpPassword: pulumi.Output<string>;
  smtpEndpoint: pulumi.Output<string>;
};

/**
 * Create SMTP credentials for legacy systems.
 *
 * Creates an IAM user with ses:SendRawEmail permission scoped to the
 * specified SES configuration set, along with access keys that are
 * converted to SMTP credentials.
 *
 * IMPORTANT: The SMTP password is shown once and cannot be retrieved later.
 * Store it securely!
 */
export function createSMTPCredentials(
  name: string,
  configSetName: pulumi.Input<string>,
  region: pulumi.Output<string>,
  tags: Record<string, string>,
  opts?: pulumi.ComponentResourceOptions
): SMTPResult {
  // Create IAM user for SMTP authentication
  const iamUser = new aws.iam.User(
    `${name}-smtp-user`,
    {
      name: "wraps-email-smtp-user",
      tags: {
        ...tags,
        Purpose: "SES SMTP Authentication",
      },
    },
    opts
  );

  // Attach SES send policy scoped to configuration set
  new aws.iam.UserPolicy(
    `${name}-smtp-policy`,
    {
      user: iamUser.name,
      policy: pulumi.output(configSetName).apply((csName) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: "ses:SendRawEmail",
              Resource: "*",
              Condition: {
                StringEquals: {
                  "ses:ConfigurationSetName": csName,
                },
              },
            },
          ],
        })
      ),
    },
    opts
  );

  // Create access key for the IAM user
  const accessKey = new aws.iam.AccessKey(
    `${name}-smtp-key`,
    {
      user: iamUser.name,
    },
    opts
  );

  // SMTP username is the access key ID
  const smtpUsername = accessKey.id;

  // Convert the secret access key to SMTP password using core utility
  const smtpPassword = pulumi
    .all([accessKey.secret, region])
    .apply(([secret, r]) => convertToSMTPPassword(secret, r));

  // SMTP endpoint using core utility
  const smtpEndpoint = region.apply((r) => getSMTPEndpoint(r));

  return {
    iamUser,
    accessKey,
    smtpUsername,
    smtpPassword,
    smtpEndpoint,
  };
}
