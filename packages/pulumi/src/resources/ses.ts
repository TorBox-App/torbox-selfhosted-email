import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type {
  ResolvedConfig,
  SESEventType,
  TransformFunctions,
} from "../types.js";

/**
 * SES resources result
 */
export type SESResourcesResult = {
  configSet: aws.ses.ConfigurationSet;
  eventDestination?: aws.sesv2.ConfigurationSetEventDestination;
  domainIdentity?: aws.ses.DomainIdentity;
  domainDkim?: aws.ses.DomainDkim;
  mailFromAttributes?: aws.sesv2.EmailIdentityMailFromAttributes;
  dkimTokens: pulumi.Output<string[]>;
};

/**
 * All SES event types
 */
const ALL_EVENT_TYPES: SESEventType[] = [
  "SEND",
  "DELIVERY",
  "OPEN",
  "CLICK",
  "BOUNCE",
  "COMPLAINT",
  "REJECT",
  "RENDERING_FAILURE",
  "DELIVERY_DELAY",
  "SUBSCRIPTION",
];

/**
 * Create SES configuration set
 */
export function createConfigSet(
  name: string,
  _config: ResolvedConfig,
  _tags: Record<string, string>,
  transform?: TransformFunctions["configSet"],
  opts?: pulumi.ComponentResourceOptions
): aws.ses.ConfigurationSet {
  let args: aws.ses.ConfigurationSetArgs = {
    name: "wraps-email-tracking",
    // Using basic ses.ConfigurationSet - advanced options via sesv2
    // are added separately
  };

  // Apply transform if provided
  if (transform) {
    args = transform(args);
  }

  return new aws.ses.ConfigurationSet(`${name}-config-set`, args, opts);
}

/**
 * Create SES configuration set with v2 API (supports more options)
 */
export function createConfigSetV2(
  name: string,
  config: ResolvedConfig,
  tags: Record<string, string>,
  opts?: pulumi.ComponentResourceOptions
): aws.sesv2.ConfigurationSet {
  const args: aws.sesv2.ConfigurationSetArgs = {
    configurationSetName: "wraps-email-tracking",
    deliveryOptions: config.tlsRequired ? { tlsPolicy: "REQUIRE" } : undefined,
    suppressionOptions: config.suppressionList.enabled
      ? { suppressedReasons: config.suppressionList.reasons }
      : undefined,
    reputationOptions: config.reputationMetrics
      ? { reputationMetricsEnabled: true }
      : undefined,
    sendingOptions: {
      sendingEnabled: config.sendingEnabled,
    },
    trackingOptions: config.tracking.customRedirectDomain
      ? {
          customRedirectDomain: config.tracking.customRedirectDomain,
          httpsPolicy: config.tracking.httpsEnabled ? "REQUIRE" : "OPTIONAL",
        }
      : undefined,
    tags,
  };

  return new aws.sesv2.ConfigurationSet(`${name}-config-set-v2`, args, opts);
}

/**
 * Create EventBridge event destination for SES events
 */
export function createEventDestination(
  name: string,
  configSetName: pulumi.Input<string>,
  eventTypes: SESEventType[],
  opts?: pulumi.ComponentResourceOptions
): aws.sesv2.ConfigurationSetEventDestination {
  // SES requires the default EventBridge bus
  const defaultEventBus = aws.cloudwatch.getEventBusOutput({ name: "default" });

  return new aws.sesv2.ConfigurationSetEventDestination(
    `${name}-event-destination`,
    {
      configurationSetName: configSetName,
      eventDestinationName: "wraps-email-eventbridge",
      eventDestination: {
        enabled: true,
        matchingEventTypes:
          eventTypes.length > 0 ? eventTypes : ALL_EVENT_TYPES,
        eventBridgeDestination: {
          eventBusArn: defaultEventBus.arn,
        },
      },
    },
    opts
  );
}

/**
 * Create SES domain identity
 */
export function createDomainIdentity(
  name: string,
  domain: string,
  _tags: Record<string, string>,
  transform?: TransformFunctions["domainIdentity"],
  opts?: pulumi.ComponentResourceOptions
): { domainIdentity: aws.ses.DomainIdentity; domainDkim: aws.ses.DomainDkim } {
  let args: aws.ses.DomainIdentityArgs = {
    domain,
  };

  // Apply transform if provided
  if (transform) {
    args = transform(args);
  }

  const domainIdentity = new aws.ses.DomainIdentity(
    `${name}-domain-identity`,
    args,
    opts
  );

  // Create DKIM verification
  const domainDkim = new aws.ses.DomainDkim(
    `${name}-domain-dkim`,
    {
      domain,
    },
    { ...opts, dependsOn: [domainIdentity] }
  );

  return { domainIdentity, domainDkim };
}

/**
 * Create SES domain identity with v2 API (supports configuration set linking)
 */
export function createDomainIdentityV2(
  name: string,
  domain: string,
  configSetName: pulumi.Input<string>,
  tags: Record<string, string>,
  opts?: pulumi.ComponentResourceOptions
): aws.sesv2.EmailIdentity {
  return new aws.sesv2.EmailIdentity(
    `${name}-domain-identity-v2`,
    {
      emailIdentity: domain,
      configurationSetName: configSetName,
      dkimSigningAttributes: {
        nextSigningKeyLength: "RSA_2048_BIT",
      },
      tags,
    },
    opts
  );
}

/**
 * Configure MAIL FROM domain for better deliverability
 */
export function createMailFromAttributes(
  name: string,
  domain: string,
  mailFromDomain: string,
  domainIdentity: aws.ses.DomainIdentity | aws.sesv2.EmailIdentity,
  opts?: pulumi.ComponentResourceOptions
): aws.sesv2.EmailIdentityMailFromAttributes {
  return new aws.sesv2.EmailIdentityMailFromAttributes(
    `${name}-mail-from`,
    {
      emailIdentity: domain,
      mailFromDomain,
      behaviorOnMxFailure: "USE_DEFAULT_VALUE",
    },
    { ...opts, dependsOn: [domainIdentity] }
  );
}

/**
 * Create all SES resources based on configuration
 */
export function createSESResources(
  name: string,
  config: ResolvedConfig,
  tags: Record<string, string>,
  transform?: TransformFunctions,
  opts?: pulumi.ComponentResourceOptions
): SESResourcesResult {
  // Create configuration set with v2 API for full feature support
  const configSet = createConfigSetV2(name, config, tags, opts);

  // Create event destination if events are configured
  let eventDestination: aws.sesv2.ConfigurationSetEventDestination | undefined;
  if (config.events) {
    eventDestination = createEventDestination(
      name,
      configSet.configurationSetName,
      config.events.types || ALL_EVENT_TYPES,
      opts
    );
  }

  // Create domain identity if domain is provided
  let domainIdentity: aws.ses.DomainIdentity | undefined;
  let domainDkim: aws.ses.DomainDkim | undefined;
  let mailFromAttributes: aws.sesv2.EmailIdentityMailFromAttributes | undefined;
  let dkimTokens: pulumi.Output<string[]> = pulumi.output([]);

  if (config.domain) {
    const domainResources = createDomainIdentity(
      name,
      config.domain,
      tags,
      transform?.domainIdentity,
      opts
    );
    domainIdentity = domainResources.domainIdentity;
    domainDkim = domainResources.domainDkim;

    // Get DKIM tokens
    dkimTokens = domainDkim.dkimTokens;

    // Configure MAIL FROM if domain is provided
    if (config.domain && config.mailFromSubdomain) {
      const mailFromDomain = `${config.mailFromSubdomain}.${config.domain}`;
      mailFromAttributes = createMailFromAttributes(
        name,
        config.domain,
        mailFromDomain,
        domainIdentity,
        opts
      );
    }
  }

  return {
    configSet: configSet as unknown as aws.ses.ConfigurationSet,
    eventDestination,
    domainIdentity,
    domainDkim,
    mailFromAttributes,
    dkimTokens,
  };
}
