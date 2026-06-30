import {
  condition,
  defineWorkflow,
  exit,
  sendEmail,
  waitForEvent,
} from "@wraps.dev/client";

/**
 * Onboarding Rescue
 *
 * Catches signups who don't complete onboarding within 2 hours and gives them
 * a focused "stuck?" email pointing at the simplified setup flow. Exits silently
 * for users who finish onboarding — Activation Drip takes over for them.
 *
 * Replaces the old "Welcome Series" workflow which sent unconditionally and
 * collided with the Activation Drip campaigns on day 1.
 *
 *   +2h    → Wait for onboarding.completed → exit if done, send rescue if not
 *   Day 3  → Wait again                    → exit if done, send last nudge if not
 */
export default defineWorkflow({
  name: "Onboarding Rescue",
  description:
    "Re-engages signups who don't complete onboarding within 2 hours, with one final follow-up at day 3.",

  trigger: { type: "event", eventName: "user.signup" },
  settings: { allowReentry: false },

  steps: [
    // ── First wait window: 2 hours ────────────────────────────────────
    waitForEvent("wait-onboarding-1", {
      eventName: "onboarding.completed",
      timeout: { hours: 2 },
    }),

    // ── Gate: invited members get the Member Onboarding flow instead ──
    // accountType is set when they accept the invite, which always lands
    // within this 2h window, so the property is reliably present here.
    condition("check-invited", {
      field: "contact.properties.accountType",
      operator: "equals",
      value: "invited",
      branches: {
        yes: [exit("invited-member", { markAs: "completed" })],
        no: [],
      },
    }),

    condition("check-completed-1", {
      field: "contact.properties.onboardingPath",
      operator: "is_set",
      branches: {
        yes: [exit("completed-fast", { markAs: "completed" })],
        no: [
          sendEmail("rescue-1", { template: "reengagement-activate-account" }),
        ],
      },
    }),

    // ── Second wait window: ~3 days ───────────────────────────────────
    waitForEvent("wait-onboarding-2", {
      eventName: "onboarding.completed",
      timeout: { days: 3 },
    }),
    condition("check-completed-2", {
      field: "contact.properties.onboardingPath",
      operator: "is_set",
      branches: {
        yes: [exit("completed-late", { markAs: "completed" })],
        no: [
          sendEmail("rescue-2", { template: "reengagement-activate-account" }),
        ],
      },
    }),

    exit("done", { markAs: "completed" }),
  ],
});
