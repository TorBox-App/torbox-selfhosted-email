"use client";

import { Label } from "@wraps/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wraps/ui/components/ui/select";
import { Input } from "@/components/ui/input";
import type { NodeConfigProps } from "./index";

export function DelayConfig({ config, onChange }: NodeConfigProps) {
  if (config.type !== "delay") {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="delay-amount">Duration</Label>
      <div className="flex gap-2">
        <Input
          className="w-20"
          id="delay-amount"
          min={1}
          onChange={(e) =>
            onChange({ amount: Number.parseInt(e.target.value, 10) || 1 })
          }
          type="number"
          value={config.amount || 1}
        />
        <Select
          onValueChange={(value) =>
            onChange({ unit: value as typeof config.unit })
          }
          value={config.unit || "days"}
        >
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
            <SelectItem value="days">Days</SelectItem>
            <SelectItem value="weeks">Weeks</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
