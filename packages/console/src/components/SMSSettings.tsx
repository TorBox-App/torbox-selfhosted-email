import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wraps/ui/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@wraps/ui/components/ui/alert-dialog";
import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { Separator } from "@wraps/ui/components/ui/separator";
import { Skeleton } from "@wraps/ui/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  MessageSquare,
  Phone,
  Shield,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

type SMSSettings = {
  phoneNumber?: {
    number: string;
    arn?: string;
    type:
      | "simulator"
      | "toll-free"
      | "10dlc"
      | "short-code"
      | "long-code"
      | string;
    status: string;
    registrationStatus?: string;
    capabilities: string[];
    monthlyLeasingPrice?: string;
  };
  configurationSet?: {
    name: string;
    sendingEnabled: boolean;
    defaultMessageType?: string;
    protectConfigurationId?: string;
  };
  protectConfiguration?: {
    enabled: boolean;
    allowedCountries: string[];
    aitFiltering: boolean;
  };
  optOutList?: {
    name: string;
    arn: string;
  };
  eventTracking?: {
    enabled: boolean;
    dynamoDBHistory: boolean;
    archiveRetention?: string;
  };
  region: string;
};

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE" || status === "SUCCESS";

  return (
    <Badge
      className={
        isActive
          ? "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
      }
      variant="outline"
    >
      {isActive ? (
        <CheckCircle2 className="mr-1 h-3 w-3" />
      ) : (
        <AlertCircle className="mr-1 h-3 w-3" />
      )}
      {status}
    </Badge>
  );
}

function PhoneNumberSection({
  phoneNumber,
}: {
  phoneNumber?: SMSSettings["phoneNumber"];
}) {
  if (!phoneNumber) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Number
          </CardTitle>
          <CardDescription>No phone number configured</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith("+1") && phone.length === 12) {
      return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "simulator":
        return "Simulator";
      case "toll-free":
        return "Toll-Free";
      case "10dlc":
        return "10DLC";
      case "short-code":
        return "Short Code";
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Phone Number
        </CardTitle>
        <CardDescription>Your SMS sending number</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium font-mono text-lg">
              {formatPhoneNumber(phoneNumber.number)}
            </p>
            <p className="text-muted-foreground text-sm">
              {getTypeLabel(phoneNumber.type)}
            </p>
          </div>
          <StatusBadge status={phoneNumber.status} />
        </div>

        {phoneNumber.registrationStatus && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Registration Status</p>
                <p className="text-muted-foreground text-sm">
                  {phoneNumber.type === "toll-free"
                    ? "Toll-free verification"
                    : "Campaign registration"}
                </p>
              </div>
              <StatusBadge status={phoneNumber.registrationStatus} />
            </div>
          </>
        )}

        {phoneNumber.capabilities.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="font-medium text-sm">Capabilities</p>
              <div className="flex flex-wrap gap-2">
                {phoneNumber.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {phoneNumber.monthlyLeasingPrice && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Monthly Cost</p>
                <p className="text-muted-foreground text-sm">
                  Phone number lease
                </p>
              </div>
              <span className="font-mono text-sm">
                ${phoneNumber.monthlyLeasingPrice}/mo
              </span>
            </div>
          </>
        )}

        {phoneNumber.type === "simulator" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Simulator Mode</AlertTitle>
            <AlertDescription>
              This number is for testing only. Messages are simulated and not
              actually sent. Upgrade to a toll-free number for production use.
            </AlertDescription>
          </Alert>
        )}

        {phoneNumber.type === "toll-free" &&
          phoneNumber.registrationStatus !== "VERIFIED" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Registration Required</AlertTitle>
              <AlertDescription>
                Toll-free numbers require registration before they can send
                messages. Run <code>wraps sms register</code> to complete
                registration.
              </AlertDescription>
            </Alert>
          )}
      </CardContent>
    </Card>
  );
}

function ProtectConfigSection({
  protectConfig,
}: {
  protectConfig?: SMSSettings["protectConfiguration"];
}) {
  if (!protectConfig?.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Fraud Protection
          </CardTitle>
          <CardDescription>Not configured</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Fraud Protection
        </CardTitle>
        <CardDescription>
          Country restrictions and AIT filtering
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Status</p>
            <p className="text-muted-foreground text-sm">
              Protect configuration active
            </p>
          </div>
          <Badge
            className="border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
            variant="outline"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Enabled
          </Badge>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium text-sm">Allowed Countries</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {protectConfig.allowedCountries.map((country) => (
              <Badge key={country} variant="secondary">
                {country}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Messages can only be sent to these countries. All others are
            blocked.
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">AIT Filtering</p>
            <p className="text-muted-foreground text-sm">
              {protectConfig.aitFiltering
                ? "Enabled - adds per-message cost"
                : "Disabled - no extra cost"}
            </p>
          </div>
          <Badge variant={protectConfig.aitFiltering ? "default" : "secondary"}>
            {protectConfig.aitFiltering ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigurationSetSection({
  configSet,
  onRefresh,
}: {
  configSet?: SMSSettings["configurationSet"];
  onRefresh?: () => Promise<void>;
}) {
  const [sendingDialogOpen, setSendingDialogOpen] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  if (!configSet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Configuration Set
          </CardTitle>
          <CardDescription>No configuration set found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleToggleSending = async () => {
    setIsUpdating(true);
    try {
      const token = sessionStorage.getItem("wraps-auth-token");
      const newState = !configSet.sendingEnabled;

      const response = await fetch(`/api/sms/settings/sending?token=${token}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: newState }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update: ${response.statusText}`);
      }

      setSendingDialogOpen(false);
      toast.success(newState ? "SMS sending enabled" : "SMS sending disabled");

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to toggle sending:", error);
      toast.error("Failed to update setting", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Configuration Set
        </CardTitle>
        <CardDescription>SMS sending configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium">{configSet.name}</p>
          <p className="text-muted-foreground text-sm">
            Configuration Set Name
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-0.5">
            <p className="font-medium text-sm">SMS Sending</p>
            <p className="text-muted-foreground text-sm">
              {configSet.sendingEnabled
                ? "Messages can be sent"
                : "Message sending is disabled"}
            </p>
          </div>
          <Button
            onClick={() => setSendingDialogOpen(true)}
            size="sm"
            variant={configSet.sendingEnabled ? "destructive" : "default"}
          >
            {configSet.sendingEnabled ? "Disable" : "Enable"}
          </Button>
        </div>

        <AlertDialog
          onOpenChange={setSendingDialogOpen}
          open={sendingDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {configSet.sendingEnabled
                  ? "Disable SMS sending?"
                  : "Enable SMS sending?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {configSet.sendingEnabled
                  ? "All outgoing SMS messages will be blocked until you re-enable sending."
                  : "This will allow SMS messages to be sent through this configuration set."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdating}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isUpdating}
                onClick={handleToggleSending}
              >
                {isUpdating
                  ? "Updating..."
                  : configSet.sendingEnabled
                    ? "Disable sending"
                    : "Enable sending"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function EventTrackingSection({
  eventTracking,
}: {
  eventTracking?: SMSSettings["eventTracking"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Tracking</CardTitle>
        <CardDescription>Message history and event storage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Event Tracking</p>
            <p className="text-muted-foreground text-sm">
              {eventTracking?.enabled
                ? "Tracking delivery events"
                : "Event tracking disabled"}
            </p>
          </div>
          <Badge variant={eventTracking?.enabled ? "default" : "secondary"}>
            {eventTracking?.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        {eventTracking?.enabled && (
          <>
            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Message History</p>
                <p className="text-muted-foreground text-sm">
                  {eventTracking.dynamoDBHistory
                    ? "Stored in DynamoDB"
                    : "Not stored"}
                </p>
              </div>
              <Badge
                variant={
                  eventTracking.dynamoDBHistory ? "default" : "secondary"
                }
              >
                {eventTracking.dynamoDBHistory ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            {eventTracking.archiveRetention && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Retention Period</p>
                  <p className="text-muted-foreground text-sm">
                    How long message history is kept
                  </p>
                </div>
                <Badge variant="outline">
                  {eventTracking.archiveRetention}
                </Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SMSSettings() {
  const [settings, setSettings] = React.useState<SMSSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSettings = React.useCallback(async () => {
    try {
      setLoading(true);

      const token = sessionStorage.getItem("wraps-auth-token");

      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`/api/sms/settings?token=${token}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch SMS settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (loading) {
    return (
      <>
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">
            SMS Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Configure your SMS settings and preferences
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2 h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2 h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">
            SMS Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Configure your SMS settings and preferences
          </p>
        </div>

        <Alert className="mt-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Settings</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">SMS Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure your SMS settings and preferences
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <PhoneNumberSection phoneNumber={settings?.phoneNumber} />
        <ConfigurationSetSection
          configSet={settings?.configurationSet}
          onRefresh={fetchSettings}
        />
        <ProtectConfigSection protectConfig={settings?.protectConfiguration} />
        <EventTrackingSection eventTracking={settings?.eventTracking} />
      </div>
    </>
  );
}
