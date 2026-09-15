import { describe, expect, it } from "vitest";
import {
  APPROACHES,
  APPROACHES_RUBRIC,
  WRAPPER_CRITERIA,
  WRAPS_LIMITS,
} from "../config/approaches";

/*
 * The /approaches page only works if it is fair — and fair is not the same as
 * deferential. Two things are pinned here, because a later copy edit could
 * break either one:
 *
 *   1. Every approach gets a real strength and a real reader, including the
 *      three that are not ours. A rubric that only lists competitors'
 *      weaknesses is not worth a reader's attention.
 *   2. Wraps stays INSIDE the fourth approach rather than becoming a fifth
 *      standing outside it, and WRAPS_LIMITS keeps naming where we lose. An
 *      earlier version made Wraps its own category and then recommended the
 *      free wrappers over it, which conceded a category we belong to.
 *
 * Mirrors the intent of alternatives.test.ts, which does the same job for the
 * ranked-list pages.
 */

const ours = APPROACHES.filter((a) => a.isOurs);
const others = APPROACHES.filter((a) => !a.isOurs);

describe("the four approaches rubric", () => {
  it("is four approaches, with Wraps inside one of them", () => {
    expect(APPROACHES).toHaveLength(4);
    expect(ours).toHaveLength(1);
    expect(ours[0]?.id).toBe("oss-wrapper");
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
      expect(approach.pro).not.toMatch(/^\s*(cheap|free)\.?\s*$/i);
      expect(approach.examples.trim().length).toBeGreaterThan(0);
    }
  );

  it("sends the reader with no AWS account to a hosted API", () => {
    // The one genuine "not us" recommendation, and it stays. It points at a
    // different approach, not at a competitor inside our own row.
    const api = APPROACHES.find((a) => a.id === "sending-api");
    expect(api?.pickThisIf).toMatch(/no AWS account/i);
  });

  it("keeps Wraps named among the wrappers rather than opposite them", () => {
    // If our own row stops naming the alternatives, the page has quietly become
    // a pitch. If it stops naming us, we have conceded the category again.
    const row = ours[0];
    expect(row?.examples).toMatch(/Wraps/);
    expect(row?.examples).toMatch(/useSend/);
    expect(row?.examples).toMatch(/OpenSend/);
  });

  it("never recommends another wrapper over Wraps", () => {
    // The specific regression this file exists to prevent.
    const conceded =
      /serve you better|pay nobody|better than we will|you do not need (it|us)/i;
    for (const approach of APPROACHES) {
      expect(approach.pickThisIf).not.toMatch(conceded);
      expect(approach.con).not.toMatch(conceded);
      expect(approach.pro).not.toMatch(conceded);
    }
  });

  it("asks the operational questions, and concedes the one nobody can do", () => {
    expect(WRAPPER_CRITERIA.length).toBeGreaterThanOrEqual(4);
    const productionAccess = WRAPPER_CRITERIA.find((c) =>
      /production access/i.test(c.question)
    );
    expect(productionAccess?.wraps).toMatch(/^No\./);
  });

  it("keeps our own limits naming the four things we lose on", () => {
    const all = WRAPS_LIMITS.join(" ");
    expect(all).toMatch(/AWS account/i);
    expect(all).toMatch(/production access/i);
    expect(all).toMatch(/SOC 2/i);
    expect(all).toMatch(/our database/i);
  });

  it("frames the page as a rubric rather than a ranking", () => {
    expect(APPROACHES_RUBRIC).toMatch(/pick the row that describes you/i);
  });
});
