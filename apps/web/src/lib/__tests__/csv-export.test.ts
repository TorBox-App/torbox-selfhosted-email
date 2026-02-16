import { describe, expect, it, vi } from "vitest";
import type { CSVColumnDef } from "../csv-export";
import { toCSV } from "../csv-export";

// Mock sonner since it's a client-side dependency
vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type TestRow = {
  name: string;
  age: number;
  active: boolean;
  email: string | null;
};

const columns: CSVColumnDef<TestRow>[] = [
  { header: "Name", accessor: (r) => r.name },
  { header: "Age", accessor: (r) => r.age },
  { header: "Active", accessor: (r) => r.active },
  { header: "Email", accessor: (r) => r.email },
];

describe("toCSV", () => {
  it("generates CSV with header and rows", () => {
    const rows: TestRow[] = [
      { name: "Alice", age: 30, active: true, email: "alice@test.com" },
      { name: "Bob", age: 25, active: false, email: null },
    ];

    const csv = toCSV(rows, columns);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("Name,Age,Active,Email");
    expect(lines[1]).toBe("Alice,30,true,alice@test.com");
    expect(lines[2]).toBe("Bob,25,false,");
  });

  it("returns only header row when rows array is empty", () => {
    const csv = toCSV([], columns);
    expect(csv).toBe("Name,Age,Active,Email\n");
  });

  it("escapes commas in values", () => {
    const rows: TestRow[] = [
      {
        name: "Doe, Jane",
        age: 28,
        active: true,
        email: "jane@test.com",
      },
    ];

    const csv = toCSV(rows, columns);
    expect(csv).toContain('"Doe, Jane"');
  });

  it("escapes double quotes in values", () => {
    const rows: TestRow[] = [
      {
        name: 'She said "hello"',
        age: 28,
        active: true,
        email: "jane@test.com",
      },
    ];

    const csv = toCSV(rows, columns);
    expect(csv).toContain('"She said ""hello"""');
  });

  it("escapes newlines in values", () => {
    const rows: TestRow[] = [
      {
        name: "Line1\nLine2",
        age: 28,
        active: true,
        email: "jane@test.com",
      },
    ];

    const csv = toCSV(rows, columns);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("handles null and undefined values", () => {
    const colsWithUndefined: CSVColumnDef<TestRow>[] = [
      { header: "Email", accessor: (r) => r.email },
      { header: "Missing", accessor: () => {} },
    ];

    const rows: TestRow[] = [
      { name: "Alice", age: 30, active: true, email: null },
    ];

    const csv = toCSV(rows, colsWithUndefined);
    const lines = csv.split("\n");
    expect(lines[1]).toBe(",");
  });

  it("handles array values joined in accessor", () => {
    type EmailRow = { to: string[] };
    const emailCols: CSVColumnDef<EmailRow>[] = [
      { header: "To", accessor: (r) => r.to.join("; ") },
    ];

    const rows: EmailRow[] = [{ to: ["a@test.com", "b@test.com"] }];

    const csv = toCSV(rows, emailCols);
    // Semicolons don't trigger CSV quoting (only commas, quotes, newlines)
    expect(csv).toContain("a@test.com; b@test.com");
  });
});
