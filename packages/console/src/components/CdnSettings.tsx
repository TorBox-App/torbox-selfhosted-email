import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  HardDrive,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Storage settings from API
 */
type CdnSettings = {
  bucketName: string;
  bucketArn: string;
  region: string;
  roleArn: string;
  cdn?: {
    enabled: boolean;
    distributionId?: string;
    distributionDomain?: string;
    customDomain?: string;
    status?: "Deployed" | "InProgress" | "Disabled";
  };
  certificate?: {
    arn?: string;
    status?: "ISSUED" | "PENDING_VALIDATION" | "FAILED";
    validationRecords?: Array<{
      name: string;
      type: string;
      value: string;
    }>;
  };
  versioning: boolean;
  retention?: string;
};

/**
 * Status badge component
 */
function StatusBadge({
  status,
}: {
  status: "SUCCESS" | "PENDING" | "FAILED" | "DISABLED";
}) {
  const config = {
    SUCCESS: {
      icon: CheckCircle2,
      label: "Active",
      className:
        "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    },
    PENDING: {
      icon: Clock,
      label: "Pending",
      className:
        "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    },
    FAILED: {
      icon: XCircle,
      label: "Failed",
      className:
        "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    },
    DISABLED: {
      icon: AlertCircle,
      label: "Disabled",
      className:
        "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <Badge className={className} variant="outline">
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

/**
 * Copy to clipboard button
 */
function CopyButton({ text }: { text: string }) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <Button onClick={handleCopy} size="sm" variant="ghost">
      <Copy className="h-3 w-3" />
    </Button>
  );
}

/**
 * S3 Bucket Section
 */
function BucketSection({ settings }: { settings: CdnSettings }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            <CardTitle>S3 Bucket</CardTitle>
          </div>
          <StatusBadge status="SUCCESS" />
        </div>
        <CardDescription>
          Your storage bucket for uploading files
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Bucket Name</span>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                {settings.bucketName}
              </code>
              <CopyButton text={settings.bucketName} />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Region</span>
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
              {settings.region}
            </code>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Versioning</span>
            <Badge variant={settings.versioning ? "default" : "secondary"}>
              {settings.versioning ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Encryption</span>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              <span className="text-sm">AES-256</span>
            </div>
          </div>
          {settings.retention && settings.retention !== "none" && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Auto-Cleanup
                </span>
                <span className="text-sm">{settings.retention}</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CloudFront CDN Section
 */
function CDNSection({ settings }: { settings: CdnSettings }) {
  const [dnsOpen, setDnsOpen] = React.useState(false);

  if (!settings.cdn?.enabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <CardTitle>CloudFront CDN</CardTitle>
            </div>
            <StatusBadge status="DISABLED" />
          </div>
          <CardDescription>
            CDN is not enabled for this storage bucket
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const cdnStatus =
    settings.cdn.status === "Deployed"
      ? "SUCCESS"
      : settings.cdn.status === "InProgress"
        ? "PENDING"
        : "FAILED";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle>CloudFront CDN</CardTitle>
          </div>
          <StatusBadge status={cdnStatus} />
        </div>
        <CardDescription>
          Global content delivery network for fast file access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {settings.cdn.distributionId && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Distribution ID
                </span>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                    {settings.cdn.distributionId}
                  </code>
                  <CopyButton text={settings.cdn.distributionId} />
                </div>
              </div>
              <Separator />
            </>
          )}
          {settings.cdn.distributionDomain && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  CloudFront URL
                </span>
                <div className="flex items-center gap-2">
                  <a
                    className="text-blue-600 text-sm hover:underline dark:text-blue-400"
                    href={`https://${settings.cdn.distributionDomain}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {settings.cdn.distributionDomain}
                    <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                  <CopyButton
                    text={`https://${settings.cdn.distributionDomain}`}
                  />
                </div>
              </div>
              <Separator />
            </>
          )}
          {settings.cdn.customDomain && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Custom Domain
              </span>
              <div className="flex items-center gap-2">
                <a
                  className="text-blue-600 text-sm hover:underline dark:text-blue-400"
                  href={`https://${settings.cdn.customDomain}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {settings.cdn.customDomain}
                  <ExternalLink className="ml-1 inline h-3 w-3" />
                </a>
                <CopyButton text={`https://${settings.cdn.customDomain}`} />
              </div>
            </div>
          )}
        </div>

        {/* Certificate Validation DNS Records */}
        {settings.certificate?.validationRecords &&
          settings.certificate.validationRecords.length > 0 &&
          settings.certificate.status === "PENDING_VALIDATION" && (
            <Collapsible onOpenChange={setDnsOpen} open={dnsOpen}>
              <CollapsibleTrigger asChild>
                <Button className="w-full justify-between" variant="ghost">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    Certificate DNS Records Required
                  </span>
                  {dnsOpen ? (
                    <span className="text-xs">Hide</span>
                  ) : (
                    <span className="text-xs">Show</span>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                    Add these DNS records to verify your custom domain
                    certificate
                  </AlertDescription>
                </Alert>
                {settings.certificate.validationRecords.map((record, i) => (
                  <div
                    className="rounded-lg border bg-muted/50 p-3 font-mono text-xs"
                    key={i}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {record.type}
                      </span>
                      <CopyButton text={record.value} />
                    </div>
                    <div className="mt-1 break-all">{record.name}</div>
                    <div className="mt-1 break-all text-muted-foreground">
                      → {record.value}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
      </CardContent>
    </Card>
  );
}

/**
 * IAM Role Section
 */
function IAMRoleSection({ settings }: { settings: CdnSettings }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>IAM Role</CardTitle>
          </div>
          <StatusBadge status="SUCCESS" />
        </div>
        <CardDescription>
          Role used by your application to access storage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Role ARN</span>
          <div className="flex items-center gap-2">
            <code className="max-w-[300px] truncate rounded bg-muted px-2 py-1 font-mono text-xs">
              {settings.roleArn}
            </code>
            <CopyButton text={settings.roleArn} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton
 */
function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * No Storage Setup Message
 */
function NoStorageSetup() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <HardDrive className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
      <h2 className="mb-2 font-semibold text-xl">No Storage Configured</h2>
      <p className="mb-6 max-w-md text-center text-muted-foreground">
        Storage infrastructure has not been deployed yet. Run{" "}
        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
          wraps storage init
        </code>{" "}
        to get started.
      </p>
    </div>
  );
}

/**
 * Storage Settings Component
 */
export function CdnSettings() {
  const [settings, setSettings] = React.useState<CdnSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = sessionStorage.getItem("wraps-auth-token");
      const response = await fetch(`/api/cdn/settings?token=${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setSettings(null);
          return;
        }
        throw new Error("Failed to fetch storage settings");
      }

      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (loading) {
    return <SettingsSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!settings) {
    return <NoStorageSetup />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Storage Settings</h1>
          <p className="text-muted-foreground">
            Manage your S3 bucket and CloudFront CDN configuration
          </p>
        </div>
        <Button onClick={fetchSettings} size="sm" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <BucketSection settings={settings} />
      <CDNSection settings={settings} />
      <IAMRoleSection settings={settings} />
    </div>
  );
}
