"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wraps/ui/components/ui/tabs";
import { useQueryState } from "nuqs";
import { OrganizationSettingsApiKeys } from "@/components/organization-settings-api-keys";
import { OrganizationSettingsAwsAccounts } from "@/components/organization-settings-aws-accounts";
import { OrganizationSettingsBilling } from "@/components/organization-settings-billing";
import { OrganizationSettingsBrandKits } from "@/components/organization-settings-brand-kits";
import { OrganizationSettingsGeneral } from "@/components/organization-settings-general";
import { OrganizationSettingsMembers } from "@/components/organization-settings-members";

type OrganizationSettingsTabsProps = {
  organization: {
    id: string;
    name: string;
    slug: string | null;
    logo: string | null;
  };
  userRole: string;
  planId?: string;
};

export function OrganizationSettingsTabs({
  organization,
  userRole,
  planId,
}: OrganizationSettingsTabsProps) {
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "general",
  });

  return (
    <Tabs onValueChange={setActiveTab} value={activeTab}>
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="brand-kits">Brand Kits</TabsTrigger>
        <TabsTrigger value="aws-accounts">AWS Accounts</TabsTrigger>
        <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>
      <TabsContent className="mt-6" value="general">
        <OrganizationSettingsGeneral
          organization={organization}
          userRole={userRole}
        />
      </TabsContent>
      <TabsContent className="mt-6" value="brand-kits">
        <OrganizationSettingsBrandKits
          organization={organization}
          userRole={userRole}
        />
      </TabsContent>
      <TabsContent className="mt-6" value="aws-accounts">
        <OrganizationSettingsAwsAccounts
          organization={organization}
          planId={planId}
          userRole={userRole}
        />
      </TabsContent>
      <TabsContent className="mt-6" value="api-keys">
        <OrganizationSettingsApiKeys
          organization={organization}
          userRole={userRole}
        />
      </TabsContent>
      <TabsContent className="mt-6" value="members">
        <OrganizationSettingsMembers
          organization={organization}
          userRole={userRole}
        />
      </TabsContent>
      <TabsContent className="mt-6" value="billing">
        <OrganizationSettingsBilling
          organization={organization}
          userRole={userRole}
        />
      </TabsContent>
    </Tabs>
  );
}
