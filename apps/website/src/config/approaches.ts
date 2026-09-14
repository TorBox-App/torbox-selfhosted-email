/**
 * The four ways to send application email, as a rubric rather than a takedown.
 *
 * Source: ~/Obsidian/ops/sops/positioning.md, Section 1 — the positioning
 * canvas. That document is upstream of this file; if the two disagree, it wins.
 *
 * Every approach carries a real `pro` and a real `pickThisIf`, including the
 * ones that are not us. That is the whole point of the page: a buyer who has
 * already decided against AWS should leave here with a better answer, not a
 * worse opinion of us. `src/__tests__/approaches.test.ts` enforces it, so a
 * later copy edit cannot quietly turn this into a competitor hit piece.
 *
 * Vendor prices are NOT inlined here — they live in `alternatives.ts`, which is
 * the single source of truth for every vendor number on the site.
 */

export type ApproachId =
  | "diy"
  | "sending-api"
  | "marketing-platform"
  | "oss-wrapper"
  | "wraps";

export type Approach = {
  id: ApproachId;
  /** Short label used in the rubric table. */
  label: string;
  /** The approach stated as the buyer would state it. */
  title: string;
  /** Who plays here. Named, because a reader can check. */
  examples: string;
  /** What this approach is actually good at. Written to be fair. */
  pro: string;
  /** What it costs you. Written to be specific rather than damning. */
  con: string;
  /** The reader who should stop here and go do this instead. */
  pickThisIf: string;
  isUs?: boolean;
};

export const APPROACHES: readonly Approach[] = [
  {
    id: "diy",
    label: "Run SES yourself",
    title: "Run Amazon SES yourself",
    examples: "You, the AWS console, and a week",
    pro: "Cheapest by an order of magnitude — $0.10 per 1,000 emails à la carte, $0.16 on the Essentials plan new accounts default to. You own the account, the domain reputation, and the data. No third party sits in the send path, and there is nothing to migrate, ever.",
    con: "Sandboxed by default, and production access is an AWS approval that can be refused. You own bounce and complaint handling, and AWS pauses accounts that get it wrong. There is no dashboard, no templates, no event pipeline, no suppression UI and no message search until you build them.",
    pickThisIf:
      "You already have production access, you have run SES before, and you have the volume to justify building the operational layer once and maintaining it.",
  },
  {
    id: "sending-api",
    label: "Rent a sending API",
    title: "Rent a sending API",
    examples: "Resend, Postmark, SendGrid, Mailgun",
    pro: "Working in minutes, with no AWS account at all. Resend's developer experience is excellent and deserves its reputation. Deliverability is somebody else's job, and when mail goes missing there is a support desk to ask.",
    con: "Markup that compounds with volume. A shared IP reputation pool you neither see nor control. Short log retention. Your sending history lives with them and leaves with them, and you keep no infrastructure when you go.",
    pickThisIf:
      "You want to send email today and never think about AWS. For a small team with no AWS commitment this is the honest answer, and we will say so on a sales call.",
  },
  {
    id: "marketing-platform",
    label: "Rent a marketing platform",
    title: "Rent a marketing or notification platform",
    examples: "Customer.io, Klaviyo, Braze, Knock",
    pro: "Campaigns, segmentation and lifecycle automation that a non-engineer can operate without filing a ticket. A mature, well-understood category with people who already know how to run it.",
    con: "Contact-based pricing, so you pay for contacts who never open anything. Entry pricing before a single send. The heaviest lock-in of the four, and sending is bundled in, so you cannot keep the platform and change the sender.",
    pickThisIf:
      "Someone who is not an engineer owns email day to day, and the contact-based bill is worth not having to build campaign tooling.",
  },
  {
    id: "oss-wrapper",
    label: "Self-host an open-source wrapper",
    title: "Self-host an open-source wrapper on your own SES",
    examples: "OpenSend, useSend, MillionSend, FreeResend, Plunk",
    pro: "Free, or close to it — you pay AWS for sending and nothing for the platform. Most expose a Resend-compatible API, so migrating off Resend is a base-URL change. Dashboard, domain verification, webhooks and broadcasts are all there, and the source is open, so the ownership argument is theirs as much as ours. Several are good.",
    con: "They ship the platform layer and stop there. Checked in September 2026, none of them helps with production access, governs bounces and complaints past emitting a webhook, runs blacklist checks, or watches your account against the rates AWS enforces. Most ask for long-lived AWS access keys in a container you now run. You end up operating the platform as well as SES.",
    pickThisIf:
      "You already have production access, you already handle bounces, and what you want is a dashboard and a Resend-shaped API over the SES you are running well. Do this and pay nobody.",
  },
  {
    id: "wraps",
    label: "Wraps",
    title: "Run SES yourself, with an operations layer on top",
    examples: "Wraps",
    pro: "One command deploys SES, DKIM, SPF, DMARC, the event pipeline and suppression handling into your own AWS account, without touching SES resources you already have. Then the part the other four skip: bounce and complaint rates drawn against the lines AWS reviews and pauses at, swept hourly, plus deliverability and blacklist audits, a message-level event log, and a doctor that names the fix. We assume an IAM role you can revoke; we store no credentials.",
    con: "You need an AWS account and a reason to want one. We cannot grant SES production access — only AWS can, from your account, and some requests are refused. We are not SOC 2 certified. Contacts, templates and workflow state live in our database, not yours; sending data and delivery events land in your AWS.",
    pickThisIf:
      "You are committed to AWS, you want the account and the reputation to be yours, and you would rather not become an SES operator to get there.",
    isUs: true,
  },
];

/** The rubric's one-line framing. Kept here so the page and the test agree. */
export const APPROACHES_RUBRIC =
  "Four ways to send application email. Pick the row that describes you, not the one with the most checkmarks.";
