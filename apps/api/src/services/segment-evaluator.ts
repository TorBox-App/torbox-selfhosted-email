/**
 * Segment Evaluator Service
 *
 * Evaluates whether a contact matches a segment's filter conditions.
 * Used for segment entry/exit workflow triggers.
 */

import type { FilterCondition, FilterGroup, SegmentFilter } from "@wraps/db";
import { contact, contactTopic, db, eq, segment } from "@wraps/db";
import { and } from "drizzle-orm";

// Contact with topic IDs for evaluation
type ContactWithTopics = typeof contact.$inferSelect & {
  topicIds: string[];
};

/**
 * Evaluate a single filter against contact data
 */
function evaluateFilter(
  filter: SegmentFilter,
  contactData: ContactWithTopics
): boolean {
  const { field, operator, value, unit } = filter;

  // Get the actual value from contact
  let actualValue: unknown;

  if (field.startsWith("properties.")) {
    // Custom property access
    const propPath = field.substring("properties.".length);
    actualValue = getNestedValue(contactData.properties || {}, propPath);
  } else if (field === "topics") {
    // Topic evaluation is handled specially by hasTopic/notHasTopic operators
    actualValue = contactData.topicIds;
  } else {
    // Standard contact field
    actualValue = contactData[field as keyof typeof contactData];
  }

  // Evaluate based on operator
  switch (operator) {
    case "equals":
      return actualValue === value;

    case "notEquals":
      return actualValue !== value;

    case "contains":
      if (typeof actualValue === "string" && typeof value === "string") {
        return actualValue.toLowerCase().includes(value.toLowerCase());
      }
      return false;

    case "notContains":
      if (typeof actualValue === "string" && typeof value === "string") {
        return !actualValue.toLowerCase().includes(value.toLowerCase());
      }
      return true;

    case "startsWith":
      if (typeof actualValue === "string" && typeof value === "string") {
        return actualValue.toLowerCase().startsWith(value.toLowerCase());
      }
      return false;

    case "endsWith":
      if (typeof actualValue === "string" && typeof value === "string") {
        return actualValue.toLowerCase().endsWith(value.toLowerCase());
      }
      return false;

    case "greaterThan":
      if (typeof actualValue === "number" && typeof value === "number") {
        return actualValue > value;
      }
      if (actualValue instanceof Date && value instanceof Date) {
        return actualValue > value;
      }
      return false;

    case "lessThan":
      if (typeof actualValue === "number" && typeof value === "number") {
        return actualValue < value;
      }
      if (actualValue instanceof Date && value instanceof Date) {
        return actualValue < value;
      }
      return false;

    case "greaterThanOrEqual":
      if (typeof actualValue === "number" && typeof value === "number") {
        return actualValue >= value;
      }
      return false;

    case "lessThanOrEqual":
      if (typeof actualValue === "number" && typeof value === "number") {
        return actualValue <= value;
      }
      return false;

    case "exists":
      return (
        actualValue !== null && actualValue !== undefined && actualValue !== ""
      );

    case "notExists":
      return (
        actualValue === null || actualValue === undefined || actualValue === ""
      );

    case "inList":
      if (Array.isArray(value)) {
        return value.includes(actualValue);
      }
      return false;

    case "notInList":
      if (Array.isArray(value)) {
        return !value.includes(actualValue);
      }
      return true;

    case "within":
      // Time-based: check if date is within X days/hours/minutes
      if (actualValue instanceof Date && typeof value === "number" && unit) {
        const now = new Date();
        const threshold = getThresholdDate(now, value, unit);
        return actualValue >= threshold;
      }
      // Also handle string dates
      if (
        typeof actualValue === "string" &&
        typeof value === "number" &&
        unit
      ) {
        const dateValue = new Date(actualValue);
        if (!Number.isNaN(dateValue.getTime())) {
          const now = new Date();
          const threshold = getThresholdDate(now, value, unit);
          return dateValue >= threshold;
        }
      }
      return false;

    case "hasTopic":
      // Check if contact is subscribed to the topic
      if (Array.isArray(actualValue) && typeof value === "string") {
        return actualValue.includes(value);
      }
      return false;

    case "notHasTopic":
      // Check if contact is NOT subscribed to the topic
      if (Array.isArray(actualValue) && typeof value === "string") {
        return !actualValue.includes(value);
      }
      return true;

    // Event-based operators would need event history lookup
    case "triggered":
    case "triggeredWithin":
    case "notTriggered":
      // TODO: Implement event history lookup
      // For now, return false (event-based segments not yet supported)
      console.log(
        `[segment-evaluator] Event-based operator "${operator}" not yet implemented`
      );
      return false;

    default:
      console.warn(`[segment-evaluator] Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Get nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return;
    }
    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return;
    }
  }

  return current;
}

/**
 * Calculate threshold date for "within" operator
 */
function getThresholdDate(
  now: Date,
  value: number,
  unit: "days" | "hours" | "minutes"
): Date {
  const threshold = new Date(now);

  switch (unit) {
    case "days":
      threshold.setDate(threshold.getDate() - value);
      break;
    case "hours":
      threshold.setHours(threshold.getHours() - value);
      break;
    case "minutes":
      threshold.setMinutes(threshold.getMinutes() - value);
      break;
  }

  return threshold;
}

/**
 * Evaluate a filter group (all filters within a group are ANDed)
 */
function evaluateGroup(
  group: FilterGroup,
  contactData: ContactWithTopics
): boolean {
  // All filters in a group must match (AND)
  for (const filter of group.filters) {
    if (!evaluateFilter(filter, contactData)) {
      return false;
    }
  }

  // If there's a nested condition, evaluate it too
  if (group.nested) {
    return evaluateCondition(group.nested, contactData);
  }

  return true;
}

/**
 * Evaluate a filter condition (groups combined with AND/OR logic)
 */
function evaluateCondition(
  condition: FilterCondition,
  contactData: ContactWithTopics
): boolean {
  if (condition.groups.length === 0) {
    // Empty condition matches everything
    return true;
  }

  if (condition.logic === "AND") {
    // All groups must match
    return condition.groups.every((group) => evaluateGroup(group, contactData));
  }

  // OR logic - at least one group must match
  return condition.groups.some((group) => evaluateGroup(group, contactData));
}

/**
 * Check if a contact matches a segment
 */
export async function contactMatchesSegment(
  contactId: string,
  segmentId: string
): Promise<boolean> {
  // Fetch segment
  const [seg] = await db
    .select()
    .from(segment)
    .where(eq(segment.id, segmentId))
    .limit(1);

  if (!seg) {
    console.warn(`[segment-evaluator] Segment ${segmentId} not found`);
    return false;
  }

  // Fetch contact
  const [contactRecord] = await db
    .select()
    .from(contact)
    .where(eq(contact.id, contactId))
    .limit(1);

  if (!contactRecord) {
    console.warn(`[segment-evaluator] Contact ${contactId} not found`);
    return false;
  }

  // Fetch contact's topic subscriptions
  const subscriptions = await db
    .select({ topicId: contactTopic.topicId })
    .from(contactTopic)
    .where(
      and(
        eq(contactTopic.contactId, contactId),
        eq(contactTopic.status, "subscribed")
      )
    );

  const topicIds = subscriptions.map((s) => s.topicId);

  // Create contact data object for evaluation
  const contactData: ContactWithTopics = {
    ...contactRecord,
    topicIds,
  };

  // Evaluate the segment condition
  return evaluateCondition(seg.condition, contactData);
}

/**
 * Find all segments that a contact matches
 */
export async function findMatchingSegments(
  contactId: string,
  organizationId: string
): Promise<string[]> {
  // Fetch all segments for the organization that track membership
  const segments = await db
    .select()
    .from(segment)
    .where(
      and(
        eq(segment.organizationId, organizationId),
        eq(segment.trackMembership, true)
      )
    );

  if (segments.length === 0) {
    return [];
  }

  // Fetch contact
  const [contactRecord] = await db
    .select()
    .from(contact)
    .where(eq(contact.id, contactId))
    .limit(1);

  if (!contactRecord) {
    return [];
  }

  // Fetch contact's topic subscriptions
  const subscriptions = await db
    .select({ topicId: contactTopic.topicId })
    .from(contactTopic)
    .where(
      and(
        eq(contactTopic.contactId, contactId),
        eq(contactTopic.status, "subscribed")
      )
    );

  const topicIds = subscriptions.map((s) => s.topicId);

  const contactData: ContactWithTopics = {
    ...contactRecord,
    topicIds,
  };

  // Check each segment
  const matchingSegmentIds: string[] = [];

  for (const seg of segments) {
    if (evaluateCondition(seg.condition, contactData)) {
      matchingSegmentIds.push(seg.id);
    }
  }

  return matchingSegmentIds;
}
