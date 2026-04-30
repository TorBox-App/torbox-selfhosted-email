"use client";

import { Label } from "@wraps/ui/components/ui/label";
import {
  KeyRound,
  Mail,
  Megaphone,
  MessageSquare,
  Newspaper,
  Package,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateTemplate } from "@/hooks/use-template-queries";
import { compileTemplate } from "@/lib/compile-template";
import {
  STARTER_TEMPLATES,
  type StarterTemplate,
} from "@/lib/starter-templates";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ReactNode> = {
  Mail: <Mail className="h-5 w-5" />,
  Newspaper: <Newspaper className="h-5 w-5" />,
  Megaphone: <Megaphone className="h-5 w-5" />,
  KeyRound: <KeyRound className="h-5 w-5" />,
  Package: <Package className="h-5 w-5" />,
  Rocket: <Rocket className="h-5 w-5" />,
};

type TemplateGalleryProps = {
  orgSlug: string;
};

export function TemplateGallery({ orgSlug }: TemplateGalleryProps) {
  const router = useRouter();
  const createTemplate = useCreateTemplate(orgSlug);
  const [selectedChannel, setSelectedChannel] = useState<"email" | "sms">(
    "email"
  );
  const [smsName, setSmsName] = useState("");
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (selectedChannel === "email") {
      posthog.capture("template_gallery_viewed", {
        organization_slug: orgSlug,
        starter_template_count: STARTER_TEMPLATES.length,
        channel: "email",
      });
    }
  }, [selectedChannel, orgSlug]);

  const handleStarterClick = async (starter: StarterTemplate) => {
    setLoadingTemplateId(starter.id);
    try {
      const compiled = await compileTemplate(starter.source);

      const template = await createTemplate.mutateAsync({
        name: starter.name,
        source: starter.source,
        compiledHtml: compiled.compiledHtml,
        subject: compiled.subject,
        previewText: compiled.previewText,
        emailType:
          compiled.emailType === "transactional"
            ? "transactional"
            : "marketing",
      });

      posthog.capture("template_created", {
        template_id: template.id,
        template_name: starter.name,
        has_description: false,
        channel: "email",
        organization_slug: orgSlug,
        creation_path: "gallery_starter",
        starter_template_id: starter.id,
        starter_template_name: starter.name,
      });

      router.push(`/${orgSlug}/emails/templates/${template.id}`);
    } catch (err) {
      setLoadingTemplateId(null);
      toast.error(
        err instanceof Error ? err.message : "Failed to create template"
      );
    }
  };

  const handleQuickCreate = async (loadingId: string, creationPath: string) => {
    setLoadingTemplateId(loadingId);
    try {
      const template = await createTemplate.mutateAsync({
        name: "Untitled Email",
      });

      posthog.capture("template_created", {
        template_id: template.id,
        template_name: "Untitled Email",
        has_description: false,
        channel: "email",
        organization_slug: orgSlug,
        creation_path: creationPath,
      });

      router.push(`/${orgSlug}/emails/templates/${template.id}`);
    } catch (err) {
      setLoadingTemplateId(null);
      toast.error(
        err instanceof Error ? err.message : "Failed to create template"
      );
    }
  };

  const handleSmsCreate = async () => {
    if (!smsName.trim()) {
      return;
    }
    try {
      const template = await createTemplate.mutateAsync({
        name: smsName.trim(),
        channel: "sms",
      });

      posthog.capture("template_created", {
        template_id: template.id,
        template_name: smsName.trim(),
        has_description: false,
        channel: "sms",
        organization_slug: orgSlug,
        creation_path: "form",
      });

      router.push(`/${orgSlug}/emails/templates/${template.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create template"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Channel toggle */}
      <div className="space-y-2">
        <Label>Channel</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors",
              selectedChannel === "email"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/25"
            )}
            onClick={() => setSelectedChannel("email")}
            type="button"
          >
            <Mail
              className={cn(
                "h-5 w-5",
                selectedChannel === "email"
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            />
            <div>
              <p className="font-medium text-sm">Email</p>
              <p className="text-muted-foreground text-xs">
                Rich HTML templates
              </p>
            </div>
          </button>
          <button
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors",
              selectedChannel === "sms"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/25"
            )}
            onClick={() => setSelectedChannel("sms")}
            type="button"
          >
            <MessageSquare
              className={cn(
                "h-5 w-5",
                selectedChannel === "sms"
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            />
            <div>
              <p className="font-medium text-sm">SMS</p>
              <p className="text-muted-foreground text-xs">
                Plain text messages
              </p>
            </div>
          </button>
        </div>
      </div>

      {selectedChannel === "email" ? (
        <>
          {/* Starter template grid */}
          <div>
            <p className="mb-3 font-medium text-muted-foreground text-sm">
              Choose a starter template
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STARTER_TEMPLATES.map((starter) => (
                <button
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent",
                    loadingTemplateId === starter.id &&
                      "pointer-events-none opacity-70"
                  )}
                  disabled={loadingTemplateId !== null}
                  key={starter.id}
                  onClick={() => handleStarterClick(starter)}
                  type="button"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {ICON_MAP[starter.iconName] ?? <Mail className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{starter.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {starter.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-muted-foreground text-xs">
                or
              </span>
            </div>
          </div>

          {/* AI + Blank options */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              className="gap-2"
              disabled={loadingTemplateId !== null}
              onClick={() => handleQuickCreate("ai", "gallery_ai")}
              size="lg"
            >
              <Sparkles className="h-4 w-4" />
              Design with AI
            </Button>
            <Button
              disabled={loadingTemplateId !== null}
              onClick={() => handleQuickCreate("blank", "gallery_blank")}
              size="lg"
              variant="ghost"
            >
              Start from scratch
            </Button>
          </div>
        </>
      ) : (
        /* SMS: simple name form */
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sms-name">Template Name</Label>
            <Input
              id="sms-name"
              onChange={(e) => setSmsName(e.target.value)}
              placeholder="Order Confirmation SMS"
              value={smsName}
            />
          </div>
          <Button
            disabled={!smsName.trim() || createTemplate.isPending}
            onClick={handleSmsCreate}
          >
            {createTemplate.isPending ? "Creating..." : "Create Template"}
          </Button>
        </div>
      )}
    </div>
  );
}
