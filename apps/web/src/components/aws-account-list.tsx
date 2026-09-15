import type { awsAccount } from "@wraps/db";
import { Badge } from "@wraps/ui/components/ui/badge";
import { Card, CardContent } from "@wraps/ui/components/ui/card";
import type { InferSelectModel } from "drizzle-orm";
import { SelfhostConnectInstructions } from "@/components/selfhost-connect-instructions";
import { Button } from "@/components/ui/button";

type AWSAccountListProps = {
  accounts: Array<
    InferSelectModel<typeof awsAccount> & {
      permissions: {
        canView: boolean;
        canSend: boolean;
        canManage: boolean;
      };
    }
  >;
  organizationId: string;
  orgSlug?: string;
  /**
   * True on self-hosted deployments. The repair flow is not offered there —
   * it rewrites a role trusting the Wraps platform account.
   */
  selfHosted: boolean;
};

export function AWSAccountList({
  accounts,
  organizationId,
  orgSlug,
  selfHosted,
}: AWSAccountListProps) {
  // Use slug-based URLs if orgSlug is provided, otherwise fall back to old format
  const baseUrl = orgSlug
    ? `/${orgSlug}/settings/aws-accounts`
    : `/dashboard/organizations/${organizationId}/settings/aws-accounts`;

  const canManageAny = accounts.some(
    (account) => account.permissions.canManage
  );

  return (
    <div className="space-y-4">
      {accounts.map(({ permissions, ...account }) => (
        <Card key={account.id}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{account.name}</h3>
                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                  <span className="font-mono">{account.accountId}</span>
                  <span>•</span>
                  <span>{account.region}</span>
                </div>
              </div>

              {account.isVerified && <Badge variant="success">Verified</Badge>}
            </div>

            {/* Permissions */}
            <div className="mt-4">
              <p className="mb-2 text-muted-foreground text-sm">Your access:</p>
              <div className="flex gap-2">
                {permissions.canView && <Badge variant="info">View</Badge>}
                {permissions.canSend && <Badge variant="success">Send</Badge>}
                {permissions.canManage && <Badge variant="brand">Manage</Badge>}
                {!(
                  permissions.canView ||
                  permissions.canSend ||
                  permissions.canManage
                ) && (
                  <span className="text-muted-foreground text-sm">
                    No access
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            {permissions.canView && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a href={`${baseUrl}/${account.id}`}>View Details</a>
                </Button>
                {permissions.canManage && (
                  <>
                    <Button asChild variant="outline">
                      <a href={`${baseUrl}/${account.id}/permissions`}>
                        Manage Permissions
                      </a>
                    </Button>
                    {selfHosted ? null : (
                      <Button asChild size="sm" variant="ghost">
                        {/* Points at the detail page rather than a
                            CloudFormation quick-create link: this account is
                            already connected, and quick-create can only
                            create. See buildPlatformCloudFormationUrl. */}
                        <a
                          href={`${baseUrl}/${account.id}#iam-role`}
                          title="Rewrite this role's trust policy and permissions"
                        >
                          Repair IAM Role
                        </a>
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {selfHosted && canManageAny ? <SelfhostConnectInstructions /> : null}
    </div>
  );
}
