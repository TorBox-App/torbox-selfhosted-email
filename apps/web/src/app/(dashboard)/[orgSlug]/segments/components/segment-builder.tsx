"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_STATUS_OPTIONS,
  createEmptyFilter,
  createEmptyGroup,
  FILTER_FIELDS,
  type FilterCondition,
  type FilterGroup,
  type FilterOperator,
  OPERATOR_LABELS,
  type SegmentFilter,
} from "@/lib/segments";
import type { TopicWithMeta } from "@/lib/topics";

type SegmentBuilderProps = {
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
  propertyKeys: string[];
  topics: TopicWithMeta[];
};

export function SegmentBuilder({
  condition,
  onChange,
  propertyKeys,
  topics,
}: SegmentBuilderProps) {
  // Update logic (AND/OR)
  const handleLogicChange = useCallback(
    (logic: "AND" | "OR") => {
      onChange({ ...condition, logic });
    },
    [condition, onChange]
  );

  // Add a new group
  const handleAddGroup = useCallback(() => {
    onChange({
      ...condition,
      groups: [...condition.groups, createEmptyGroup()],
    });
  }, [condition, onChange]);

  // Remove a group
  const handleRemoveGroup = useCallback(
    (groupIndex: number) => {
      if (condition.groups.length <= 1) {
        return;
      }
      onChange({
        ...condition,
        groups: condition.groups.filter((_, i) => i !== groupIndex),
      });
    },
    [condition, onChange]
  );

  // Update a group
  const handleUpdateGroup = useCallback(
    (groupIndex: number, group: FilterGroup) => {
      onChange({
        ...condition,
        groups: condition.groups.map((g, i) => (i === groupIndex ? group : g)),
      });
    },
    [condition, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Logic selector */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          Match contacts where
        </span>
        <Select
          onValueChange={(value) => handleLogicChange(value as "AND" | "OR")}
          value={condition.logic}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">ALL</SelectItem>
            <SelectItem value="OR">ANY</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">
          of the following conditions are true:
        </span>
      </div>

      {/* Filter groups */}
      <div className="space-y-3">
        {condition.groups.map((group, groupIndex) => (
          <FilterGroupComponent
            canRemove={condition.groups.length > 1}
            group={group}
            groupIndex={groupIndex}
            key={group.id || `group-${groupIndex}`}
            onChange={(updatedGroup) =>
              handleUpdateGroup(groupIndex, updatedGroup)
            }
            onRemove={() => handleRemoveGroup(groupIndex)}
            propertyKeys={propertyKeys}
            topics={topics}
          />
        ))}
      </div>

      {/* Add group button */}
      <Button
        className="w-full"
        onClick={handleAddGroup}
        size="sm"
        variant="outline"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add {condition.logic === "AND" ? "AND" : "OR"} condition group
      </Button>
    </div>
  );
}

type FilterGroupComponentProps = {
  group: FilterGroup;
  groupIndex: number;
  canRemove: boolean;
  propertyKeys: string[];
  topics: TopicWithMeta[];
  onChange: (group: FilterGroup) => void;
  onRemove: () => void;
};

function FilterGroupComponent({
  group,
  groupIndex,
  canRemove,
  propertyKeys,
  topics,
  onChange,
  onRemove,
}: FilterGroupComponentProps) {
  // Add a filter to the group
  const handleAddFilter = useCallback(() => {
    onChange({
      ...group,
      filters: [...group.filters, createEmptyFilter()],
    });
  }, [group, onChange]);

  // Remove a filter from the group
  const handleRemoveFilter = useCallback(
    (filterIndex: number) => {
      if (group.filters.length <= 1) {
        return;
      }
      onChange({
        ...group,
        filters: group.filters.filter((_, i) => i !== filterIndex),
      });
    },
    [group, onChange]
  );

  // Update a filter in the group
  const handleUpdateFilter = useCallback(
    (filterIndex: number, filter: SegmentFilter) => {
      onChange({
        ...group,
        filters: group.filters.map((f, i) => (i === filterIndex ? filter : f)),
      });
    },
    [group, onChange]
  );

  return (
    <div className="relative rounded-lg border bg-card p-4">
      {/* Remove group button */}
      {canRemove && (
        <Button
          className="absolute top-2 right-2 h-6 w-6 p-0"
          onClick={onRemove}
          size="sm"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div className="space-y-3">
        {group.filters.map((filter, filterIndex) => (
          <div
            className="flex items-start gap-2"
            key={filter.id || `filter-${groupIndex}-${filterIndex}`}
          >
            {filterIndex > 0 && (
              <span className="flex h-9 w-12 items-center justify-center text-muted-foreground text-sm">
                AND
              </span>
            )}
            <FilterRow
              canRemove={group.filters.length > 1}
              filter={filter}
              onChange={(updated) => handleUpdateFilter(filterIndex, updated)}
              onRemove={() => handleRemoveFilter(filterIndex)}
              propertyKeys={propertyKeys}
              topics={topics}
            />
          </div>
        ))}
      </div>

      {/* Add filter button */}
      <Button
        className="mt-3"
        onClick={handleAddFilter}
        size="sm"
        variant="ghost"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add filter
      </Button>
    </div>
  );
}

type FilterRowProps = {
  filter: SegmentFilter;
  canRemove: boolean;
  propertyKeys: string[];
  topics: TopicWithMeta[];
  onChange: (filter: SegmentFilter) => void;
  onRemove: () => void;
};

function FilterRow({
  filter,
  canRemove,
  propertyKeys,
  topics,
  onChange,
  onRemove,
}: FilterRowProps) {
  // Get field definition
  const fieldDef =
    FILTER_FIELDS.find((f) => f.id === filter.field) ||
    FILTER_FIELDS.find((f) => filter.field.startsWith(`${f.id}.`));

  // Get available operators for the field
  const availableOperators = fieldDef?.operators || [];

  // Handle field change
  const handleFieldChange = useCallback(
    (fieldId: string) => {
      const newFieldDef = FILTER_FIELDS.find((f) => f.id === fieldId);
      const defaultOperator = newFieldDef?.operators[0] || "equals";
      onChange({
        field: fieldId,
        operator: defaultOperator,
        value: undefined,
      });
    },
    [onChange]
  );

  // Handle operator change
  const handleOperatorChange = useCallback(
    (operator: string) => {
      onChange({
        ...filter,
        operator: operator as FilterOperator,
        // Clear value for exists/notExists operators
        value:
          operator === "exists" || operator === "notExists"
            ? undefined
            : filter.value,
      });
    },
    [filter, onChange]
  );

  // Handle value change
  const handleValueChange = useCallback(
    (value: unknown) => {
      onChange({
        ...filter,
        value,
      });
    },
    [filter, onChange]
  );

  // Render value input based on field type
  const renderValueInput = () => {
    // No value input for exists/notExists operators
    if (filter.operator === "exists" || filter.operator === "notExists") {
      return null;
    }

    // Topic selector for topic-based filters
    if (filter.field === "topics") {
      return (
        <Select
          onValueChange={handleValueChange}
          value={(filter.value as string) || ""}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select topic" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Status selector
    if (filter.field === "status") {
      if (filter.operator === "inList" || filter.operator === "notInList") {
        // Multi-select for list operators (simplified as single select for now)
        return (
          <Select
            onValueChange={handleValueChange}
            value={(filter.value as string) || ""}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      return (
        <Select
          onValueChange={handleValueChange}
          value={(filter.value as string) || ""}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_STATUS_OPTIONS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Within operator needs value + unit
    if (filter.operator === "within") {
      return (
        <div className="flex flex-1 items-center gap-2">
          <Input
            className="w-20"
            min={1}
            onChange={(e) =>
              onChange({
                ...filter,
                value: Number.parseInt(e.target.value, 10) || undefined,
              })
            }
            placeholder="30"
            type="number"
            value={filter.value?.toString() || ""}
          />
          <Select
            onValueChange={(unit) =>
              onChange({
                ...filter,
                unit: unit as "days" | "hours" | "minutes",
              })
            }
            value={filter.unit || "days"}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days">days</SelectItem>
              <SelectItem value="hours">hours</SelectItem>
              <SelectItem value="minutes">minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Number input for numeric fields
    if (fieldDef?.type === "number") {
      return (
        <Input
          className="flex-1"
          onChange={(e) =>
            handleValueChange(Number.parseInt(e.target.value, 10) || undefined)
          }
          placeholder="0"
          type="number"
          value={filter.value?.toString() || ""}
        />
      );
    }

    // Date input for date fields
    if (fieldDef?.type === "date" && (filter.operator as string) !== "within") {
      return (
        <Input
          className="flex-1"
          onChange={(e) => handleValueChange(e.target.value)}
          type="date"
          value={(filter.value as string) || ""}
        />
      );
    }

    // Custom property input
    if (
      filter.field === "properties" ||
      filter.field.startsWith("properties.")
    ) {
      // Extract property key - if field is just "properties", key is empty
      const currentPropertyKey =
        filter.field === "properties"
          ? ""
          : filter.field.replace("properties.", "");
      return (
        <div className="flex flex-1 items-center gap-2">
          {propertyKeys.length > 0 ? (
            <Select
              onValueChange={(key) =>
                onChange({
                  ...filter,
                  field: `properties.${key}`,
                })
              }
              value={currentPropertyKey || ""}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {propertyKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="w-32"
              onChange={(e) =>
                onChange({
                  ...filter,
                  field: `properties.${e.target.value}`,
                })
              }
              placeholder="property name"
              value={currentPropertyKey}
            />
          )}
          <Input
            className="flex-1"
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="value"
            value={(filter.value as string) || ""}
          />
        </div>
      );
    }

    // Default text input
    return (
      <Input
        className="flex-1"
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder="value"
        value={(filter.value as string) || ""}
      />
    );
  };

  return (
    <div className="flex flex-1 items-center gap-2">
      {/* Field selector */}
      <Select
        onValueChange={handleFieldChange}
        value={filter.field.split(".")[0]}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {FILTER_FIELDS.map((field) => (
            <SelectItem key={field.id} value={field.id}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select onValueChange={handleOperatorChange} value={filter.operator}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select operator" />
        </SelectTrigger>
        <SelectContent>
          {availableOperators.map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {renderValueInput()}

      {/* Remove button */}
      {canRemove && (
        <Button
          className="h-9 w-9 shrink-0 p-0"
          onClick={onRemove}
          size="sm"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
