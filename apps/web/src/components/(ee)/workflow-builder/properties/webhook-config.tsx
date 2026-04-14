"use client";

import { Label } from "@wraps/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wraps/ui/components/ui/select";
import { Textarea } from "@wraps/ui/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { NodeConfigProps } from "./index";

export function WebhookConfig({ config, onChange }: NodeConfigProps) {
  if (config.type !== "webhook") {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="webhook-url">URL</Label>
        <Input
          id="webhook-url"
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://api.example.com/webhook"
          type="url"
          value={config.url || ""}
        />
      </div>

      <div className="space-y-2">
        <Label>Method</Label>
        <Select
          onValueChange={(value) => onChange({ method: value })}
          value={config.method || "POST"}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhook-headers">Headers (JSON)</Label>
        <Textarea
          className="font-mono text-xs"
          id="webhook-headers"
          onChange={(e) => {
            try {
              const headers = e.target.value
                ? JSON.parse(e.target.value)
                : undefined;
              onChange({ headers });
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder='{"Authorization": "Bearer ..."}'
          rows={3}
          value={config.headers ? JSON.stringify(config.headers, null, 2) : ""}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Contact data will be sent in the request body automatically.
      </p>
    </>
  );
}
