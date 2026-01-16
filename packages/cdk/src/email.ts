import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

import { applyDefaults, retentionToDays } from "./defaults.js";
import type { WrapsEmailProps, WrapsEmailResources } from "./types.js";

/**
 * Get the package root directory (where package.json lives)
 */
function getPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = dirname(currentFile);

  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }

  throw new Error("Could not find package.json");
}

/**
 * Get the path to the Lambda event processor code
 */
function getLambdaPath(): string {
  const packageRoot = getPackageRoot();
  const lambdaPath = join(packageRoot, "dist", "lambda", "event-processor");
  const bundleMarker = join(lambdaPath, ".bundled");

  if (existsSync(bundleMarker)) {
    return lambdaPath;
  }

  throw new Error(
    `Lambda code not found: ${lambdaPath}\n` +
      "Make sure to build the package first: pnpm build"
  );
}

/**
 * WrapsEmail - CDK construct for deploying Wraps email infrastructure
 *
 * Following SST's pattern of composition over presets:
 * - Minimal required config - just provide what you need
 * - Sensible defaults for everything else
 * - Direct resource access for customization
 * - Grant methods for easy IAM permissions
 *
 * @example
 * ```typescript
 * // Minimal - just Vercel OIDC for sending
 * const email = new WrapsEmail(this, "Email", {
 *   vercel: { teamSlug: "my-team", projectName: "my-app" },
 * });
 *
 * // With domain and event tracking
 * const email = new WrapsEmail(this, "Email", {
 *   vercel: { teamSlug: "my-team", projectName: "my-app" },
 *   domain: "example.com",
 *   events: {
 *     types: ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "OPEN", "CLICK"],
 *     storeHistory: true,
 *     retention: "6months",
 *   },
 * });
 *
 * // Grant send permissions to a Lambda
 * email.grantSend(myLambda);
 * ```
 */
export class WrapsEmail extends Construct {
  /**
   * Underlying resources for advanced use cases
   */
  public readonly resources: WrapsEmailResources;

  // ============================================
  // CORE OUTPUTS
  // ============================================

  /** IAM role ARN for SDK authentication */
  public readonly roleArn: string;

  /** SES configuration set name */
  public readonly configSetName: string;

  // ============================================
  // DOMAIN OUTPUTS
  // ============================================

  /** Primary domain (if configured) */
  public readonly domain?: string;

  /** MAIL FROM domain (if configured) */
  public readonly mailFromDomain?: string;

  /** DKIM CNAME records to add to DNS (if domain is configured) */
  public readonly dkimRecords?: { name: string; value: string }[];

  // ============================================
  // EVENT TRACKING OUTPUTS
  // ============================================

  /** DynamoDB table name for email history */
  public readonly tableName?: string;

  /** SQS queue URL for events */
  public readonly queueUrl?: string;

  /** SQS dead letter queue URL */
  public readonly dlqUrl?: string;

  // ============================================
  // SMTP OUTPUTS
  // ============================================

  /** SMTP endpoint */
  public readonly smtpEndpoint?: string;

  constructor(scope: Construct, id: string, props: WrapsEmailProps) {
    super(scope, id);

    // Apply defaults
    const config = applyDefaults(props);

    // Initialize resources object
    const resources: Partial<WrapsEmailResources> = {};

    // ============================================
    // 1. CREATE OIDC PROVIDER (if Vercel or custom OIDC)
    // ============================================
    if (config.vercel) {
      const oidcProvider = new iam.OpenIdConnectProvider(this, "OidcProvider", {
        url: "https://oidc.vercel.com",
        clientIds: [`https://vercel.com/${config.vercel.teamSlug}`],
      });
      resources.oidcProvider = oidcProvider;
    } else if (config.oidc) {
      const oidcProvider = new iam.OpenIdConnectProvider(this, "OidcProvider", {
        url: config.oidc.providerUrl,
        clientIds: [config.oidc.audience],
      });
      resources.oidcProvider = oidcProvider;
    }

    // ============================================
    // 2. CREATE IAM ROLE
    // ============================================
    const role = this.createIAMRole(config, resources.oidcProvider);
    resources.role = role;

    // ============================================
    // 3. CREATE SES CONFIGURATION SET
    // ============================================
    const configSet = new ses.ConfigurationSet(this, "ConfigSet", {
      configurationSetName: "wraps-email-tracking",
      reputationMetrics: config.reputationMetrics,
      sendingEnabled: config.sendingEnabled,
      tlsPolicy: config.tlsRequired
        ? ses.ConfigurationSetTlsPolicy.REQUIRE
        : ses.ConfigurationSetTlsPolicy.OPTIONAL,
      suppressionReasons: config.suppressionList.enabled
        ? ses.SuppressionReasons.BOUNCES_AND_COMPLAINTS
        : undefined,
    });
    resources.configSet = configSet;

    // ============================================
    // 4. CREATE DOMAIN IDENTITY (if configured)
    // ============================================
    if (config.domain) {
      const emailIdentity = new ses.EmailIdentity(this, "EmailIdentity", {
        identity: ses.Identity.domain(config.domain),
        configurationSet: configSet,
        dkimSigning: true,
        mailFromDomain: config.mailFromSubdomain
          ? `${config.mailFromSubdomain}.${config.domain}`
          : undefined,
      });
      resources.emailIdentity = emailIdentity;

      this.domain = config.domain;
      this.mailFromDomain = config.mailFromSubdomain
        ? `${config.mailFromSubdomain}.${config.domain}`
        : undefined;

      // Extract DKIM records for DNS configuration
      // SES generates 3 DKIM CNAME records that need to be added to DNS
      this.dkimRecords = [
        {
          name: emailIdentity.dkimDnsTokenName1,
          value: emailIdentity.dkimDnsTokenValue1,
        },
        {
          name: emailIdentity.dkimDnsTokenName2,
          value: emailIdentity.dkimDnsTokenValue2,
        },
        {
          name: emailIdentity.dkimDnsTokenName3,
          value: emailIdentity.dkimDnsTokenValue3,
        },
      ];

      // Create Route53 DNS records if hosted zone is provided
      if (config.hostedZoneId) {
        const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
          this,
          "HostedZone",
          {
            hostedZoneId: config.hostedZoneId,
            zoneName: config.domain,
          }
        );

        // DKIM CNAME records (3 records)
        for (let i = 0; i < 3; i++) {
          const dkimRecord = this.dkimRecords[i];
          new route53.CnameRecord(this, `DkimRecord${i + 1}`, {
            zone: hostedZone,
            recordName: dkimRecord.name,
            domainName: dkimRecord.value,
            ttl: cdk.Duration.minutes(30),
            comment: `DKIM record ${i + 1} for SES email authentication`,
          });
        }

        // SPF TXT record for the domain
        new route53.TxtRecord(this, "SpfRecord", {
          zone: hostedZone,
          recordName: config.domain,
          values: ["v=spf1 include:amazonses.com ~all"],
          ttl: cdk.Duration.minutes(30),
          comment: "SPF record for SES email sending",
        });

        // DMARC TXT record
        new route53.TxtRecord(this, "DmarcRecord", {
          zone: hostedZone,
          recordName: `_dmarc.${config.domain}`,
          values: [
            `v=DMARC1; p=quarantine; rua=mailto:postmaster@${this.mailFromDomain || config.domain}`,
          ],
          ttl: cdk.Duration.minutes(30),
          comment: "DMARC policy for email authentication",
        });

        // MAIL FROM domain records (if configured)
        if (this.mailFromDomain) {
          // MX record for bounce handling
          new route53.MxRecord(this, "MailFromMxRecord", {
            zone: hostedZone,
            recordName: this.mailFromDomain,
            values: [
              {
                priority: 10,
                hostName: `feedback-smtp.${cdk.Stack.of(this).region}.amazonses.com`,
              },
            ],
            ttl: cdk.Duration.minutes(30),
            comment: "MX record for SES MAIL FROM domain",
          });

          // SPF TXT record for MAIL FROM subdomain
          new route53.TxtRecord(this, "MailFromSpfRecord", {
            zone: hostedZone,
            recordName: this.mailFromDomain,
            values: ["v=spf1 include:amazonses.com ~all"],
            ttl: cdk.Duration.minutes(30),
            comment: "SPF record for SES MAIL FROM domain",
          });
        }
      }
    }

    // ============================================
    // 5. CREATE EVENT TRACKING (if configured)
    // ============================================
    if (config.events) {
      // Dead letter queue
      const dlq = new sqs.Queue(this, "DLQ", {
        queueName: "wraps-email-events-dlq",
        retentionPeriod: cdk.Duration.days(14),
      });
      resources.dlq = dlq;

      // Main event queue
      const queue = new sqs.Queue(this, "Queue", {
        queueName: "wraps-email-events",
        visibilityTimeout: cdk.Duration.seconds(60), // Must be >= Lambda timeout
        retentionPeriod: cdk.Duration.days(4),
        receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
        deadLetterQueue: {
          queue: dlq,
          maxReceiveCount: 3,
        },
      });
      resources.queue = queue;

      // EventBridge rule to capture SES events
      const eventRule = new events.Rule(this, "EventRule", {
        ruleName: "wraps-email-events-to-sqs",
        description: "Route SES email events to SQS for processing",
        eventPattern: {
          source: ["aws.ses"],
        },
      });
      eventRule.addTarget(new eventsTargets.SqsQueue(queue));
      resources.eventRule = eventRule;

      // SES event destination to publish events to EventBridge
      // Maps event types from config (e.g., "SEND") to SES format (e.g., "send")
      const eventTypes = config.events.types ?? [];
      const sesEventTypes = eventTypes.map((type) =>
        type.toLowerCase().replace(/_/g, "-")
      );

      new ses.CfnConfigurationSetEventDestination(this, "EventDestination", {
        configurationSetName: configSet.configurationSetName,
        eventDestination: {
          name: "EventBridgeDestination",
          enabled: true,
          matchingEventTypes: sesEventTypes,
          eventBridgeDestination: {
            eventBusArn: `arn:aws:events:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:event-bus/default`,
          },
        },
      });

      this.queueUrl = queue.queueUrl;
      this.dlqUrl = dlq.queueUrl;

      // Create history table and Lambda if history storage is enabled
      if (config.events.storeHistory) {
        const retentionDays = retentionToDays(
          config.events.retention ?? "90days"
        );

        // DynamoDB table for email history
        const table = new dynamodb.Table(this, "HistoryTable", {
          tableName: "wraps-email-history",
          partitionKey: {
            name: "messageId",
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: { name: "sentAt", type: dynamodb.AttributeType.NUMBER },
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
          removalPolicy: config.removalPolicy,
          timeToLiveAttribute: retentionDays > 0 ? "expiresAt" : undefined,
        });

        // GSI for account lookups
        table.addGlobalSecondaryIndex({
          indexName: "accountId-sentAt-index",
          partitionKey: {
            name: "accountId",
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: { name: "sentAt", type: dynamodb.AttributeType.NUMBER },
        });

        resources.table = table;
        this.tableName = table.tableName;

        // Lambda event processor using pre-bundled code from core package
        const eventProcessor = new lambda.Function(this, "EventProcessor", {
          functionName: "wraps-email-event-processor",
          description: "Processes SES email events and stores them in DynamoDB",
          runtime: lambda.Runtime.NODEJS_20_X,
          handler: "index.handler",
          code: lambda.Code.fromAsset(getLambdaPath()),
          timeout: cdk.Duration.seconds(30),
          memorySize: 512,
          environment: {
            TABLE_NAME: table.tableName,
            AWS_ACCOUNT_ID: cdk.Stack.of(this).account,
            RETENTION_DAYS: String(retentionDays > 0 ? retentionDays : 0),
          },
        });

        // Grant permissions
        table.grantWriteData(eventProcessor);
        eventProcessor.addEventSource(
          new lambdaEventSources.SqsEventSource(queue, {
            batchSize: 10,
            maxBatchingWindow: cdk.Duration.seconds(5),
            reportBatchItemFailures: true,
          })
        );

        resources.eventProcessor = eventProcessor;
      }
    }

    // ============================================
    // 6. CREATE SMTP CREDENTIALS (if configured)
    // ============================================
    if (config.smtp?.enabled) {
      const smtpUser = new iam.User(this, "SmtpUser", {
        userName: "wraps-email-smtp-user",
      });

      smtpUser.addToPolicy(
        new iam.PolicyStatement({
          actions: ["ses:SendRawEmail"],
          resources: ["*"],
          conditions: {
            StringEquals: {
              "ses:ConfigurationSetName": configSet.configurationSetName,
            },
          },
        })
      );

      resources.smtpUser = smtpUser;
      this.smtpEndpoint = `email-smtp.${cdk.Stack.of(this).region}.amazonaws.com`;
    }

    // Store resources
    this.resources = resources as WrapsEmailResources;
    this.roleArn = role.roleArn;
    this.configSetName = configSet.configurationSetName;

    // ============================================
    // OUTPUTS
    // ============================================
    new cdk.CfnOutput(this, "RoleArnOutput", {
      value: role.roleArn,
      description: "IAM role ARN for SDK authentication",
      exportName: "WrapsEmailRoleArn",
    });

    new cdk.CfnOutput(this, "ConfigSetOutput", {
      value: configSet.configurationSetName,
      description: "SES configuration set name",
      exportName: "WrapsEmailConfigSetName",
    });

    if (this.tableName) {
      new cdk.CfnOutput(this, "TableNameOutput", {
        value: this.tableName,
        description: "DynamoDB table name for email history",
        exportName: "WrapsEmailTableName",
      });
    }

    if (this.queueUrl) {
      new cdk.CfnOutput(this, "QueueUrlOutput", {
        value: this.queueUrl,
        description: "SQS queue URL for events",
        exportName: "WrapsEmailQueueUrl",
      });
    }

    // DKIM DNS records output
    if (this.dkimRecords && this.domain) {
      new cdk.CfnOutput(this, "DkimRecord1Output", {
        value: `${this.dkimRecords[0].name} CNAME ${this.dkimRecords[0].value}`,
        description: "DKIM CNAME record 1 - add to DNS",
      });
      new cdk.CfnOutput(this, "DkimRecord2Output", {
        value: `${this.dkimRecords[1].name} CNAME ${this.dkimRecords[1].value}`,
        description: "DKIM CNAME record 2 - add to DNS",
      });
      new cdk.CfnOutput(this, "DkimRecord3Output", {
        value: `${this.dkimRecords[2].name} CNAME ${this.dkimRecords[2].value}`,
        description: "DKIM CNAME record 3 - add to DNS",
      });

      // Also output SPF and DMARC guidance
      if (this.mailFromDomain) {
        new cdk.CfnOutput(this, "SpfRecordOutput", {
          value: `${this.mailFromDomain} TXT "v=spf1 include:amazonses.com ~all"`,
          description: "SPF TXT record for MAIL FROM domain - add to DNS",
        });
        new cdk.CfnOutput(this, "MailFromMxOutput", {
          value: `${this.mailFromDomain} MX 10 feedback-smtp.${cdk.Stack.of(this).region}.amazonses.com`,
          description: "MX record for MAIL FROM domain - add to DNS",
        });
      }
      new cdk.CfnOutput(this, "DmarcRecordOutput", {
        value: `_dmarc.${this.domain} TXT "v=DMARC1; p=none; rua=mailto:dmarc@${this.domain}"`,
        description: "DMARC TXT record (recommended) - add to DNS",
      });
    }
  }

  /**
   * Create IAM role with appropriate trust policy and permissions
   */
  private createIAMRole(
    config: ReturnType<typeof applyDefaults>,
    oidcProvider?: iam.IOpenIdConnectProvider
  ): iam.Role {
    let assumedBy: iam.IPrincipal;

    if (config.vercel && oidcProvider) {
      // Vercel OIDC
      assumedBy = new iam.FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "oidc.vercel.com:aud": `https://vercel.com/${config.vercel.teamSlug}`,
          },
          StringLike: {
            "oidc.vercel.com:sub": `owner:${config.vercel.teamSlug}:project:${config.vercel.projectName}:environment:*`,
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      );
    } else if (config.oidc && oidcProvider) {
      // Custom OIDC
      const providerHost = new URL(config.oidc.providerUrl).host;
      assumedBy = new iam.FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            [`${providerHost}:aud`]: config.oidc.audience,
          },
          StringLike: {
            [`${providerHost}:sub`]: config.oidc.subjectPattern,
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      );
    } else {
      // Default to AWS services
      assumedBy = new iam.ServicePrincipal("lambda.amazonaws.com");
    }

    const role = new iam.Role(this, "Role", {
      roleName: "wraps-email-role",
      description: "IAM role for Wraps SDK to send emails via SES",
      assumedBy,
    });

    // SES sending permissions
    if (config.sendingEnabled) {
      role.addToPolicy(
        new iam.PolicyStatement({
          sid: "SESSending",
          actions: [
            "ses:SendEmail",
            "ses:SendRawEmail",
            "ses:SendTemplatedEmail",
            "ses:SendBulkTemplatedEmail",
            "ses:SendBulkEmail",
          ],
          resources: ["*"],
          conditions: {
            StringEquals: {
              "ses:ConfigurationSetName": "wraps-email-tracking",
            },
          },
        })
      );
    }

    // SES read permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "SESRead",
        actions: [
          "ses:GetSendQuota",
          "ses:GetSendStatistics",
          "ses:GetAccount",
        ],
        resources: ["*"],
      })
    );

    // CloudWatch metrics
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "CloudWatchMetrics",
        actions: [
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
        ],
        resources: ["*"],
      })
    );

    return role;
  }

  // ============================================
  // GRANT METHODS (CDK pattern)
  // ============================================

  /**
   * Grant permissions to send emails via this configuration
   */
  public grantSend(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
      resourceArns: ["*"],
      conditions: {
        StringEquals: {
          "ses:ConfigurationSetName": this.configSetName,
        },
      },
    });
  }

  /**
   * Grant permissions to read email history from DynamoDB
   */
  public grantReadHistory(grantee: iam.IGrantable): iam.Grant {
    if (!this.resources.table) {
      throw new Error(
        "Cannot grant read history - no history table configured. Enable events.storeHistory."
      );
    }
    return this.resources.table.grantReadData(grantee);
  }

  /**
   * Grant permissions to query email events from SQS
   */
  public grantConsumeEvents(grantee: iam.IGrantable): iam.Grant {
    if (!this.resources.queue) {
      throw new Error(
        "Cannot grant consume events - no queue configured. Enable events."
      );
    }
    return this.resources.queue.grantConsumeMessages(grantee);
  }
}
