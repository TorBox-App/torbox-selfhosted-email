import { describe, expect, it } from "vitest";
import {
  joinFullName,
  splitFullName,
  updateAccountSchema,
} from "@/lib/forms/update-account";

describe("splitFullName", () => {
  it("splits on the first space only", () => {
    expect(splitFullName("Mary Jane Watson")).toEqual({
      firstName: "Mary",
      lastName: "Jane Watson",
    });
  });

  it("returns an empty last name for a single-word name", () => {
    expect(splitFullName("Cher")).toEqual({
      firstName: "Cher",
      lastName: "",
    });
  });

  it("collapses extra whitespace", () => {
    expect(splitFullName("  Ada   Lovelace  ")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });

  it("handles an empty name", () => {
    expect(splitFullName("")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("joinFullName", () => {
  it("joins both halves with a single space", () => {
    expect(joinFullName("Ada", "Lovelace")).toBe("Ada Lovelace");
  });

  it("omits the separator when the last name is empty", () => {
    expect(joinFullName("Cher", "")).toBe("Cher");
  });

  it("trims each half", () => {
    expect(joinFullName("  Ada ", " Lovelace  ")).toBe("Ada Lovelace");
  });
});

describe("name round-trip", () => {
  // Loading the settings page and saving without editing must not mutate the
  // stored name. The old `split(" ", 2)` dropped every token past the second.
  it.each([
    "Ada Lovelace",
    "Mary Jane Watson",
    "Jean-Luc de la Croix",
    "Martin Luther King Jr.",
    "Cher",
  ])("preserves %s", (name) => {
    const { firstName, lastName } = splitFullName(name);
    expect(joinFullName(firstName, lastName)).toBe(name);
  });
});

describe("updateAccountSchema", () => {
  it("accepts a blank last name", () => {
    const result = updateAccountSchema.safeParse({
      firstName: "Cher",
      lastName: "",
      email: "cher@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank first name", () => {
    const result = updateAccountSchema.safeParse({
      firstName: "   ",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("trims the email", () => {
    const result = updateAccountSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "  ada@example.com  ",
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("ada@example.com");
  });
});
