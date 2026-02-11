"use client";

import {
  CheckCircle2Icon,
  GlobeIcon,
  LinkIcon,
  MailIcon,
  ServerIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SetupStatus } from "../page";

type InfrastructureStatusCardProps = {
  setupStatus: SetupStatus;
  orgSlug: string;
};

export function InfrastructureStatusCard({
  setupStatus,
}: InfrastructureStatusCardProps) {
  const { hasAwsAccount, hasPlatformConnection, awsRegion, verifiedDomains } =
    setupStatus;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Infrastructure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ServerIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">AWS Account</span>
          </div>
          {hasAwsAccount ? (
            <Badge
              className="text-green-600 border-green-200 bg-green-50"
              variant="outline"
            >
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Platform Events</span>
          </div>
          {hasPlatformConnection ? (
            <Badge
              className="text-green-600 border-green-200 bg-green-50"
              variant="outline"
            >
              Streaming
            </Badge>
          ) : (
            <Badge variant="secondary">Not configured</Badge>
          )}
        </div>

        {awsRegion && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GlobeIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Region</span>
            </div>
            <span className="text-sm font-mono">{awsRegion}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MailIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Verified Domains</span>
          </div>
          <span className="text-sm">{verifiedDomains.length}</span>
        </div>

        {verifiedDomains.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Domains</p>
            <div className="space-y-1">
              {verifiedDomains.map((domain) => (
                <div className="flex items-center gap-2 text-sm" key={domain}>
                  <CheckCircle2Icon className="h-3.5 w-3.5 text-green-600" />
                  <span className="font-mono text-xs">{domain}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
