/**
 * Utilities for analytics date handling: daily aggregation and gap-filling.
 *
 * CloudWatch returns sub-day data points (1h, 6h periods) that must be
 * aggregated to daily totals. All chart routes need gap-filling so every
 * day in the requested range appears — including today — even with zero values.
 */

/**
 * Validates an IANA timezone string, returning "UTC" if invalid.
 */
export function validateTimezone(tz: string | null | undefined): string {
  if (!tz) {
    return "UTC";
  }
  try {
    Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * Converts a Date to a YYYY-MM-DD string in the given timezone.
 * Falls back to UTC ISO date when no timezone is provided.
 */
export function toLocaleDateStr(date: Date, timezone?: string): string {
  if (!timezone || timezone === "UTC") {
    return date.toISOString().split("T")[0];
  }
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

/**
 * Generates an array of YYYY-MM-DD date strings for every day from
 * `startTime` through `endTime` (inclusive). When `timezone` is provided,
 * boundaries are computed in the user's local time instead of UTC.
 */
export function generateDateRange(
  startTime: Date,
  endTime: Date,
  timezone?: string
): string[] {
  const startStr = toLocaleDateStr(startTime, timezone);
  const endStr = toLocaleDateStr(endTime, timezone);

  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);

  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const endUTC = Date.UTC(ey, em - 1, ed);

  const dates: string[] = [];
  while (cursor.getTime() <= endUTC) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Aggregates numeric values from sub-day data points into daily totals.
 *
 * Takes an array of data points with a `timestamp` (Date) and arbitrary
 * numeric fields, groups them by YYYY-MM-DD, and sums each field per day.
 *
 * @example
 * ```ts
 * const daily = aggregateByDate(
 *   [cloudwatchTimestamp1, cloudwatchTimestamp2],
 *   [
 *     [sentValues[0], sentValues[1]],
 *     [deliveredValues[0], deliveredValues[1]],
 *   ],
 *   ["sent", "delivered"]
 * );
 * // Map { "2026-02-17" => { sent: 15, delivered: 14 } }
 * ```
 */
export function aggregateByDate<K extends string>(
  timestamps: Date[],
  valueArrays: number[][],
  keys: K[],
  timezone?: string
): Map<string, Record<K, number>> {
  const map = new Map<string, Record<K, number>>();

  for (let i = 0; i < timestamps.length; i++) {
    const dateStr = toLocaleDateStr(timestamps[i], timezone);
    const existing =
      map.get(dateStr) ??
      (Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>);

    for (let j = 0; j < keys.length; j++) {
      existing[keys[j]] += valueArrays[j]?.[i] ?? 0;
    }

    map.set(dateStr, existing);
  }

  return map;
}

/**
 * Gap-fills a date-keyed map into a sorted array covering every day
 * in the range. Missing dates get the provided `defaults`.
 */
export function gapFillDates<T extends Record<string, unknown>>(
  dateRange: string[],
  dataMap: Map<string, T>,
  defaults: T
): Array<T & { date: string; timestamp: number }> {
  return dateRange.map((dateStr) => {
    const values = dataMap.get(dateStr) ?? defaults;
    return {
      ...values,
      date: dateStr,
      timestamp: new Date(dateStr).getTime(),
    };
  });
}
