import { describe, expect, it } from "vitest";
import {
  type ReleaseTag,
  releases,
  TAG_LABELS,
} from "@/app/changelog/releases";

/**
 * Entries migrated before the field existed. Lower this number whenever an
 * entry gains a summary; never raise it. New entries must ship one — the
 * changelog skill's editorial gate requires it.
 */
const ENTRIES_WITHOUT_SUMMARY_CEILING = 63;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("changelog entries", () => {
  it("has the entries it is supposed to have", () => {
    expect(releases.length).toBeGreaterThanOrEqual(60);
  });

  it("gives every entry a unique slug", () => {
    const slugs = releases.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses URL-safe slugs", () => {
    const bad = releases.filter((r) => !SLUG.test(r.slug)).map((r) => r.slug);
    expect(bad).toEqual([]);
  });

  it("dates every entry as ISO yyyy-mm-dd", () => {
    const bad = releases
      .filter((r) => !ISO_DATE.test(r.date))
      .map((r) => r.slug);
    expect(bad).toEqual([]);
  });

  it("dates no entry in the future", () => {
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
    const bad = releases
      .filter((r) => Date.parse(`${r.date}T00:00:00Z`) > tomorrow)
      .map((r) => r.slug);
    expect(bad).toEqual([]);
  });

  it("tags every entry with at least one known surface", () => {
    const known = new Set(Object.keys(TAG_LABELS) as ReleaseTag[]);
    const bad = releases.filter(
      (r) => r.tags.length === 0 || r.tags.some((t) => !known.has(t))
    );
    expect(bad.map((r) => r.slug)).toEqual([]);
  });

  it("gives every entry a title and at least one item", () => {
    const bad = releases.filter(
      (r) => r.title.trim() === "" || r.items.length === 0
    );
    expect(bad.map((r) => r.slug)).toEqual([]);
  });

  it("keeps no version number in a title — the title is the capability", () => {
    const bad = releases.filter((r) => /\bv\d/.test(r.title));
    expect(bad.map((r) => r.slug)).toEqual([]);
  });

  it("does not grow the number of entries missing a summary", () => {
    const missing = releases.filter((r) => r.summary === undefined);
    expect(missing.length).toBeLessThanOrEqual(ENTRIES_WITHOUT_SUMMARY_CEILING);
  });

  it("never carries a manufactured v prefix in a version footnote", () => {
    // Inherited from plan 337, moved to the data. The old renderer prefixed
    // any version string lacking the letter `v`, publishing
    // "vAgent-Ready Platform" / "vWorkflow Engine" / "vWebsite". The renderer
    // no longer prefixes anything, so this pins the only remaining way the
    // string could go out wrong: the data itself carrying the prefix.
    const bogus = releases
      .flatMap((r) => r.versions ?? [])
      .filter((version) => /^v[A-Za-z]/.test(version));
    expect(bogus).toEqual([]);
  });

  it("keeps alsoFixed as plain strings the feed can render", () => {
    const bad = releases.filter((r) =>
      r.alsoFixed?.some((fix) => typeof fix !== "string")
    );
    expect(bad.map((r) => r.slug)).toEqual([]);
  });
});
