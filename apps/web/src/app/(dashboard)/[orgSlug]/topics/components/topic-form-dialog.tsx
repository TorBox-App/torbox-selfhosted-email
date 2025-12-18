"use client";

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
import { Textarea } from "@/components/ui/textarea";
import type { TopicWithMeta } from "@/lib/topics";
import { generateSlug } from "@/lib/topics";

type TopicFormDialogProps = {
  isPending: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name?: string;
    slug?: string;
    description?: string | null;
    public?: boolean;
    doubleOptIn?: boolean;
  }) => void;
  open: boolean;
  topic?: TopicWithMeta | null;
};

export function TopicFormDialog({
  isPending,
  mode,
  onOpenChange,
  onSubmit,
  open,
  topic,
}: TopicFormDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [doubleOptIn, setDoubleOptIn] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (mode === "edit" && topic) {
        setName(topic.name);
        setSlug(topic.slug);
        setDescription(topic.description || "");
        setIsPublic(topic.public);
        setDoubleOptIn(topic.doubleOptIn);
        setSlugManuallyEdited(true); // Don't auto-update slug in edit mode
      } else {
        setName("");
        setSlug("");
        setDescription("");
        setIsPublic(true);
        setDoubleOptIn(false);
        setSlugManuallyEdited(false);
      }
    }
  }, [open, mode, topic]);

  // Auto-generate slug from name (only if not manually edited)
  useEffect(() => {
    if (!slugManuallyEdited && mode === "create") {
      setSlug(generateSlug(name));
    }
  }, [name, slugManuallyEdited, mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "create") {
      onSubmit({
        name,
        slug,
        description: description || undefined,
        public: isPublic,
        doubleOptIn,
      });
    } else {
      onSubmit({
        name: name !== topic?.name ? name : undefined,
        slug: slug !== topic?.slug ? slug : undefined,
        description:
          description !== (topic?.description || "")
            ? description || null
            : undefined,
        public: isPublic !== topic?.public ? isPublic : undefined,
        doubleOptIn:
          doubleOptIn !== topic?.doubleOptIn ? doubleOptIn : undefined,
      });
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Create Topic" : "Edit Topic"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Create a new subscription topic for your audience."
                : "Update the topic's settings."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Product Updates"
                required
                value={name}
              />
            </div>

            {/* Slug */}
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">/</span>
                <Input
                  id="slug"
                  onChange={(e) => {
                    setSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    );
                    setSlugManuallyEdited(true);
                  }}
                  placeholder="product-updates"
                  required
                  value={slug}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Used in preference center URLs and API
              </p>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Get notified about new features and updates"
                rows={2}
                value={description}
              />
              <p className="text-muted-foreground text-xs">
                Shown in the preference center
              </p>
            </div>

            {/* Settings */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  checked={isPublic}
                  id="public"
                  onCheckedChange={(checked) => setIsPublic(checked === true)}
                />
                <div className="space-y-1">
                  <Label
                    className="cursor-pointer font-normal"
                    htmlFor="public"
                  >
                    Public topic
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Visible in the preference center for contacts to
                    subscribe/unsubscribe
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  checked={doubleOptIn}
                  id="doubleOptIn"
                  onCheckedChange={(checked) =>
                    setDoubleOptIn(checked === true)
                  }
                />
                <div className="space-y-1">
                  <Label
                    className="cursor-pointer font-normal"
                    htmlFor="doubleOptIn"
                  >
                    Require double opt-in
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Contacts must confirm their subscription via email
                  </p>
                </div>
              </div>
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
            <Button disabled={isPending || !name || !slug} type="submit">
              {isPending
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Create Topic"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
