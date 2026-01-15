// Events types and constants - safe to import from client components
// NOTE: This file must NOT import from @wraps/db or any server-only packages

// ═══════════════════════════════════════════════════════════════════════════
// EVENT TYPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Event with contact information for display in the events table
 */
export type EventWithContact = {
  id: string;
  eventName: string;
  eventData: Record<string, unknown> | null;
  createdAt: Date;
  contactId: string;
  contactEmail: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// RESULT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ListEventsResult =
  | {
      success: true;
      events: EventWithContact[];
      total: number;
      page: number;
      pageSize: number;
    }
  | { success: false; error: string };

export type GetEventResult =
  | { success: true; event: EventWithContact }
  | { success: false; error: string };

export type GetEventNamesResult =
  | { success: true; eventNames: string[] }
  | { success: false; error: string };

// ═══════════════════════════════════════════════════════════════════════════
// FILTER OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

export type ListEventsOptions = {
  page?: number;
  pageSize?: number;
  search?: string; // Search in eventName AND eventData JSON
  eventName?: string; // Filter by specific event name
  contactEmail?: string; // Filter by contact email
  dateFrom?: Date;
  dateTo?: Date;
};

// ═══════════════════════════════════════════════════════════════════════════
// DATE RANGE PRESETS
// ═══════════════════════════════════════════════════════════════════════════

export const DATE_RANGE_PRESETS = [
  { label: "Last 24 hours", value: "1d" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Custom", value: "custom" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]["value"];

/**
 * Get date range from preset value
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset
): { from: Date; to: Date } | null {
  if (preset === "custom") {
    return null;
  }

  const now = new Date();
  const to = now;
  const from = new Date();

  switch (preset) {
    case "1d":
      from.setDate(now.getDate() - 1);
      break;
    case "7d":
      from.setDate(now.getDate() - 7);
      break;
    case "30d":
      from.setDate(now.getDate() - 30);
      break;
    case "90d":
      from.setDate(now.getDate() - 90);
      break;
    default:
      // Exhaustive check - this should never happen
      break;
  }

  return { from, to };
}
