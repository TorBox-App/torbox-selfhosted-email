"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflowData } from "../workflow-data-context";
import type { NodeConfigProps } from "./index";

export type TopicConfigProps = NodeConfigProps & {
  onTypeChange: (type: "subscribe_topic" | "unsubscribe_topic") => void;
};

export function TopicConfig({
  config,
  onChange,
  onTypeChange,
}: TopicConfigProps) {
  const { topics } = useWorkflowData();

  if (
    config.type !== "subscribe_topic" &&
    config.type !== "unsubscribe_topic"
  ) {
    return null;
  }

  const isSubscribe = config.type === "subscribe_topic";

  return (
    <>
      <div className="space-y-2">
        <Label>Action</Label>
        <Select
          onValueChange={(value) =>
            onTypeChange(value as "subscribe_topic" | "unsubscribe_topic")
          }
          value={config.type}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subscribe_topic">Subscribe</SelectItem>
            <SelectItem value="unsubscribe_topic">Unsubscribe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Topic</Label>
        <Select
          onValueChange={(value) => onChange({ topicId: value })}
          value={config.topicId || ""}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a topic" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {topics.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No topics available. Create one in Settings &gt; Topics.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Channel</Label>
        <Select
          onValueChange={(value) =>
            onChange({ channel: value as "email" | "sms" })
          }
          value={config.channel || "email"}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {isSubscribe
            ? "Subscribe the contact to receive messages via this channel."
            : "Unsubscribe the contact from receiving messages via this channel."}
        </p>
      </div>
    </>
  );
}
