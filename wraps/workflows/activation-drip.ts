import {
  condition,
  defineWorkflow,
  delay,
  exit,
  sendEmail,
  updateContact,
  waitForEvent,
} from "@wraps.dev/client";

/**
 * Activation Drip Campaign
 *
 * Reactive activation sequence that listens for milestones instead of
 * checking at fixed intervals. Users who complete steps fast get immediate
 * next-step guidance and velocity tracking; stalled users get nudges.
 *
 *   +2h    → Wait for AWS connection        → nudge if timeout
 *   Day 1  → Wait for domain verification   → nudge if timeout
 *   Day 2  → Wait for first email sent      → nudge if timeout
 *   Day 4  → Velocity gate                  → power-user or celebration
 *   Day 4  → Workflow check                 → nudge if no
 *   Day 10 → Wait for first broadcast       → nudge if timeout
 */
export default defineWorkflow({
  name: "Activation Drip Campaign",
  description:
    "Reactive activation sequence — listens for milestones, tracks velocity, celebrates fast movers.",

  trigger: { type: "event", eventName: "onboarding.completed" },
  settings: { allowReentry: false },

  steps: [
    // ── Gate: skip start_building users (they have their own workflow) ─
    condition("check-path", {
      field: "contact.properties.onboardingPath",
      operator: "not_equals",
      value: "start_building",
      branches: {
        yes: [],
        no: [exit("wrong-path")],
      },
    }),

    // ── +2 hours: Wait for AWS connection ────────────────────────────
    waitForEvent("wait-aws", {
      eventName: "activation.aws_connected",
      timeout: { hours: 2 },
    }),
    condition("check-aws", {
      field: "contact.hasConnectedAws",
      operator: "is_true",
      branches: {
        yes: [
          updateContact("velocity-aws", {
            updates: [
              { field: "velocityScore", operation: "increment", value: 1 },
            ],
          }),
        ],
        no: [sendEmail("nudge-aws", { template: "nudge-connect-aws" })],
      },
    }),

    // ── Day 1: Wait for domain verification ──────────────────────────
    waitForEvent("wait-domain", {
      eventName: "activation.domain_verified",
      timeout: { hours: 22 },
    }),
    condition("check-domain", {
      field: "contact.hasDomainVerified",
      operator: "is_true",
      branches: {
        yes: [
          updateContact("velocity-domain", {
            updates: [
              { field: "velocityScore", operation: "increment", value: 1 },
            ],
          }),
        ],
        no: [sendEmail("nudge-domain", { template: "nudge-verify-domain" })],
      },
    }),

    // ── Day 2: Wait for first email ──────────────────────────────────
    waitForEvent("wait-email", {
      eventName: "activation.first_email_sent",
      timeout: { days: 1 },
    }),
    condition("check-email", {
      field: "contact.hasSentEmail",
      operator: "is_true",
      branches: {
        yes: [
          updateContact("velocity-email", {
            updates: [
              { field: "velocityScore", operation: "increment", value: 1 },
            ],
          }),
        ],
        no: [sendEmail("nudge-email", { template: "nudge-send-first-email" })],
      },
    }),

    // ── Day 4: Velocity gate ─────────────────────────────────────────
    delay("wait-2d", { days: 2 }),
    condition("check-velocity", {
      field: "contact.properties.velocityScore",
      operator: "greater_than_or_equals",
      value: 3,
      branches: {
        yes: [
          sendEmail("power-user", { template: "activation-power-user" }),
          exit("power-activated", { markAs: "completed" }),
        ],
        no: [],
      },
    }),

    // ── Day 4: Activation score gate (non-velocity users) ────────────
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

    // ── Day 10: Wait for first broadcast ─────────────────────────────
    waitForEvent("wait-broadcast", {
      eventName: "activation.first_broadcast",
      timeout: { days: 6 },
    }),
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
