import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { templateVersion } from "../schema/templates";

describe("templateVersion schema", () => {
  it("createdBy should be nullable to match onDelete: set null", () => {
    const columns = getTableColumns(templateVersion);
    // onDelete: "set null" requires the column to accept NULL values.
    // If notNull is true, user deletion will fail with a constraint violation.
    expect(columns.createdBy.notNull).toBe(false);
  });
});
