import {
  condition,
  defineWorkflow,
  delay,
  exit,
  sendEmail,
} from "@wraps.dev/client";

/**
 * Activation Drip — Start Building Path
 *
 * For users who chose "Start building" during onboarding (no AWS yet).
 * Nudges product engagement first, team invite second, infrastructure last.
 *
 *   +1h    → Welcome: point to template editor
 *   Day 1  → Created a template?          → nudge if no
 *   Day 3  → Created a workflow?          → nudge if no
 *   Day 5  → Invite teammate              → always send
 *   Day 8  → Connected AWS?               → celebrate & exit if yes, nudge if no
 *   Day 12 → Final AWS check              → exit quietly
 */
export default defineWorkflow({
  name: "Activation Drip — Start Building",
  description:
    "Nudge start-building users through product engagement, team invite, then AWS connection.",

  trigger: { type: "event", eventName: "onboarding.completed" },
  settings: { allowReentry: false },

  steps: [
    // ── Gate: only run for start_building path ──────────────────────────
    condition("check-path", {
      field: "contact.properties.onboardingPath",
      operator: "equals",
      value: "start_building",
      branches: {
        yes: [],
        no: [exit("wrong-path")],
      },
    }),

    // ── +1 hour: Welcome email ──────────────────────────────────────────
    delay("wait-1h", { hours: 1 }),
    sendEmail("welcome-start-building", {
      template: "activation-start-building",
    }),

    // ── Day 1: Template creation check ──────────────────────────────────
    delay("wait-23h", { hours: 23 }),
    condition("check-template", {
      field: "contact.hasCreatedTemplate",
      operator: "is_true",
      branches: {
        yes: [],
        no: [
          sendEmail("nudge-template", {
            template: "nudge-create-template",
          }),
        ],
      },
    }),

    // ── Day 3: Workflow creation check ──────────────────────────────────
    delay("wait-2d", { days: 2 }),
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

    // ── Day 5: Invite teammate nudge ────────────────────────────────────
    delay("wait-2d-2", { days: 2 }),
    sendEmail("nudge-invite", { template: "nudge-invite-team" }),

    // ── Day 8: AWS connection check ─────────────────────────────────────
    delay("wait-3d", { days: 3 }),
    condition("check-aws", {
      field: "contact.hasConnectedAws",
      operator: "is_true",
      branches: {
        yes: [
          sendEmail("celebration", { template: "activation-crushing-it" }),
          exit("fully-activated", { markAs: "completed" }),
        ],
        no: [
          sendEmail("nudge-aws-ready", {
            template: "nudge-connect-aws-ready",
          }),
        ],
      },
    }),

    // ── Day 12: Final AWS check ─────────────────────────────────────────
    delay("wait-4d", { days: 4 }),
    condition("check-aws-final", {
      field: "contact.hasConnectedAws",
      operator: "is_true",
      branches: {
        yes: [
          sendEmail("celebration-late", { template: "activation-crushing-it" }),
          exit("activated-late", { markAs: "completed" }),
        ],
        no: [exit("not-activated", { markAs: "completed" })],
      },
    }),
  ],
});
