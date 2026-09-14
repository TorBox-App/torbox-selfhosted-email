import { describe, expect, it } from "vitest";
import { APPROACHES, APPROACHES_RUBRIC } from "../config/approaches";

/*
 * The /approaches page only works if it is fair. Its whole claim on a reader's
 * attention is that the vendor writing it will send them somewhere else when
 * somewhere else is the right answer — so the fairness is pinned here rather
 * than left to whoever edits the copy next.
 *
 * Mirrors the intent of alternatives.test.ts, which does the same job for the
 * ranked-list pages.
 */

const us = APPROACHES.filter((a) => a.isUs);
const others = APPROACHES.filter((a) => !a.isUs);

describe("the four approaches rubric", () => {
  it("covers four alternatives plus us, and names exactly one of them as us", () => {
    expect(us).toHaveLength(1);
    expect(others).toHaveLength(4);
  });

  it("has no duplicate ids", () => {
    const ids = APPROACHES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(APPROACHES.map((a) => [a.id, a] as const))(
    "%s: states a substantive strength, cost, and reader",
    (_id, approach) => {
      expect(approach.pro.length).toBeGreaterThan(120);
      expect(approach.con.length).toBeGreaterThan(120);
      expect(approach.pickThisIf.length).toBeGreaterThan(60);
    }
  );

  it.each(others.map((a) => [a.id, a] as const))(
    "%s: is credited with something real, not a straw man",
    (_id, approach) => {
      // A pro that only concedes cheapness is the shape a hit piece takes.
      expect(approach.pro).not.toMatch(/^\s*(cheap|free)\.?\s*$/i);
      expect(approach.examples.trim().length).toBeGreaterThan(0);
    }
  );

  it("keeps a competitor as the honest recommendation for two readers", () => {
    // The whole point. If nobody is sent elsewhere, this is a pitch, not a rubric.
    const sendsThemAway = others.filter((a) =>
      /\b(this is the honest answer|pay nobody|better than we will|we will say so)\b/i.test(
        a.pickThisIf
      )
    );
    expect(sendsThemAway.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the open-source wrappers in the rubric, named", () => {
    // These are the competitors it is most tempting to leave out. Leaving them
    // out is what makes a comparison page read as evasive.
    const wrappers = APPROACHES.find((a) => a.id === "oss-wrapper");
    expect(wrappers).toBeDefined();
    expect(wrappers?.examples).toMatch(/useSend/);
    expect(wrappers?.examples).toMatch(/OpenSend/);
  });

  it("keeps our own entry naming the four things we lose on", () => {
    // Same rule the Wraps row in alternatives.ts carries: the watch-out cannot
    // be softened without failing a test.
    const con = us[0]?.con ?? "";
    expect(con).toMatch(/AWS account/i);
    expect(con).toMatch(/production access/i);
    expect(con).toMatch(/SOC 2/i);
    expect(con).toMatch(/our database/i);
  });

  it("frames the page as a rubric rather than a ranking", () => {
    expect(APPROACHES_RUBRIC).toMatch(/pick the row that describes you/i);
  });
});
