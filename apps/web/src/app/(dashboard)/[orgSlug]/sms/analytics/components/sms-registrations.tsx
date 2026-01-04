"use client";

import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSMSStatus } from "../hooks/use-sms-analytics";

function getRegistrationStatusInfo(status: string): {
  icon: React.ReactNode;
  color: string;
  label: string;
  description: string;
} {
  switch (status.toUpperCase()) {
    case "CREATED":
      return {
        icon: <Clock className="h-4 w-4" />,
        color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
        label: "Created",
        description: "Registration created, not yet submitted",
      };
    case "SUBMITTED":
      return {
        icon: <Clock className="h-4 w-4" />,
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        label: "Submitted",
        description: "Registration submitted, awaiting review",
      };
    case "REVIEWING":
      return {
        icon: <Clock className="h-4 w-4" />,
        color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        label: "Reviewing",
        description: "Currently under carrier review (15 business days)",
      };
    case "COMPLETE":
    case "VERIFIED":
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        color: "bg-green-500/10 text-green-500 border-green-500/20",
        label: "Verified",
        description: "Registration approved, ready to send",
      };
    case "REQUIRES_UPDATES":
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        label: "Needs Updates",
        description: "Additional information required",
      };
    case "DENIED":
    case "CLOSED":
      return {
        icon: <XCircle className="h-4 w-4" />,
        color: "bg-red-500/10 text-red-500 border-red-500/20",
        label: status === "DENIED" ? "Denied" : "Closed",
        description:
          status === "DENIED"
            ? "Registration was denied"
            : "Registration was closed",
      };
    default:
      return {
        icon: <Clock className="h-4 w-4" />,
        color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
        label: status,
        description: "Unknown status",
      };
  }
}

function getRegistrationTypeBadge(type: string): {
  label: string;
  color: string;
} {
  switch (type.toUpperCase()) {
    case "TOLL_FREE":
      return {
        label: "Toll-Free",
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      };
    case "TEN_DLC_BRAND":
      return {
        label: "10DLC Brand",
        color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      };
    case "TEN_DLC_CAMPAIGN":
      return {
        label: "10DLC Campaign",
        color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      };
    default:
      return {
        label: type,
        color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      };
  }
}

function formatDate(dateString: string): string {
  if (!dateString) {
    return "N/A";
  }
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SMSRegistrations({ orgSlug }: { orgSlug: string }) {
  const { data, isLoading, error } = useSMSStatus(orgSlug);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Registrations
          </CardTitle>
          <CardDescription>
            Toll-free and 10DLC registration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Registrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">Failed to load registration status</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.registrations || data.registrations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Registrations
          </CardTitle>
          <CardDescription>
            Toll-free and 10DLC registration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileCheck className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-medium text-lg">No Registrations</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Toll-free and 10DLC numbers require registration before sending
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              Run{" "}
              <code className="rounded bg-muted px-1">wraps sms register</code>{" "}
              to start
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Registrations
        </CardTitle>
        <CardDescription>
          Toll-free and 10DLC registration status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.registrations.map((reg) => {
            const statusInfo = getRegistrationStatusInfo(
              reg.registrationStatus
            );
            const typeInfo = getRegistrationTypeBadge(reg.registrationType);
            return (
              <div className="rounded-lg border p-4" key={reg.registrationArn}>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={typeInfo.color} variant="outline">
                        {typeInfo.label}
                      </Badge>
                      <Badge className={statusInfo.color} variant="outline">
                        {statusInfo.icon}
                        <span className="ml-1">{statusInfo.label}</span>
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {statusInfo.description}
                    </p>
                    <p className="font-mono text-muted-foreground text-xs">
                      ID: {reg.registrationId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-sm">
                      Created {formatDate(reg.createdTimestamp)}
                    </p>
                    {reg.approvedVersionNumber && (
                      <p className="mt-1 text-green-600 text-xs">
                        Approved v{reg.approvedVersionNumber}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
