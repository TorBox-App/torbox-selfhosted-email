import { messageSend } from "@wraps/db/schema/batch";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("messageSend engagement metadata columns", () => {
  const columns = getTableColumns(messageSend);

  it("has openUserAgent column", () => {
    expect(columns.openUserAgent).toBeDefined();
    expect(columns.openUserAgent.name).toBe("open_user_agent");
  });

  it("has clickUserAgent column", () => {
    expect(columns.clickUserAgent).toBeDefined();
    expect(columns.clickUserAgent.name).toBe("click_user_agent");
  });

  // Recipient IP addresses are personal data we have no feature for, and the
  // privacy policy states we don't store them. Keep it that way.
  it("stores no recipient IP address for opens or clicks", () => {
    const columnNames = Object.values(columns).map((c) => c.name);
    expect(columnNames).not.toContain("open_ip_address");
    expect(columnNames).not.toContain("click_ip_address");
    expect(columnNames.filter((n) => n.includes("ip_address"))).toEqual([]);
  });
});
