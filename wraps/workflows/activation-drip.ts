import {
  condition,
  defineWorkflow,
  delay,
  exit,
  sendEmail,
} from "@wraps.dev/client";

/**
 * Activation Drip Campaign
 *
 * Full-funnel activation checks after onboarding:
 *   +2h    → AWS connected?               → concierge onboarding if no
 *   Day 1  → Domain verified?             → nudge if no
 *   Day 2  → Has sent first email?        → nudge if no
 *   Day 4  → Activation score >= 3?       → celebrate & exit if yes
 *           → Has created a workflow?      → nudge if no
 *   Day 10 → Has sent a broadcast?        → nudge if no
 */
export default defineWorkflow({
  name: "Activation Drip Campaign",
  description:
    "Nudge users through every activation milestone after onboarding — from AWS connection to first broadcast.",

  trigger: { type: "event", eventName: "onboarding.completed" },
  settings: { allowReentry: false },

  steps: [
    // ── Gate: skip start_building users (they have their own workflow) ─
    // Uses not_equals so existing users without a path continue normally
    condition("check-path", {
      field: "contact.properties.onboardingPath",
      operator: "not_equals",
      value: "start_building",
      branches: {
        yes: [],
        no: [exit("wrong-path")],
      },
    }),

    // ── +2 hours: AWS connection check ────────────────────────────────
    delay("wait-2h", { hours: 2 }),
    condition("check-aws", {
      field: "contact.hasConnectedAws",
      operator: "is_true",
      branches: {
        yes: [],
        no: [sendEmail("nudge-aws", { template: "nudge-connect-aws" })],
      },
    }),

    // ── Day 1: Domain verification check ──────────────────────────────
    delay("wait-22h", { hours: 22 }),
    condition("check-domain", {
      field: "contact.hasDomainVerified",
      operator: "is_true",
      branches: {
        yes: [],
        no: [sendEmail("nudge-domain", { template: "nudge-verify-domain" })],
      },
    }),

    // ── Day 2: First email check ──────────────────────────────────────
    delay("wait-1d", { days: 1 }),
    condition("check-email", {
      field: "contact.hasSentEmail",
      operator: "is_true",
      branches: {
        yes: [],
        no: [sendEmail("nudge-email", { template: "nudge-send-first-email" })],
      },
    }),

    // ── Day 4: Celebration gate ───────────────────────────────────────
    delay("wait-2d", { days: 2 }),
    condition("check-score", {
      field: "contact.activationScore",
      operator: "greater_than_or_equals",
      value: 3,
      branches: {
        yes: [
          sendEmail("celebration", { template: "activation-crushing-it" }),
          exit("fully-activated", { markAs: "completed" }),
        ],
        no: [],
      },
    }),

    // ── Day 4: Workflow check (only reached if not fully activated) ───
    condition("check-workflow", {
      field: "contact.hasCreatedWorkflow",
      operator: "is_true",
      branches: {
        yes: [],
        no: [
          sendEmail("nudge-workflow", { template: "nudge-create-workflow" }),
        ],
      },
    }),

    // ── Day 10: Broadcast check ───────────────────────────────────────
    delay("wait-6d", { days: 6 }),
    condition("check-broadcast", {
      field: "contact.hasSentBroadcast",
      operator: "is_true",
      branches: {
        yes: [],
        no: [
          sendEmail("nudge-broadcast", { template: "nudge-send-broadcast" }),
        ],
      },
    }),
  ],
});
