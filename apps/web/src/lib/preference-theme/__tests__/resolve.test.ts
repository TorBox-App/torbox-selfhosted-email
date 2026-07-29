import type { PreferenceCenterTheme } from "@wraps/db";
import { describe, expect, it } from "vitest";
import { resolvePreferenceCenterTheme } from "../resolve";

describe("resolvePreferenceCenterTheme", () => {
  it("falls back to brandColor for light/dark primary when theme is null (today-equivalence)", () => {
    const result = resolvePreferenceCenterTheme({
      theme: null,
      brandColor: "#3b82f6",
    });
    expect(result.light.primary).toBe("#3b82f6");
    expect(result.light["primary-foreground"]).toBe("oklch(0.985 0 0)");
    expect(result.dark.primary).toBe("#3b82f6");
    expect(result.dark["primary-foreground"]).toBe("oklch(0.985 0 0)");
  });

  it("returns empty maps when theme is null and brandColor is null", () => {
    const result = resolvePreferenceCenterTheme({
      theme: null,
      brandColor: null,
    });
    expect(result.light).toEqual({});
    expect(result.dark).toEqual({});
  });

  it("does not set primary from a malicious brandColor value", () => {
    const result = resolvePreferenceCenterTheme({
      theme: null,
      brandColor: "javascript:alert(1)",
    });
    expect(result.light.primary).toBeUndefined();
    expect(result.dark.primary).toBeUndefined();
  });

  it("does not overwrite an existing primary with brandColor", () => {
    const theme: PreferenceCenterTheme = {
      version: 1,
      light: { primary: "oklch(0.4 0.1 20)" },
      dark: { primary: "oklch(0.6 0.1 20)" },
      fonts: { body: null, heading: null },
      colorScheme: "system",
    };
    const result = resolvePreferenceCenterTheme({
      theme,
      brandColor: "#3b82f6",
    });
    expect(result.light.primary).toBe("oklch(0.4 0.1 20)");
    expect(result.dark.primary).toBe("oklch(0.6 0.1 20)");
  });
});
