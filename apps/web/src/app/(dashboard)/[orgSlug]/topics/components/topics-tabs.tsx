"use client";

import type { topicSettings } from "@wraps/db";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wraps/ui/components/ui/tabs";
import { useQueryState } from "nuqs";
import type { TopicWithMeta } from "@/lib/topics";
import { DoubleOptInSettings } from "./double-opt-in-settings";
import { PreferenceCenterSettings } from "./preference-center-settings";
import { TopicsTable } from "./topics-table";

type TopicSettingsType = typeof topicSettings.$inferSelect;

type TopicsTabsProps = {
  orgSlug: string;
  organizationId: string;
  topics: TopicWithMeta[];
  userRole: string;
  settings: TopicSettingsType | null;
  verifiedDomains: string[];
};

export function TopicsTabs({
  orgSlug,
  organizationId,
  topics,
  userRole,
  settings,
  verifiedDomains,
}: TopicsTabsProps) {
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "list",
  });

  return (
    <Tabs onValueChange={setActiveTab} value={activeTab}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="list">Topics</TabsTrigger>
        <TabsTrigger value="double-opt-in">Double Opt-In</TabsTrigger>
        <TabsTrigger value="preference-center">Preference Center</TabsTrigger>
      </TabsList>

      <TabsContent className="mt-6" value="list">
        <TopicsTable
          organizationId={organizationId}
          orgSlug={orgSlug}
          topics={topics}
          userRole={userRole}
        />
      </TabsContent>

      <TabsContent className="mt-6" value="double-opt-in">
        <DoubleOptInSettings
          organizationId={organizationId}
          settings={settings}
          verifiedDomains={verifiedDomains}
        />
      </TabsContent>

      <TabsContent className="mt-6" value="preference-center">
        <PreferenceCenterSettings
          organizationId={organizationId}
          settings={settings}
        />
      </TabsContent>
    </Tabs>
  );
}
