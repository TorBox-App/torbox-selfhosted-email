// Segments types and constants - shared between server actions and client components

// Re-export filter types from database schema
export type {
  FilterCondition,
  FilterGroup,
  FilterOperator,
  SegmentFilter,
} from "@wraps/db";

// Import types for local use via namespace to avoid lint warning
import type * as DbTypes from "@wraps/db";

type FilterCondition = DbTypes.FilterCondition;
type FilterGroup = DbTypes.FilterGroup;
type FilterOperator = DbTypes.FilterOperator;
type SegmentFilter = DbTypes.SegmentFilter;

// Segment with relations
export type SegmentWithMeta = {
  id: string;
  name: string;
  description: string | null;
  condition: FilterCondition;
  trackMembership: boolean;
  memberCount: number;
  lastComputedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    email: string;
  } | null;
};

// Result types
export type ListSegmentsResult =
  | { success: true; segments: SegmentWithMeta[] }
  | { success: false; error: string };

export type GetSegmentResult =
  | { success: true; segment: SegmentWithMeta }
  | { success: false; error: string };

export type CreateSegmentResult =
  | { success: true; segment: SegmentWithMeta }
  | { success: false; error: string };

export type UpdateSegmentResult =
  | { success: true; segment: SegmentWithMeta }
  | { success: false; error: string };

export type DeleteSegmentResult =
  | { success: true }
  | { success: false; error: string };

export type PreviewSegmentResult =
  | { success: true; count: number; sampleEmails: string[] }
  | { success: false; error: string };

// Available fields for filtering
export type FilterFieldDefinition = {
  id: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "array" | "topic" | "event";
  operators: FilterOperator[];
};

// Define available filter fields
export const FILTER_FIELDS: FilterFieldDefinition[] = [
  // Contact status
  {
    id: "status",
    label: "Status",
    type: "string",
    operators: ["equals", "notEquals", "inList", "notInList"],
  },
  // Email
  {
    id: "email",
    label: "Email",
    type: "string",
    operators: [
      "equals",
      "notEquals",
      "contains",
      "notContains",
      "startsWith",
      "endsWith",
    ],
  },
  // Engagement
  {
    id: "lastActivityAt",
    label: "Last Activity",
    type: "date",
    operators: [
      "exists",
      "notExists",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "within",
    ],
  },
  {
    id: "lastEmailSentAt",
    label: "Last Email Sent",
    type: "date",
    operators: [
      "exists",
      "notExists",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "within",
    ],
  },
  {
    id: "lastEmailOpenedAt",
    label: "Last Email Opened",
    type: "date",
    operators: [
      "exists",
      "notExists",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "within",
    ],
  },
  {
    id: "lastEmailClickedAt",
    label: "Last Email Clicked",
    type: "date",
    operators: [
      "exists",
      "notExists",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "within",
    ],
  },
  // Stats
  {
    id: "emailsSent",
    label: "Emails Sent",
    type: "number",
    operators: [
      "equals",
      "notEquals",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
    ],
  },
  {
    id: "emailsOpened",
    label: "Emails Opened",
    type: "number",
    operators: [
      "equals",
      "notEquals",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
    ],
  },
  {
    id: "emailsClicked",
    label: "Emails Clicked",
    type: "number",
    operators: [
      "equals",
      "notEquals",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
    ],
  },
  // Timestamps
  {
    id: "createdAt",
    label: "Created Date",
    type: "date",
    operators: [
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "within",
    ],
  },
  {
    id: "confirmedAt",
    label: "Confirmed Date",
    type: "date",
    operators: [
      "exists",
      "notExists",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "within",
    ],
  },
  // Topics
  {
    id: "topics",
    label: "Topic Subscription",
    type: "topic",
    operators: ["hasTopic", "notHasTopic"],
  },
  // Custom properties - dynamic, represented as properties.*
  {
    id: "properties",
    label: "Custom Property",
    type: "string",
    operators: [
      "equals",
      "notEquals",
      "contains",
      "notContains",
      "exists",
      "notExists",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
    ],
  },
];

// Operator labels for display
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "equals",
  notEquals: "does not equal",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  greaterThan: "is greater than",
  lessThan: "is less than",
  greaterThanOrEqual: "is at least",
  lessThanOrEqual: "is at most",
  exists: "exists",
  notExists: "does not exist",
  inList: "is one of",
  notInList: "is not one of",
  within: "is within",
  hasTopic: "is subscribed to",
  notHasTopic: "is not subscribed to",
  triggered: "has triggered",
  triggeredWithin: "has triggered within",
  notTriggered: "has not triggered",
};

// Contact status options
export const CONTACT_STATUS_OPTIONS = [
  { value: "pending_confirmation", label: "Pending Confirmation" },
  { value: "active", label: "Active" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced", label: "Bounced" },
  { value: "complained", label: "Complained" },
];

// Helper to create an empty filter condition
export function createEmptyCondition(): FilterCondition {
  return {
    logic: "AND",
    groups: [
      {
        id: crypto.randomUUID(),
        filters: [
          {
            id: crypto.randomUUID(),
            field: "status",
            operator: "equals",
            value: "active",
          },
        ],
      },
    ],
  };
}

// Helper to create an empty filter
export function createEmptyFilter(): SegmentFilter {
  return {
    id: crypto.randomUUID(),
    field: "status",
    operator: "equals",
    value: "",
  };
}

// Helper to create an empty filter group
export function createEmptyGroup(): FilterGroup {
  return {
    id: crypto.randomUUID(),
    filters: [createEmptyFilter()],
  };
}

// Validate a filter condition
export function validateCondition(condition: FilterCondition): string | null {
  if (!condition.groups || condition.groups.length === 0) {
    return "At least one filter group is required";
  }

  for (const group of condition.groups) {
    if (!group.filters || group.filters.length === 0) {
      return "Each group must have at least one filter";
    }

    for (const filter of group.filters) {
      if (!filter.field) {
        return "Filter field is required";
      }
      if (!filter.operator) {
        return "Filter operator is required";
      }
      // Value is optional for exists/notExists operators
      if (
        filter.operator !== "exists" &&
        filter.operator !== "notExists" &&
        (filter.value === undefined || filter.value === "")
      ) {
        return "Filter value is required";
      }
    }

    // Recursively validate nested conditions
    if (group.nested) {
      const nestedError = validateCondition(group.nested);
      if (nestedError) {
        return nestedError;
      }
    }
  }

  return null;
}
