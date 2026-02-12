import { describe, expect, it } from "vitest";
import { parseCSV } from "../csv-parse";

describe("parseCSV", () => {
  it("parses simple CSV", () => {
    const result = parseCSV(
      "Name,Email\nAlice,alice@example.com\nBob,bob@example.com"
    );
    expect(result.headers).toEqual(["Name", "Email"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      Name: "Alice",
      Email: "alice@example.com",
    });
    expect(result.rows[1]).toEqual({ Name: "Bob", Email: "bob@example.com" });
    expect(result.totalRows).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it("handles quoted fields with commas", () => {
    const result = parseCSV('Name,Company\nAlice,"Acme, Inc"\nBob,"Big Corp"');
    expect(result.rows[0]).toEqual({ Name: "Alice", Company: "Acme, Inc" });
  });

  it("handles escaped quotes in quoted fields", () => {
    const result = parseCSV('Name,Nickname\nAlice,"""Ali"""');
    expect(result.rows[0]).toEqual({ Name: "Alice", Nickname: '"Ali"' });
  });

  it("handles newlines in quoted fields", () => {
    const result = parseCSV('Name,Bio\nAlice,"Hello\nWorld"');
    expect(result.rows[0]).toEqual({ Name: "Alice", Bio: "Hello\nWorld" });
  });

  it("strips BOM", () => {
    const result = parseCSV("\uFEFFName,Email\nAlice,alice@example.com");
    expect(result.headers).toEqual(["Name", "Email"]);
    expect(result.rows).toHaveLength(1);
  });

  it("auto-detects semicolon delimiter", () => {
    const result = parseCSV("Name;Email\nAlice;alice@example.com");
    expect(result.headers).toEqual(["Name", "Email"]);
    expect(result.rows[0]).toEqual({
      Name: "Alice",
      Email: "alice@example.com",
    });
  });

  it("auto-detects tab delimiter", () => {
    const result = parseCSV("Name\tEmail\nAlice\talice@example.com");
    expect(result.headers).toEqual(["Name", "Email"]);
    expect(result.rows[0]).toEqual({
      Name: "Alice",
      Email: "alice@example.com",
    });
  });

  it("respects explicit delimiter option", () => {
    const result = parseCSV("Name|Email\nAlice|alice@example.com", {
      delimiter: "|",
    });
    expect(result.headers).toEqual(["Name", "Email"]);
    expect(result.rows[0]).toEqual({
      Name: "Alice",
      Email: "alice@example.com",
    });
  });

  it("truncates rows beyond maxRows", () => {
    const rows = Array.from(
      { length: 20 },
      (_, i) => `user${i},user${i}@example.com`
    ).join("\n");
    const result = parseCSV(`Name,Email\n${rows}`, { maxRows: 5 });
    expect(result.rows).toHaveLength(5);
    expect(result.totalRows).toBe(20);
    expect(result.truncated).toBe(true);
  });

  it("skips empty rows", () => {
    const result = parseCSV(
      "Name,Email\nAlice,alice@example.com\n\n\nBob,bob@example.com"
    );
    expect(result.rows).toHaveLength(2);
    expect(result.totalRows).toBe(2);
  });

  it("trims header whitespace", () => {
    const result = parseCSV("  Name , Email \nAlice,alice@example.com");
    expect(result.headers).toEqual(["Name", "Email"]);
  });

  it("trims cell whitespace", () => {
    const result = parseCSV("Name,Email\n  Alice  ,  alice@example.com  ");
    expect(result.rows[0]).toEqual({
      Name: "Alice",
      Email: "alice@example.com",
    });
  });

  it("returns empty result for empty input", () => {
    const result = parseCSV("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("handles Windows-style line endings", () => {
    const result = parseCSV(
      "Name,Email\r\nAlice,alice@example.com\r\nBob,bob@example.com"
    );
    expect(result.rows).toHaveLength(2);
  });

  it("handles rows with fewer fields than headers", () => {
    const result = parseCSV("Name,Email,Phone\nAlice,alice@example.com");
    expect(result.rows[0]).toEqual({
      Name: "Alice",
      Email: "alice@example.com",
      Phone: "",
    });
  });
});
