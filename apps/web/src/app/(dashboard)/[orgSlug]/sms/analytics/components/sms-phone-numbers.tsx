"use client";

import { AlertCircle, MessageSquareMore, Phone } from "lucide-react";
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

function formatPhoneNumber(phone: string): string {
  // Format US phone numbers nicely
  if (phone.startsWith("+1") && phone.length === 12) {
    return `+1 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
  }
  return phone;
}

function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "PENDING":
    case "PENDING_REGISTRATION":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "DELETED":
    case "DISASSOCIATED":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}

function getNumberTypeBadge(type: string): { label: string; color: string } {
  switch (type.toUpperCase()) {
    case "TOLL_FREE":
      return {
        label: "Toll-Free",
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      };
    case "TEN_DLC":
      return {
        label: "10DLC",
        color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      };
    case "SHORT_CODE":
      return {
        label: "Short Code",
        color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      };
    case "SIMULATOR":
      return {
        label: "Simulator",
        color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      };
    default:
      return {
        label: type,
        color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      };
  }
}

export function SMSPhoneNumbers({ orgSlug }: { orgSlug: string }) {
  const { data, isLoading, error } = useSMSStatus(orgSlug);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Numbers
          </CardTitle>
          <CardDescription>Your provisioned SMS phone numbers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
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
            <Phone className="h-5 w-5" />
            Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">Failed to load phone numbers</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.hasSMSInfrastructure || data.phoneNumbers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Numbers
          </CardTitle>
          <CardDescription>Your provisioned SMS phone numbers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Phone className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-medium text-lg">No Phone Numbers</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Run <code className="rounded bg-muted px-1">wraps sms init</code>{" "}
              to provision a phone number
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
          <Phone className="h-5 w-5" />
          Phone Numbers
        </CardTitle>
        <CardDescription>Your provisioned SMS phone numbers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.phoneNumbers.map((phone) => {
            const typeInfo = getNumberTypeBadge(phone.numberType);
            return (
              <div
                className="flex items-center justify-between rounded-lg border p-4"
                key={phone.phoneNumberArn}
              >
                <div className="space-y-1">
                  <p className="font-mono font-semibold text-lg">
                    {formatPhoneNumber(phone.phoneNumber)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge className={typeInfo.color} variant="outline">
                      {typeInfo.label}
                    </Badge>
                    <Badge
                      className={getStatusColor(phone.status)}
                      variant="outline"
                    >
                      {phone.status}
                    </Badge>
                    {phone.twoWayEnabled && (
                      <Badge
                        className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                        variant="outline"
                      >
                        <MessageSquareMore className="mr-1 h-3 w-3" />
                        Two-Way
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-sm">
                    ${phone.monthlyLeasingPrice}/mo
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phone.isoCountryCode} • {phone.messageType}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
