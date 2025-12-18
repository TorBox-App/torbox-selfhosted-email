"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_STATUS_LABELS,
  CONTACT_STATUSES,
  type ContactStatus,
  type ContactWithMeta,
} from "@/lib/contacts";
import type { TopicWithMeta } from "@/lib/topics";

type PropertyEntry = {
  key: string;
  value: string;
};

type ContactFormDialogProps = {
  contact?: ContactWithMeta | null;
  isPending: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    email?: string;
    status?: ContactStatus;
    properties?: Record<string, unknown>;
    topicIds?: string[];
  }) => void;
  open: boolean;
  topics: TopicWithMeta[];
};

export function ContactFormDialog({
  contact,
  isPending,
  mode,
  onOpenChange,
  onSubmit,
  open,
  topics,
}: ContactFormDialogProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<ContactStatus>("active");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [properties, setProperties] = useState<PropertyEntry[]>([]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (mode === "edit" && contact) {
        setEmail(contact.email);
        setStatus(contact.status);
        setSelectedTopicIds(
          contact.topics?.filter((t) => t.status === "subscribed").map((t) => t.topicId) || []
        );
        // Convert properties object to array
        setProperties(
          Object.entries(contact.properties || {}).map(([key, value]) => ({
            key,
            value: String(value),
          }))
        );
      } else {
        setEmail("");
        setStatus("active");
        setSelectedTopicIds([]);
        setProperties([]);
      }
    }
  }, [open, mode, contact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Convert properties array back to object
    const propertiesObj = properties.reduce(
      (acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      },
      {} as Record<string, string>
    );

    if (mode === "create") {
      onSubmit({
        email,
        status,
        properties: Object.keys(propertiesObj).length > 0 ? propertiesObj : undefined,
        topicIds: selectedTopicIds,
      });
    } else {
      // For edit, only include properties if they've changed
      const oldPropertiesStr = JSON.stringify(contact?.properties || {});
      const newPropertiesStr = JSON.stringify(propertiesObj);
      const propertiesChanged = oldPropertiesStr !== newPropertiesStr;

      onSubmit({
        email: email !== contact?.email ? email : undefined,
        status: status !== contact?.status ? status : undefined,
        properties: propertiesChanged ? propertiesObj : undefined,
      });
    }
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId]
    );
  };

  const addProperty = () => {
    setProperties((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeProperty = (index: number) => {
    setProperties((prev) => prev.filter((_, i) => i !== index));
  };

  const updateProperty = (index: number, field: "key" | "value", newValue: string) => {
    setProperties((prev) =>
      prev.map((prop, i) => (i === index ? { ...prop, [field]: newValue } : prop))
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Add Contact" : "Edit Contact"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Add a new contact to your audience."
                : "Update the contact's information."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                onValueChange={(value) => setStatus(value as ContactStatus)}
                value={status}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CONTACT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topics (only for create mode) */}
            {mode === "create" && topics.length > 0 && (
              <div className="grid gap-2">
                <Label>Subscribe to topics</Label>
                <div className="max-h-[150px] space-y-2 overflow-y-auto rounded-md border p-3">
                  {topics.map((topic) => (
                    <div className="flex items-center space-x-2" key={topic.id}>
                      <Checkbox
                        checked={selectedTopicIds.includes(topic.id)}
                        id={`topic-${topic.id}`}
                        onCheckedChange={() => toggleTopic(topic.id)}
                      />
                      <Label
                        className="cursor-pointer font-normal"
                        htmlFor={`topic-${topic.id}`}
                      >
                        {topic.name}
                        {topic.description && (
                          <span className="ml-1 text-muted-foreground text-xs">
                            - {topic.description}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Properties */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Custom properties</Label>
                <Button
                  className="h-7 text-xs"
                  onClick={addProperty}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              {properties.length > 0 ? (
                <div className="max-h-[150px] space-y-2 overflow-y-auto rounded-md border p-3">
                  {properties.map((prop, index) => (
                    <div className="flex items-center gap-2" key={index}>
                      <Input
                        className="h-8 flex-1"
                        onChange={(e) => updateProperty(index, "key", e.target.value)}
                        placeholder="key"
                        value={prop.key}
                      />
                      <Input
                        className="h-8 flex-1"
                        onChange={(e) => updateProperty(index, "value", e.target.value)}
                        placeholder="value"
                        value={prop.value}
                      />
                      <Button
                        className="h-8 w-8 shrink-0 p-0"
                        onClick={() => removeProperty(index)}
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  No custom properties. Add key-value pairs like firstName, company, plan, etc.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending || !email} type="submit">
              {isPending
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Add Contact"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
