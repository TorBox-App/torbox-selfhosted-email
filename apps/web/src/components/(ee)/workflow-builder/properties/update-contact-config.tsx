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

export function UpdateContactConfig({ config, onChange }: NodeConfigProps) {
  if (config.type !== "update_contact") {
    return null;
  }

  const updates = config.updates || [];

  const addUpdate = () => {
    onChange({
      updates: [...updates, { field: "", operation: "set", value: "" }],
    });
  };

  const removeUpdate = (index: number) => {
    onChange({
      updates: updates.filter((_, i) => i !== index),
    });
  };

  const updateField = (index: number, key: string, value: unknown) => {
    const newUpdates = [...updates];
    newUpdates[index] = { ...newUpdates[index], [key]: value };
    onChange({ updates: newUpdates });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Field Updates</Label>
        <button
          className="text-primary text-xs hover:underline"
          onClick={addUpdate}
          type="button"
        >
          + Add field
        </button>
      </div>

      {updates.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No updates configured. Click "Add field" to add one.
        </p>
      ) : (
        <div className="space-y-3">
          {updates.map((update, index) => (
            <div className="space-y-2 rounded-md border p-3" key={index}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs">Update {index + 1}</span>
                <button
                  className="text-destructive text-xs hover:underline"
                  onClick={() => removeUpdate(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
              <Input
                onChange={(e) => updateField(index, "field", e.target.value)}
                placeholder="Field name"
                value={update.field || ""}
              />
              <Select
                onValueChange={(value) =>
                  updateField(index, "operation", value)
                }
                value={update.operation || "set"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set to</SelectItem>
                  <SelectItem value="increment">Increment by</SelectItem>
                  <SelectItem value="decrement">Decrement by</SelectItem>
                  <SelectItem value="append">Append</SelectItem>
                  <SelectItem value="remove">Remove</SelectItem>
                  <SelectItem value="unset">Unset</SelectItem>
                </SelectContent>
              </Select>
              {update.operation !== "unset" && (
                <Input
                  onChange={(e) => updateField(index, "value", e.target.value)}
                  placeholder="Value"
                  value={String(update.value ?? "")}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
