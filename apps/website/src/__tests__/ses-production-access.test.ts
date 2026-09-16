import { describe, expect, it } from "vitest";
import {
  buildAppealReply,
  buildProductionAccessRequest,
  DEFAULT_REQUEST_ANSWERS,
  diagnoseDenial,
  normalizeWebsiteUrl,
  type RequestAnswers,
  SES_DENIAL_GAPS,
} from "@/lib/ses-production-access";

function answers(overrides: Partial<RequestAnswers> = {}): RequestAnswers {
  return {
    ...DEFAULT_REQUEST_ANSWERS,
    websiteUrl: "https://example.com",
    ...overrides,
  };
}

describe("the denial taxonomy", () => {
  it("carries exactly the four gaps the docs guide documents", () => {
    expect(SES_DENIAL_GAPS.map((gap) => gap.id)).toEqual([
      "no-verified-domain",
      "website-does-not-explain-the-mail",
      "no-opt-in-story",
      "no-bounce-handling",
    ]);
  });

  it("gives every gap remediation steps and an appeal paragraph", () => {
    for (const gap of SES_DENIAL_GAPS) {
      expect(gap.remediation.length).toBeGreaterThan(0);
      expect(gap.appealParagraph.length).toBeGreaterThan(40);
      expect(gap.matchers.length).toBeGreaterThan(0);
    }
  });

  it("writes every matcher in the normalized shape the matcher compares against", () => {
    // A matcher with punctuation or a capital can never fire, because the
    // pasted text is lowercased and stripped of punctuation first.
    for (const gap of SES_DENIAL_GAPS) {
      for (const phrase of gap.matchers) {
        expect(phrase).toMatch(/^[a-z0-9]+( [a-z0-9]+)*$/);
      }
    }
  });
});

describe("diagnoseDenial", () => {
  it("maps a domain-verification denial to the verified-domain gap alone", () => {
    const result = diagnoseDenial(
      "We were unable to verify your sending domain. Please complete domain verification and enable DKIM before resubmitting."
    );
    expect(result.matched.map((gap) => gap.id)).toEqual(["no-verified-domain"]);
    expect(result.generic).toBe(false);
    expect(result.unrecognized).toBe(false);
  });

  it("maps a question about how the list was built to the opt-in gap", () => {
    const result = diagnoseDenial(
      "Please describe how you obtain consent from the recipients on your mailing list."
    );
    expect(result.matched.map((gap) => gap.id)).toEqual(["no-opt-in-story"]);
  });

  it("maps a bounce and complaint question to the bounce-handling gap", () => {
    const result = diagnoseDenial(
      "Tell us how you process bounces and complaints, and how recipients unsubscribe."
    );
    expect(result.matched.map((gap) => gap.id)).toEqual(["no-bounce-handling"]);
  });

  it("matches hyphenated and capitalized phrasing the same as plain text", () => {
    // "opt-in" only reaches the matcher if punctuation is normalized away.
    const result = diagnoseDenial("How do recipients OPT-IN to your list?");
    expect(result.matched.map((gap) => gap.id)).toEqual(["no-opt-in-story"]);
  });

  it("returns several gaps when the denial names several", () => {
    const result = diagnoseDenial(
      "Your website does not describe the email you intend to send, and you have not told us how you handle bounces."
    );
    expect(result.matched.map((gap) => gap.id)).toEqual([
      "website-does-not-explain-the-mail",
      "no-bounce-handling",
    ]);
    expect(result.generic).toBe(false);
  });

  it("returns all four gaps, flagged generic, for the boilerplate AWS denial", () => {
    const result = diagnoseDenial(
      "We reviewed your request and determined that your use of Amazon SES could have a negative impact on our service. As a result, we are unable to grant your request at this time."
    );
    expect(result.generic).toBe(true);
    expect(result.unrecognized).toBe(false);
    expect(result.matched).toHaveLength(4);
  });

  it("flags text that is not an SES decision at all rather than guessing", () => {
    const result = diagnoseDenial("thanks for lunch yesterday, see you monday");
    expect(result.unrecognized).toBe(true);
    expect(result.generic).toBe(false);
    expect(result.matched).toEqual([]);
  });

  it("treats empty and whitespace-only input as nothing to diagnose", () => {
    expect(diagnoseDenial("").unrecognized).toBe(true);
    expect(diagnoseDenial("   \n\t ").unrecognized).toBe(true);
  });
});

describe("buildAppealReply", () => {
  it("opens with a guard telling the user to delete anything untrue", () => {
    const reply = buildAppealReply(diagnoseDenial("please verify your domain"));
    expect(reply.startsWith("[Before you send:")).toBe(true);
    expect(reply).toContain("Delete anything you have not done");
  });

  it("includes only the paragraphs for the gaps that matched", () => {
    const reply = buildAppealReply(
      diagnoseDenial("Please describe how you obtain consent from recipients.")
    );
    expect(reply).toContain("How recipients opt in:");
    expect(reply).not.toContain("Sending domain:");
    expect(reply).not.toContain("Bounces and complaints:");
  });

  it("covers all four gaps for the boilerplate denial", () => {
    const reply = buildAppealReply(
      diagnoseDenial(
        "your use of Amazon SES could have a negative impact on our service"
      )
    );
    for (const gap of SES_DENIAL_GAPS) {
      expect(reply).toContain(gap.appealParagraph);
    }
  });

  it("returns nothing for text it could not recognize", () => {
    expect(buildAppealReply(diagnoseDenial("hello there"))).toBe("");
  });
});

describe("normalizeWebsiteUrl", () => {
  it("adds https to a bare host", () => {
    expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com");
  });

  it("leaves an existing scheme alone", () => {
    expect(normalizeWebsiteUrl("http://example.com")).toBe(
      "http://example.com"
    );
    expect(normalizeWebsiteUrl("https://example.com/app")).toBe(
      "https://example.com/app"
    );
  });

  it("returns empty for blank input rather than a bare scheme", () => {
    expect(normalizeWebsiteUrl("   ")).toBe("");
  });
});

describe("buildProductionAccessRequest", () => {
  it("is deterministic — the same answers produce the same words", () => {
    const first = buildProductionAccessRequest(answers());
    const second = buildProductionAccessRequest(answers());
    expect(first.text).toBe(second.text);
  });

  it("answers all four questions the AWS form never asks", () => {
    const { text } = buildProductionAccessRequest(answers());
    expect(text).toContain("https://example.com");
    expect(text).toContain("How recipients opt in:");
    expect(text).toContain("Volume:");
    expect(text).toContain("Bounces and complaints:");
    expect(text).toContain("Unsubscribe:");
  });

  it("describes double opt-in only when double opt-in was selected", () => {
    const withConfirm = buildProductionAccessRequest(
      answers({ optIn: "form-double-opt-in" })
    ).text;
    expect(withConfirm).toContain(
      "confirmed by clicking a link in a confirmation email"
    );

    const withoutConfirm = buildProductionAccessRequest(
      answers({ optIn: "in-app-signup" })
    ).text;
    expect(withoutConfirm).not.toContain("confirmation email");
    expect(withoutConfirm).toContain("created an account");
  });

  it("formats the volume with a thousands separator and the chosen period", () => {
    const { text } = buildProductionAccessRequest(
      answers({ volume: 50_000, volumePeriod: "day" })
    );
    expect(text).toContain("Volume: about 50,000 emails per day.");
  });

  it("never claims bounce handling the user does not have", () => {
    const { text, warnings, hasBlockingGap } = buildProductionAccessRequest(
      answers({ bounceHandling: "none" })
    );
    expect(text).not.toContain("suppression list");
    expect(text).not.toContain("removed from the list automatically");
    expect(text).toContain("Bounces and complaints: [ACTION REQUIRED");
    expect(hasBlockingGap).toBe(true);
    expect(
      warnings.some(
        (warning) => warning.field === "bounceHandling" && warning.blocking
      )
    ).toBe(true);
  });

  it("never claims an unsubscribe mechanism on bulk mail that does not exist", () => {
    const { text, hasBlockingGap } = buildProductionAccessRequest(
      answers({ mailType: "newsletter", unsubscribe: "none" })
    );
    expect(text).not.toContain("List-Unsubscribe");
    expect(text).not.toContain("honored immediately");
    expect(text).toContain("Unsubscribe: [ACTION REQUIRED");
    expect(hasBlockingGap).toBe(true);
  });

  it("states the earned reason transactional mail carries no unsubscribe, without blocking", () => {
    const { text, warnings, hasBlockingGap } = buildProductionAccessRequest(
      answers({ mailType: "transactional", unsubscribe: "none" })
    );
    expect(text).toContain(
      "these messages are transactional — each one is triggered by the recipient's own action"
    );
    expect(text).not.toContain("ACTION REQUIRED");
    expect(hasBlockingGap).toBe(false);
    expect(
      warnings.some(
        (warning) => warning.field === "unsubscribe" && !warning.blocking
      )
    ).toBe(true);
  });

  it("refuses to invent an opt-in story when the user picked 'other' and wrote nothing", () => {
    const { text, hasBlockingGap } = buildProductionAccessRequest(
      answers({ optIn: "other", optInDetail: "" })
    );
    expect(text).toContain("How recipients opt in: [ACTION REQUIRED");
    expect(hasBlockingGap).toBe(true);
  });

  it("uses the user's own sentence when they supplied one", () => {
    const { text, hasBlockingGap } = buildProductionAccessRequest(
      answers({
        optIn: "other",
        optInDetail:
          "Recipients are placed on the list by their own account administrator inside our B2B product.",
      })
    );
    expect(text).toContain("by their own account administrator");
    expect(text).not.toContain("ACTION REQUIRED");
    expect(hasBlockingGap).toBe(false);
  });

  it("warns about an imported list without blocking the request", () => {
    const { warnings, hasBlockingGap } = buildProductionAccessRequest(
      answers({ optIn: "imported-customers" })
    );
    expect(hasBlockingGap).toBe(false);
    expect(
      warnings.some((warning) => warning.field === "optIn" && !warning.blocking)
    ).toBe(true);
  });

  it("blocks on a missing website URL and leaves a placeholder, not a fake domain", () => {
    const { text, hasBlockingGap } = buildProductionAccessRequest(
      answers({ websiteUrl: "" })
    );
    expect(text).toContain("[your website URL]");
    expect(text).not.toContain("https://example");
    expect(hasBlockingGap).toBe(true);
  });

  it("blocks on a missing or nonsensical volume", () => {
    expect(
      buildProductionAccessRequest(answers({ volume: 0 })).hasBlockingGap
    ).toBe(true);
    expect(
      buildProductionAccessRequest(answers({ volume: Number.NaN })).text
    ).toContain("Volume: [ACTION REQUIRED");
  });

  it("reports no blocking gap when every answer is earned", () => {
    const { warnings, hasBlockingGap, text } = buildProductionAccessRequest(
      answers({
        mailType: "both",
        optIn: "form-double-opt-in",
        bounceHandling: "ses-event-destination",
        unsubscribe: "both",
        volume: 20_000,
      })
    );
    expect(hasBlockingGap).toBe(false);
    expect(warnings).toEqual([]);
    expect(text).not.toContain("ACTION REQUIRED");
  });
});
