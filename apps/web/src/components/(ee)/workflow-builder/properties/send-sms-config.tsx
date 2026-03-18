"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NodeConfigProps } from "./index";

export function SendSmsConfig({ config, onChange }: NodeConfigProps) {
  if (config.type !== "send_sms") {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="sms-body">Message</Label>
      <Textarea
        id="sms-body"
        onChange={(e) => onChange({ body: e.target.value })}
        placeholder="Enter your SMS message..."
        rows={4}
        value={config.body || ""}
      />
      <p className="text-muted-foreground text-xs">
        {config.body?.length || 0} / 160 characters
      </p>
    </div>
  );
}
