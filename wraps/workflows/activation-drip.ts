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
 * Single workflow that checks 3 milestones after onboarding:
 *   Day 2  → Has sent first email?        → nudge if no
 *   Day 5  → Activation score >= 3?        → celebrate & exit if yes
 *           → Has created a workflow?       → nudge if no
 *   Day 19 → Has sent a broadcast?         → nudge if no
 */
export default defineWorkflow({
  name: "Activation Drip Campaign",
  description:
    "Nudge users through activation milestones after onboarding. Celebrates those who complete all 3 within 5 days.",

  trigger: { type: "event", eventName: "onboarding.completed" },
  settings: { allowReentry: false },

  steps: [
    // ── Day 2: First email check ──────────────────────────────────────
    delay("wait-2d", { days: 2 }),
    condition("check-email", {
      field: "contact.hasSentEmail",
      operator: "is_true",
      branches: {
        yes: [],
        no: [sendEmail("nudge-email", { template: "nudge-send-first-email" })],
      },
    }),

    // ── Day 5: Celebration gate ───────────────────────────────────────
    delay("wait-3d", { days: 3 }),
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

    // ── Day 5: Workflow check (only reached if not fully activated) ───
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

    // ── Day 19: Broadcast check ───────────────────────────────────────
    delay("wait-14d", { days: 14 }),
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
