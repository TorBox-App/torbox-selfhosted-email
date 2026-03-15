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
 * Activation Drip — Start Building Path
 *
 * For users who chose "Start building" during onboarding (no AWS yet).
 * Reactive sequence: listens for product engagement milestones, tracks
 * velocity, nudges infrastructure connection last.
 *
 *   +1h    → Welcome: point to template editor
 *   Day 1  → Wait for template creation     → nudge if timeout
 *   Day 3  → Wait for workflow creation      → nudge if timeout
 *   Day 5  → Invite teammate                → always send
 *   Day 8  → Wait for AWS connection         → celebrate & exit if yes, nudge if timeout
 *   Day 12 → Final AWS check                → celebrate or exit
 */
export default defineWorkflow({
  name: "Activation Drip — Start Building",
  description:
    "Reactive activation for start-building users — listens for engagement, tracks velocity, nudges AWS last.",

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

    // ── Day 1: Wait for template creation ───────────────────────────────
    waitForEvent("wait-template", {
      eventName: "activation.first_template",
      timeout: { hours: 23 },
    }),
    condition("check-template", {
      field: "contact.hasCreatedTemplate",
      operator: "is_true",
      branches: {
        yes: [
          updateContact("velocity-template", {
            updates: [
              { field: "velocityScore", operation: "increment", value: 1 },
            ],
          }),
        ],
        no: [
          sendEmail("nudge-template", {
            template: "nudge-create-template",
          }),
        ],
      },
    }),

    // ── Day 3: Wait for workflow creation ────────────────────────────────
    waitForEvent("wait-workflow", {
      eventName: "activation.first_automation",
      timeout: { days: 2 },
    }),
    condition("check-workflow", {
      field: "contact.hasCreatedWorkflow",
      operator: "is_true",
      branches: {
        yes: [
          updateContact("velocity-workflow", {
            updates: [
              { field: "velocityScore", operation: "increment", value: 1 },
            ],
          }),
        ],
        no: [
          sendEmail("nudge-workflow", { template: "nudge-create-workflow" }),
        ],
      },
    }),

    // ── Day 5: Invite teammate nudge ────────────────────────────────────
    delay("wait-2d", { days: 2 }),
    sendEmail("nudge-invite", { template: "nudge-invite-team" }),

    // ── Day 8: Wait for AWS connection ──────────────────────────────────
    waitForEvent("wait-aws", {
      eventName: "activation.aws_connected",
      timeout: { days: 3 },
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
    waitForEvent("wait-aws-final", {
      eventName: "activation.aws_connected",
      timeout: { days: 4 },
    }),
    condition("check-aws-final", {
      field: "contact.hasConnectedAws",
      operator: "is_true",
      branches: {
        yes: [
          sendEmail("celebration-late", { template: "activation-crushing-it" }),
          exit("activated-late", { markAs: "completed" }),
        ],
        no: [exit("not-activated", { markAs: "failed" })],
      },
    }),
  ],
});
