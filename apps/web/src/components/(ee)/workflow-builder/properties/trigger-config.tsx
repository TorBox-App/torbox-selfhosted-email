"use client";

import Link from "next/link";

import { Input } from "@/components/ui/input";
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

export function TriggerConfig({ config, onChange, orgSlug }: NodeConfigProps) {
  const { topics, segments } = useWorkflowData();

  if (config.type !== "trigger") {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Select
          onValueChange={(value) =>
            onChange({ triggerType: value as typeof config.triggerType })
          }
          value={config.triggerType}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contact_created">Contact Created</SelectItem>
            <SelectItem value="contact_updated">Contact Updated</SelectItem>
            <SelectItem value="event">Custom Event</SelectItem>
            <SelectItem value="segment_entry">Segment Entry</SelectItem>
            <SelectItem value="segment_exit">Segment Exit</SelectItem>
            <SelectItem value="topic_subscribed">Topic Subscribed</SelectItem>
            <SelectItem value="topic_unsubscribed">
              Topic Unsubscribed
            </SelectItem>
            <SelectItem value="schedule">Schedule</SelectItem>
            <SelectItem value="api">API Trigger</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.triggerType === "event" && (
        <div className="space-y-2">
          <Label htmlFor="event-name">Event Name</Label>
          <Input
            id="event-name"
            onChange={(e) => onChange({ eventName: e.target.value })}
            placeholder="e.g., user.signed_up"
            value={config.eventName || ""}
          />
          <p className="text-muted-foreground text-xs">
            The event that starts this workflow. Use your API to trigger it.
          </p>
        </div>
      )}

      {(config.triggerType === "segment_entry" ||
        config.triggerType === "segment_exit") && (
        <div className="space-y-2">
          <Label>Segment</Label>
          {segments.length > 0 ? (
            <>
              <Select
                onValueChange={(value) => onChange({ segmentId: value })}
                value={config.segmentId || ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a segment" />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {config.triggerType === "segment_entry"
                  ? "Workflow starts when a contact enters this segment."
                  : "Workflow starts when a contact exits this segment."}
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-center">
              <p className="text-muted-foreground text-sm">No segments yet</p>
              <Link
                className="text-primary text-sm hover:underline"
                href={`/${orgSlug}/contacts/segments`}
              >
                Create a segment
              </Link>
            </div>
          )}
        </div>
      )}

      {(config.triggerType === "topic_subscribed" ||
        config.triggerType === "topic_unsubscribed") && (
        <div className="space-y-2">
          <Label>Topic</Label>
          {topics.length > 0 ? (
            <>
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
              <p className="text-muted-foreground text-xs">
                {config.triggerType === "topic_subscribed"
                  ? "Workflow starts when a contact subscribes to this topic."
                  : "Workflow starts when a contact unsubscribes from this topic."}
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-center">
              <p className="text-muted-foreground text-sm">No topics yet</p>
              <Link
                className="text-primary text-sm hover:underline"
                href={`/${orgSlug}/topics`}
              >
                Create a topic
              </Link>
            </div>
          )}
        </div>
      )}

      {config.triggerType === "schedule" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="schedule-cron">Schedule (Cron)</Label>
            <Input
              id="schedule-cron"
              onChange={(e) => onChange({ schedule: e.target.value })}
              placeholder="e.g., 0 9 * * 1 (Monday 9am)"
              value={config.schedule || ""}
            />
            <p className="text-muted-foreground text-xs">
              Cron expression for when to run this workflow. Common patterns:
            </p>
            <ul className="ml-4 list-disc text-muted-foreground text-xs">
              <li>0 9 * * * - Daily at 9am</li>
              <li>0 9 * * 1 - Monday at 9am</li>
              <li>0 0 1 * * - First of month</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-timezone">Timezone</Label>
            <Select
              onValueChange={(value) => onChange({ timezone: value })}
              value={config.timezone || "UTC"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Los_Angeles">
                  Pacific Time
                </SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Europe/Paris">Paris</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                <SelectItem value="Australia/Sydney">Sydney</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </>
  );
}
