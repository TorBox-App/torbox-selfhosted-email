import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

/**
 * Reply-threading signing secret configuration
 *
 * One SSM SecureString parameter per sending domain. The parameter value is a
 * JSON blob `{ kid, current, previous? }` (all secrets base64-encoded) so
 * rotation is atomic: a single `PutParameter` swaps both current and previous
 * keys at once.
 *
 * Pulumi OWNS the parameter resource (create/destroy), but NOT the value
 * after the first apply — rotations happen out-of-band via `ssm:PutParameter`
 * in `wraps email reply rotate`. `ignoreChanges: ["value"]` prevents
 * subsequent `pulumi up` runs from clobbering a rotated secret with the
 * original `initialSecret`.
 */
export type ReplySecretConfig = {
  domain: string;
  accountId: string;
  region: string;
  initialSecret: Buffer;
};

/**
 * Reply-threading secret resource outputs
 */
export type ReplySecretResources = {
  parameterArn: pulumi.Output<string>;
  parameterName: string;
  domain: string;
};

/**
 * Create an SSM SecureString parameter that holds the signing secret for a
 * single sending domain's reply-threading tokens.
 *
 * Path convention: `/wraps/email/reply-secret/{domain}`. The Lambda
 * verifier has a wildcard IAM grant on `.../reply-secret/*` and appends the
 * sending domain at runtime.
 */
export function createReplySecret(
  config: ReplySecretConfig
): ReplySecretResources {
  const parameterName = `/wraps/email/reply-secret/${config.domain}`;

  // Use the domain as the resource-logical-name suffix so Pulumi tracks one
  // resource per domain. Pulumi requires logical names be URN-safe, so we
  // replace dots with dashes.
  const logicalName = `wraps-email-reply-secret-${config.domain.replace(/\./g, "-")}`;

  const parameter = new aws.ssm.Parameter(
    logicalName,
    {
      name: parameterName,
      type: "SecureString",
      tier: "Standard",
      keyId: "alias/aws/ssm",
      value: pulumi.secret(
        JSON.stringify({
          kid: 1,
          current: config.initialSecret.toString("base64"),
        })
      ),
      tags: {
        ManagedBy: "wraps-cli",
        Service: "email-reply-threading",
        Domain: config.domain,
      },
    },
    {
      // After initial creation, the parameter value is rotated out-of-band by
      // `wraps email reply rotate` (direct ssm:PutParameter). Pulumi must NOT
      // overwrite the rotated value on subsequent `pulumi up` calls.
      ignoreChanges: ["value"],
    }
  );

  return {
    parameterArn: parameter.arn,
    parameterName,
    domain: config.domain,
  };
}
