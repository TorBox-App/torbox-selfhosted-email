"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeConfigProps } from "./index";

export function ConditionConfig({ config, onChange }: NodeConfigProps) {
  if (config.type !== "condition") {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="condition-field">Field</Label>
        <Input
          id="condition-field"
          onChange={(e) => onChange({ field: e.target.value })}
          placeholder="e.g., email, tags, customField"
          value={config.field || ""}
        />
        <p className="text-muted-foreground text-xs">
          Contact property to evaluate
        </p>
      </div>

      <div className="space-y-2">
        <Label>Operator</Label>
        <Select
          onValueChange={(value) => onChange({ operator: value })}
          value={config.operator || "equals"}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="not_equals">Not Equals</SelectItem>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="not_contains">Not Contains</SelectItem>
            <SelectItem value="starts_with">Starts With</SelectItem>
            <SelectItem value="ends_with">Ends With</SelectItem>
            <SelectItem value="greater_than">Greater Than</SelectItem>
            <SelectItem value="greater_than_or_equals">
              Greater Than or Equals
            </SelectItem>
            <SelectItem value="less_than">Less Than</SelectItem>
            <SelectItem value="less_than_or_equals">
              Less Than or Equals
            </SelectItem>
            <SelectItem value="is_true">Is True</SelectItem>
            <SelectItem value="is_false">Is False</SelectItem>
            <SelectItem value="is_set">Is Set</SelectItem>
            <SelectItem value="is_not_set">Is Not Set</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!["is_set", "is_not_set", "is_true", "is_false"].includes(
        config.operator
      ) && (
        <div className="space-y-2">
          <Label htmlFor="condition-value">Value</Label>
          <Input
            id="condition-value"
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Value to compare"
            value={String(config.value ?? "")}
          />
        </div>
      )}
    </>
  );
}
