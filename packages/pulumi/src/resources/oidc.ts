import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import type {
  OIDCConfig,
  TransformFunctions,
  VercelOIDCConfig,
} from "../types.js";

/**
 * OIDC provider result
 */
export type OIDCProviderResult = {
  provider: aws.iam.OpenIdConnectProvider;
};

/**
 * Create Vercel OIDC provider for AssumeRoleWithWebIdentity
 */
export function createVercelOIDCProvider(
  name: string,
  config: VercelOIDCConfig,
  tags: Record<string, string>,
  transform?: TransformFunctions["oidcProvider"],
  opts?: pulumi.ComponentResourceOptions
): OIDCProviderResult {
  const url = `https://oidc.vercel.com/${config.teamSlug}`;

  let args: aws.iam.OpenIdConnectProviderArgs = {
    url,
    clientIdLists: [`https://vercel.com/${config.teamSlug}`],
    thumbprintLists: [
      // Vercel OIDC thumbprints
      "20032e77eca0785eece16b56b42c9b330b906320",
      "696db3af0dffc17e65c6a20d925c5a7bd24dec7e",
    ],
    tags: {
      ...tags,
      Provider: "vercel",
    },
  };

  // Apply transform if provided
  if (transform) {
    args = transform(args);
  }

  const provider = new aws.iam.OpenIdConnectProvider(
    `${name}-vercel-oidc`,
    args,
    opts
  );

  return { provider };
}

/**
 * Create custom OIDC provider (GitHub Actions, GitLab, etc.)
 */
export function createCustomOIDCProvider(
  name: string,
  config: OIDCConfig,
  tags: Record<string, string>,
  transform?: TransformFunctions["oidcProvider"],
  opts?: pulumi.ComponentResourceOptions
): OIDCProviderResult {
  let args: aws.iam.OpenIdConnectProviderArgs = {
    url: config.providerUrl,
    clientIdLists: [config.audience],
    // For custom providers, thumbprints need to be provided
    // This is a placeholder - in production, you'd need to fetch the actual thumbprint
    thumbprintLists: ["0000000000000000000000000000000000000000"],
    tags: {
      ...tags,
      Provider: "custom-oidc",
    },
  };

  // Apply transform if provided
  if (transform) {
    args = transform(args);
  }

  const provider = new aws.iam.OpenIdConnectProvider(
    `${name}-custom-oidc`,
    args,
    opts
  );

  return { provider };
}
