import { messageSend } from "@wraps/db/schema/batch";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("messageSend engagement metadata columns", () => {
  const columns = getTableColumns(messageSend);

  it("has openUserAgent column", () => {
    expect(columns.openUserAgent).toBeDefined();
    expect(columns.openUserAgent.name).toBe("open_user_agent");
  });

  it("has openIpAddress column", () => {
    expect(columns.openIpAddress).toBeDefined();
    expect(columns.openIpAddress.name).toBe("open_ip_address");
  });

  it("has clickUserAgent column", () => {
    expect(columns.clickUserAgent).toBeDefined();
    expect(columns.clickUserAgent.name).toBe("click_user_agent");
  });

  it("has clickIpAddress column", () => {
    expect(columns.clickIpAddress).toBeDefined();
    expect(columns.clickIpAddress.name).toBe("click_ip_address");
  });
});
