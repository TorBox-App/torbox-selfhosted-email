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
import { amountUnitToSeconds, parseDurationToAmountUnit } from "@/lib/utils";
import type { NodeConfigProps } from "./index";

export function WaitForEventConfig({ config, onChange }: NodeConfigProps) {
  if (config.type !== "wait_for_event") {
    return null;
  }

  const { amount, unit } = parseDurationToAmountUnit(
    config.timeoutSeconds || 0,
    { amount: 24, unit: "hours" }
  );

  const handleTimeoutChange = (newAmount: number, newUnit: string) => {
    onChange({ timeoutSeconds: amountUnitToSeconds(newAmount, newUnit) });
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="wait-event-name">Event Name</Label>
        <Input
          id="wait-event-name"
          onChange={(e) => onChange({ eventName: e.target.value })}
          placeholder="e.g., purchase.completed"
          value={config.eventName || ""}
        />
        <p className="text-muted-foreground text-xs">
          The event to wait for. Workflow continues when this event is received
          for the contact.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Timeout</Label>
        <div className="flex gap-2">
          <Input
            className="w-20"
            min={1}
            onChange={(e) =>
              handleTimeoutChange(
                Number.parseInt(e.target.value, 10) || 1,
                unit
              )
            }
            type="number"
            value={amount}
          />
          <Select
            onValueChange={(value) => handleTimeoutChange(amount, value)}
            value={unit}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-xs">
          If the event is not received within this time, the timeout path is
          followed.
        </p>
      </div>
    </>
  );
}
