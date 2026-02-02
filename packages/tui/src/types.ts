export type Route =
  | { view: "dashboard" }
  | {
      view: "email";
      sub: "overview" | "domains" | "init" | "connect" | "upgrade" | "destroy";
    }
  | { view: "email.domains.add" }
  | { view: "email.domains.verify"; domain: string }
  | { view: "email.domains.remove"; domain: string }
  | { view: "email.init" }
  | { view: "templates" }
  | { view: "workflows" }
  | { view: "monitoring" };

export type View = Route["view"];

export interface Shortcut {
  key: string;
  label: string;
}

export interface ServiceInfo {
  name: string;
  tier: string;
  region: string;
  details: string[];
}

export type DnsStatus = "ok" | "pending" | "error";

export interface DomainInfo {
  name: string;
  dkim: DnsStatus;
  spf: DnsStatus;
  dmarc: DnsStatus;
}

export interface ActivityEntry {
  label: string;
  value: number;
  max: number;
  color: string;
}

export interface DomainStatus {
  name: string;
  verified: boolean;
  dkimStatus: DnsStatus;
  spfStatus: DnsStatus;
  dmarcStatus: DnsStatus;
}

export interface SendQuota {
  sentLast24Hours: number;
  max24HourSend: number;
  maxSendRate: number;
}

export interface SendStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complaints: number;
  rejected: number;
}

export type Timespan = "24h" | "7d" | "30d";

export interface EmailEvent {
  timestamp: number;
  eventType: string;
}

export interface ConnectionMetadata {
  version: string;
  accountId: string;
  region: string;
  provider: string;
  timestamp: string;
  services: {
    email?: {
      preset?: string;
      config: Record<string, unknown>;
      pulumiStackName?: string;
      deployedAt: string;
    };
    sms?: {
      preset?: string;
      config: Record<string, unknown>;
      pulumiStackName?: string;
      deployedAt: string;
    };
    cdn?: {
      preset?: string;
      config: Record<string, unknown>;
      pulumiStackName?: string;
      deployedAt: string;
    };
  };
}

export interface AccountData {
  accountId: string;
  arn: string;
  region: string;
  metadata: ConnectionMetadata | null;
  domains: DomainStatus[];
  quota: SendQuota;
  events: EmailEvent[];
}

// --- Email Init Wizard Types ---

export type Provider = "vercel" | "aws" | "railway" | "other";
export type ConfigPreset = "starter" | "production" | "enterprise" | "custom";

export type ArchiveRetention =
  | "7days"
  | "30days"
  | "90days"
  | "3months"
  | "6months"
  | "9months"
  | "1year"
  | "18months"
  | "2years"
  | "30months"
  | "3years"
  | "4years"
  | "5years"
  | "6years"
  | "7years"
  | "8years"
  | "9years"
  | "10years"
  | "indefinite"
  | "permanent";

export type SESEventType =
  | "SEND"
  | "DELIVERY"
  | "OPEN"
  | "CLICK"
  | "BOUNCE"
  | "COMPLAINT"
  | "REJECT"
  | "RENDERING_FAILURE"
  | "DELIVERY_DELAY"
  | "SUBSCRIPTION";

export type WrapsEmailConfig = {
  domain?: string;
  tracking?: {
    enabled: boolean;
    opens?: boolean;
    clicks?: boolean;
    customRedirectDomain?: string;
    httpsEnabled?: boolean;
    wafEnabled?: boolean;
  };
  tlsRequired?: boolean;
  reputationMetrics?: boolean;
  suppressionList?: {
    enabled: boolean;
    reasons: ("BOUNCE" | "COMPLAINT")[];
  };
  eventTracking?: {
    enabled: boolean;
    eventBridge?: boolean;
    events?: SESEventType[];
    dynamoDBHistory?: boolean;
    archiveRetention?: ArchiveRetention;
  };
  emailArchiving?: {
    enabled: boolean;
    retention: ArchiveRetention;
  };
  smtpCredentials?: {
    enabled: boolean;
  };
  alerts?: {
    enabled: boolean;
    dlqAlerts?: boolean;
    thresholds?: {
      bounceRateWarning?: number;
      bounceRateCritical?: number;
      complaintRateWarning?: number;
      complaintRateCritical?: number;
    };
  };
  dedicatedIp?: boolean;
  sendingEnabled?: boolean;
};

export interface FeatureCost {
  monthly: number;
  perEmail?: number;
  description: string;
}

export interface FeatureCostBreakdown {
  tracking?: FeatureCost;
  reputationMetrics?: FeatureCost;
  eventTracking?: FeatureCost;
  dynamoDBHistory?: FeatureCost;
  emailArchiving?: FeatureCost;
  dedicatedIp?: FeatureCost;
  waf?: FeatureCost;
  smtpCredentials?: FeatureCost;
  alerts?: FeatureCost;
  total: FeatureCost;
}

export interface FeatureConfig {
  tracking: boolean;
  reputationMetrics: boolean;
  eventTracking: boolean;
  emailHistory: boolean;
  historyRetention: ArchiveRetention;
  emailArchiving: boolean;
  archiveRetention: ArchiveRetention;
  alerts: boolean;
  dedicatedIp: boolean;
}

export interface InitConfig {
  provider: Provider;
  region: string;
  domain: string;
  vercelConfig?: { teamSlug: string; projectName: string };
  preset: ConfigPreset;
  features: FeatureConfig;
  estimatedVolume: number;
}

export type InitStep = "welcome" | "config" | "features" | "review" | "deploy";
