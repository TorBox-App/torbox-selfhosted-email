/**
 * The SES production-access denial taxonomy, and a deterministic builder for
 * the support-case text that answers it.
 *
 * The AWS request form asks for an email type, a website and contact
 * addresses, so reviewers have to infer sending practices from almost
 * nothing. Denials therefore cluster into four gaps. That taxonomy is
 * documented in `src/app/docs/guides/production-access/page-content.tsx`;
 * it lives here so the guide and `/tools/ses-production-access` render the
 * same four gaps rather than drifting into two conflicting lists.
 *
 * Everything in this module is pure and synchronous. No network, no LLM: the
 * output goes to AWS support under the user's own name and has to be
 * predictable, and the denial text a user pastes in never leaves the browser.
 */

export type DenialGapId =
  | "no-verified-domain"
  | "website-does-not-explain-the-mail"
  | "no-opt-in-story"
  | "no-bounce-handling";

export type DenialGap = {
  id: DenialGapId;
  /** Short label, matching the docs guide's bullet heading. */
  title: string;
  /** What the gap is, in the guide's own words. */
  summary: string;
  /** What to change before replying. The guide's rule: fix it, then reply. */
  remediation: readonly string[];
  /**
   * Lowercase, punctuation-free phrases. A denial that contains any of them
   * is treated as pointing at this gap. Deliberately plain substring matching
   * — a heuristic a reader can audit, not a model.
   */
  matchers: readonly string[];
  /** The paragraph this gap contributes to an appeal reply. */
  appealParagraph: string;
};

/**
 * The guide also notes that a brand-new AWS account draws more questions.
 * That is not a gap you can close, so it is not in the taxonomy — it is
 * context, and both surfaces render it as such.
 */
export const SES_NEW_ACCOUNT_NOTE =
  "A brand-new AWS account gives reviewers less history to go on, so expect more questions before approval. That is not something you can fix in the reply — answering the four gaps above is.";

export const SES_DENIAL_GAPS: readonly DenialGap[] = [
  {
    id: "no-verified-domain",
    title: "No verified domain",
    summary:
      "A request from an account that has only verified a single email address gives AWS nothing to check.",
    remediation: [
      "Verify the sending domain in SES, not just one address.",
      "Enable DKIM signing and wait for the status to leave Pending.",
      "Publish SPF and DMARC records for the same domain.",
    ],
    matchers: [
      "verified domain",
      "verify your domain",
      "verify the domain",
      "domain verification",
      "verified identity",
      "verified identities",
      "domain is not verified",
      "dkim",
      "spf",
      "dmarc",
    ],
    appealParagraph:
      "Sending domain: [domain] is verified in SES with DKIM signing enabled, and SPF and DMARC records are published for the same domain. The From address on every message uses this domain.",
  },
  {
    id: "website-does-not-explain-the-mail",
    title: "The website does not explain the mail",
    summary:
      "A parked domain, a landing page with no signup form, or a URL that does not match the sending domain.",
    remediation: [
      "Put the signup form, or the product the mail comes from, on a page a reviewer can reach without an account.",
      "Publish a privacy policy that says what you do with an email address.",
      "Use a website URL on the same domain you send from.",
    ],
    matchers: [
      "website",
      "web site",
      "landing page",
      "parked",
      "privacy policy",
      "terms of service",
      "unable to access",
      "could not access",
      "your url",
      "the url you provided",
    ],
    appealParagraph:
      "Website: [url] is live and describes the product the mail comes from. The signup form is at [signup url] and the privacy policy at [privacy url], both reachable without an account. The site is on the same domain we send from.",
  },
  {
    id: "no-opt-in-story",
    title: "No opt-in story",
    summary: "Nothing in the request says how recipients ended up on the list.",
    remediation: [
      "Write down, in one sentence, how an address gets onto the list.",
      "Say plainly that you do not buy, rent or scrape lists.",
      "If the list predates the form, say when and how those addresses were collected.",
    ],
    matchers: [
      "opt in",
      "optin",
      "consent",
      "permission",
      "how you obtain",
      "how you collect",
      "how you acquire",
      "mailing list",
      "subscriber list",
      "purchased list",
      "rented list",
      "recipients signed up",
      "how recipients are added",
    ],
    appealParagraph:
      "How recipients opt in: [describe the exact step — the form, the account signup, or the purchase — that puts an address on the list]. We do not buy, rent or scrape lists.",
  },
  {
    id: "no-bounce-handling",
    title: "No bounce or complaint handling",
    summary:
      "The acknowledgement box says you have a process. AWS wants to know what it is.",
    remediation: [
      "Subscribe to bounce and complaint events — an SES event destination or a webhook, not a mailbox nobody reads.",
      "Remove hard bounces and complaints from the list automatically, and keep them suppressed.",
      "Honor unsubscribe requests immediately, and carry List-Unsubscribe headers on bulk mail.",
    ],
    matchers: [
      "bounce",
      "bounces",
      "complaint",
      "complaints",
      "feedback loop",
      "suppression",
      "suppression list",
      "unsubscribe",
      "opt out",
      "optout",
    ],
    appealParagraph:
      "Bounces and complaints: the SES configuration set publishes bounce and complaint events to [EventBridge / our webhook at <url>]. Hard bounces and complaints are removed from the list automatically and added to the account-level suppression list. Every bulk message carries a one-click unsubscribe link and List-Unsubscribe headers, and requests are honored immediately.",
  },
] as const;

/**
 * Phrases that say "this is an SES production-access decision" without saying
 * which gap it is. AWS's standard denial is deliberately vague, so text that
 * matches only these is treated as generic rather than unrecognized.
 */
const DENIAL_SIGNALS: readonly string[] = [
  "amazon ses",
  "aws ses",
  "simple email service",
  "production access",
  "sending limit increase",
  "negative impact on our service",
  "we reviewed your request",
  "we are unable to grant",
  "sandbox",
  "case id",
  "support center",
];

/** Lowercase, strip punctuation, collapse whitespace. Matchers are written in this shape. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type DenialDiagnosis = {
  /** The gaps the text points at. Every gap, when the denial was generic. */
  matched: readonly DenialGap[];
  /** The denial is recognisable but names no specific gap — AWS's boilerplate. */
  generic: boolean;
  /** The text does not look like an SES production-access decision at all. */
  unrecognized: boolean;
};

/**
 * Match a pasted denial against the four gaps. Plain substring heuristics,
 * run in the browser. The text is never sent anywhere.
 */
export function diagnoseDenial(text: string): DenialDiagnosis {
  const haystack = normalize(text);

  if (haystack.length === 0) {
    return { matched: [], generic: false, unrecognized: true };
  }

  const matched = SES_DENIAL_GAPS.filter((gap) =>
    gap.matchers.some((phrase) => haystack.includes(phrase))
  );

  if (matched.length > 0) {
    return { matched, generic: false, unrecognized: false };
  }

  const looksLikeDenial = DENIAL_SIGNALS.some((phrase) =>
    haystack.includes(phrase)
  );

  // The standard denial names nothing, so there is no way to narrow it: the
  // honest answer is that all four gaps are still open.
  if (looksLikeDenial) {
    return { matched: SES_DENIAL_GAPS, generic: true, unrecognized: false };
  }

  return { matched: [], generic: false, unrecognized: true };
}

const APPEAL_GUARD =
  "[Before you send: every statement below must already be true of your account and your site. Delete anything you have not done — the reviewer will check.]";

/**
 * A reply for the existing support case. Placeholders are square-bracketed on
 * purpose: the tool knows nothing about the account in this mode, so it drafts
 * the shape of the answer and refuses to invent the content.
 */
export function buildAppealReply(diagnosis: DenialDiagnosis): string {
  if (diagnosis.unrecognized) {
    return "";
  }

  const body = diagnosis.matched.map((gap) => gap.appealParagraph).join("\n\n");

  return [
    APPEAL_GUARD,
    "",
    "Thank you for the review. We have closed the gaps below and would like you to reconsider the request.",
    "",
    body,
    "",
    "Volume: about [N] emails per [day/month], to [N] recipients.",
    "",
    "We are happy to provide anything else you need to complete the review.",
  ].join("\n");
}

/* ------------------------------------------------------------------------ */
/* Mode 1 — build the request                                                */
/* ------------------------------------------------------------------------ */

export type MailType = "transactional" | "newsletter" | "both";
export type OptInMethod =
  | "form-double-opt-in"
  | "in-app-signup"
  | "imported-customers"
  | "other";
export type BounceHandling =
  | "ses-event-destination"
  | "webhook"
  | "manual"
  | "none";
export type UnsubscribeMechanism =
  | "list-unsubscribe-header"
  | "in-email-link"
  | "both"
  | "none";
export type VolumePeriod = "day" | "month";

export type RequestAnswers = {
  mailType: MailType;
  optIn: OptInMethod;
  /** Free text that sharpens the opt-in answer. Required when optIn is "other". */
  optInDetail: string;
  websiteUrl: string;
  bounceHandling: BounceHandling;
  unsubscribe: UnsubscribeMechanism;
  volume: number;
  volumePeriod: VolumePeriod;
};

export type RequestWarningField =
  | "websiteUrl"
  | "optIn"
  | "bounceHandling"
  | "unsubscribe"
  | "volume";

export type RequestWarning = {
  field: RequestWarningField;
  /**
   * `blocking` means the request would assert something the user has not
   * earned. The text says so instead of claiming it, and the UI tells them to
   * fix the gap before submitting.
   */
  blocking: boolean;
  message: string;
};

export type BuiltRequest = {
  text: string;
  warnings: readonly RequestWarning[];
  /** True when at least one warning is blocking. */
  hasBlockingGap: boolean;
};

export const DEFAULT_REQUEST_ANSWERS: RequestAnswers = {
  mailType: "transactional",
  optIn: "in-app-signup",
  optInDetail: "",
  websiteUrl: "",
  bounceHandling: "ses-event-destination",
  unsubscribe: "both",
  volume: 5000,
  volumePeriod: "month",
};

const WEBSITE_PLACEHOLDER = "[your website URL]";

const HAS_SCHEME = /^https?:\/\//i;

/** Add a scheme when the user typed a bare host, so the reply carries a real link. */
export function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (HAS_SCHEME.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function mailTypeSentence(mailType: MailType, site: string): string {
  switch (mailType) {
    case "transactional":
      return `We send transactional email for ${site} — account, billing and security messages, each one triggered by something the recipient did in the product.`;
    case "newsletter":
      return `We send a newsletter and product announcements for ${site} to people who subscribed to receive them.`;
    default:
      return `We send two kinds of mail for ${site}: transactional messages triggered by something the recipient did in the product, and a newsletter to people who subscribed to receive it.`;
  }
}

function optInSentence(answers: RequestAnswers, site: string): string {
  const detail = answers.optInDetail.trim();
  const suffix = detail.length > 0 ? ` ${detail}` : "";
  const noLists = "We do not buy, rent or scrape lists.";

  switch (answers.optIn) {
    case "form-double-opt-in":
      return `How recipients opt in: every address on the list was entered into a signup form on ${site} and confirmed by clicking a link in a confirmation email. Addresses that are never confirmed are never mailed. ${noLists}${suffix}`;
    case "in-app-signup":
      return `How recipients opt in: every address belongs to someone who created an account on ${site}, and we mail the address they registered with. ${noLists}${suffix}`;
    case "imported-customers":
      return `How recipients opt in: the list is existing customers of ${site}, who gave us their address when they signed up or bought from us. ${noLists}${suffix}`;
    default:
      return `How recipients opt in:${suffix.length > 0 ? suffix : " [ACTION REQUIRED — describe, in one sentence, the exact step that puts an address on your list. A request that cannot answer this is the most common reason AWS declines.]"} ${noLists}`;
  }
}

function bounceSentence(answers: RequestAnswers): string {
  switch (answers.bounceHandling) {
    case "ses-event-destination":
      return "Bounces and complaints: our SES configuration set publishes bounce and complaint events to an event destination we own. Hard bounces and complaints are removed from the list automatically and added to the account-level suppression list.";
    case "webhook":
      return "Bounces and complaints: bounce and complaint notifications are delivered to a webhook in our application. Hard bounces and complaints are suppressed on receipt and the address is not mailed again.";
    case "manual":
      return "Bounces and complaints: bounce and complaint notifications are delivered to a mailbox we monitor, and the addresses are removed from the list by hand within one business day.";
    default:
      return "Bounces and complaints: [ACTION REQUIRED — you have no bounce or complaint handling yet. Set it up before you reply. The acknowledgement box on the request form says you have a process, so a reply that cannot describe one is worse than no reply.]";
  }
}

function unsubscribeSentence(answers: RequestAnswers): string {
  switch (answers.unsubscribe) {
    case "list-unsubscribe-header":
      return "Unsubscribe: every message carries List-Unsubscribe and List-Unsubscribe-Post headers, so one-click unsubscribe works in the recipient's mail client. Requests are honored immediately.";
    case "in-email-link":
      return "Unsubscribe: every message carries an unsubscribe link in the body. Requests are honored immediately.";
    case "both":
      return "Unsubscribe: every message carries an unsubscribe link in the body and List-Unsubscribe headers for one-click unsubscribe. Requests are honored immediately.";
    default:
      // Earned from their own answer: transactional mail is triggered by the
      // recipient's own action, so it carries no marketing unsubscribe.
      if (answers.mailType === "transactional") {
        return "Unsubscribe: these messages are transactional — each one is triggered by the recipient's own action in the product — so they do not carry a marketing unsubscribe link. Recipients can close their account or contact us to stop receiving them.";
      }
      return "Unsubscribe: [ACTION REQUIRED — you have no unsubscribe mechanism yet. Bulk mail needs one before you reply, and AWS checks for it.]";
  }
}

function volumeSentence(answers: RequestAnswers): string {
  const period = answers.volumePeriod === "day" ? "day" : "month";
  if (!Number.isFinite(answers.volume) || answers.volume <= 0) {
    return `Volume: [ACTION REQUIRED — state how many emails you expect to send per ${period}.]`;
  }
  return `Volume: about ${Math.round(answers.volume).toLocaleString("en-US")} emails per ${period}.`;
}

function collectWarnings(answers: RequestAnswers): RequestWarning[] {
  const warnings: RequestWarning[] = [];

  if (normalizeWebsiteUrl(answers.websiteUrl).length === 0) {
    warnings.push({
      field: "websiteUrl",
      blocking: true,
      message:
        "No website URL. Reviewers open the URL you give them — a request without one, or with a parked domain behind it, is the second most common denial.",
    });
  }

  if (answers.optIn === "other" && answers.optInDetail.trim().length === 0) {
    warnings.push({
      field: "optIn",
      blocking: true,
      message:
        'You picked "something else" and left the description empty, so the request cannot say how recipients ended up on your list. Write that sentence yourself — this tool will not invent one.',
    });
  }

  if (answers.optIn === "imported-customers") {
    warnings.push({
      field: "optIn",
      blocking: false,
      message:
        "An imported list draws more questions than a signup form. Add when and how those addresses were collected in the description box.",
    });
  }

  if (answers.bounceHandling === "none") {
    warnings.push({
      field: "bounceHandling",
      blocking: true,
      message:
        "No bounce or complaint handling. Set this up before you submit — the request form's acknowledgement box already claims you have a process, and this is the gap AWS asks about most.",
    });
  }

  if (answers.bounceHandling === "manual") {
    warnings.push({
      field: "bounceHandling",
      blocking: false,
      message:
        "Handling bounces by hand is accepted but weak. An SES event destination that suppresses automatically is a stronger answer, and it is what AWS is really asking for.",
    });
  }

  if (answers.unsubscribe === "none" && answers.mailType !== "transactional") {
    warnings.push({
      field: "unsubscribe",
      blocking: true,
      message:
        "No unsubscribe mechanism on bulk mail. Add one before you submit — this tool will not claim you have one.",
    });
  }

  if (answers.unsubscribe === "none" && answers.mailType === "transactional") {
    warnings.push({
      field: "unsubscribe",
      blocking: false,
      message:
        "Transactional mail does not need a marketing unsubscribe, and the request says so. The moment you send anything promotional, it does.",
    });
  }

  if (!Number.isFinite(answers.volume) || answers.volume <= 0) {
    warnings.push({
      field: "volume",
      blocking: true,
      message:
        "No expected volume. A number, even a rough one, tells the reviewer what they are approving.",
    });
  }

  return warnings;
}

/**
 * Build the support-case text. Deterministic: the same answers always produce
 * the same words, because this goes to AWS under the user's name.
 *
 * A "none yet" answer never becomes a claim. The paragraph says the gap is
 * open and tells the user to close it first — the guide's rule is to fix the
 * gap before you reply, not after.
 */
export function buildProductionAccessRequest(
  answers: RequestAnswers
): BuiltRequest {
  const normalizedUrl = normalizeWebsiteUrl(answers.websiteUrl);
  const site = normalizedUrl.length > 0 ? normalizedUrl : WEBSITE_PLACEHOLDER;
  const warnings = collectWarnings(answers);

  const text = [
    mailTypeSentence(answers.mailType, site),
    "",
    optInSentence(answers, site),
    "",
    volumeSentence(answers),
    "",
    bounceSentence(answers),
    "",
    unsubscribeSentence(answers),
  ].join("\n");

  return {
    text,
    warnings,
    hasBlockingGap: warnings.some((warning) => warning.blocking),
  };
}
