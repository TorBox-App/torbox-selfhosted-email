# Wraps CDK (packages/cdk)

AWS CDK construct for deploying Wraps email infrastructure. Mirrors `packages/pulumi/` but uses CDK patterns (Constructs, grant methods, `.resources`).

## Critical Rules

### 1. Same Config System as Pulumi

Both packages share types from `@wraps/core` and use identical `applyDefaults()` logic. If you change defaults in one, change them in both.

### 2. Resources Exposed via .resources (Not .nodes)

CDK convention uses `.resources`, Pulumi uses `.nodes`:

```typescript
// CDK
const email = new WrapsEmail(this, "email", props);
email.resources.table?.tableArn;
email.resources.role;

// Pulumi equivalent
const email = new WrapsEmail("email", args);
email.nodes.table?.arn;
email.nodes.role;
```

### 3. Grant Methods Follow CDK Conventions

```typescript
const email = new WrapsEmail(this, "email", props);

// Grant a Lambda permission to send emails
email.grantSend(myFunction);

// Grant read access to event history table
email.grantReadHistory(myFunction);

// Grant access to consume events from SQS
email.grantConsumeEvents(myFunction);
```

All return `iam.Grant` for chainability.

### 4. RemovalPolicy Defaults to RETAIN

Infrastructure stays when stacks are deleted. Users must explicitly set `removalPolicy: cdk.RemovalPolicy.DESTROY` if they want cleanup.

## Architecture

### Key Files

```
src/
├── index.ts           # Exports (WrapsEmail construct)
├── types.ts           # WrapsEmailProps, ResolvedConfig, Resources
├── defaults.ts        # applyDefaults() — shared logic with Pulumi
├── email.ts           # Main WrapsEmail Construct
└── defaults.test.ts   # Config normalization tests
```

### Resource Creation Order

Same as Pulumi: OIDC → IAM → SES → DNS → Events → Lambda → HTTPS → SMTP

### WrapsEmailResources Type

```typescript
type WrapsEmailResources = {
  role: iam.IRole;
  oidcProvider?: iam.IOpenIdConnectProvider;
  configSet: ses.IConfigurationSet;
  emailIdentity?: ses.IEmailIdentity;
  table?: dynamodb.ITable;
  queue?: sqs.IQueue;
  dlq?: sqs.IQueue;
  eventProcessor?: lambda.IFunction;
  eventRule?: events.IRule;
  certificate?: acm.ICertificate;
  distribution?: cloudfront.IDistribution;
  smtpUser?: iam.IUser;
};
```

## Differences from Pulumi Package

| Aspect | CDK | Pulumi |
|--------|-----|--------|
| Base class | `Construct` | `ComponentResource` |
| Resource access | `.resources` | `.nodes` |
| Permissions | `grantSend()` methods | Manual IAM policy |
| Customization | CDK escape hatches | `transform` functions |
| Outputs | `CfnOutput` | `registerOutputs()` |
| Removal | `removalPolicy` prop | Pulumi `protect` |
| Interface types | `iam.IRole` (interfaces) | `aws.iam.Role` (concrete) |

## Peer Dependencies

```json
"peerDependencies": {
  "aws-cdk-lib": "^2.0.0",
  "constructs": "^10.0.0"
}
```

Not bundled — user provides in their CDK project.

## Commands

```bash
pnpm --filter @wraps.dev/cdk build       # Build + bundle Lambda
pnpm --filter @wraps.dev/cdk test        # Run tests
pnpm --filter @wraps.dev/cdk dev         # Watch mode
```
