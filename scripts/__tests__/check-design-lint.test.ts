import { describe, expect, it } from "vitest";
import { compare, tally } from "../check-design-lint.mjs";

describe("tally", () => {
  it("groups by rule and by the first two path segments", () => {
    const diagnostics = [
      { code: "shadcn(no-raw-colors)", filename: "apps/web/src/a.tsx" },
      { code: "shadcn(no-raw-colors)", filename: "apps/web/src/b.tsx" },
      { code: "shadcn(no-raw-colors)", filename: "packages/ui/src/c.tsx" },
      { code: "shadcn(no-restyle)", filename: "apps/website/src/d.tsx" },
    ];

    expect(tally(diagnostics)).toEqual({
      "shadcn(no-raw-colors) apps/web": 2,
      "shadcn(no-raw-colors) packages/ui": 1,
      "shadcn(no-restyle) apps/website": 1,
    });
  });

  it("ignores non-shadcn codes", () => {
    const diagnostics = [
      { code: "eslint(no-unused-vars)", filename: "apps/web/src/a.tsx" },
    ];

    expect(tally(diagnostics)).toEqual({});
  });
});

describe("compare", () => {
  it("reports a cell over ceiling with both numbers", () => {
    const result = compare({ a: 3 }, { a: 2 });

    expect(result.over).toEqual([{ cell: "a", count: 3, ceiling: 2 }]);
    expect(result.unknown).toEqual([]);
    expect(result.below).toEqual([]);
  });

  it("reports a cell with findings but no ceiling as unknown, and a ceiling with zero findings as below", () => {
    const result = compare({ a: 1 }, { b: 4 });

    expect(result.unknown).toEqual([{ cell: "a", count: 1 }]);
    expect(result.below).toEqual([{ cell: "b", count: 0, ceiling: 4 }]);
    expect(result.over).toEqual([]);
  });

  it("returns all three arrays empty when every cell is exactly at ceiling", () => {
    const result = compare({ a: 2, b: 5 }, { a: 2, b: 5 });

    expect(result.over).toEqual([]);
    expect(result.unknown).toEqual([]);
    expect(result.below).toEqual([]);
  });
});
