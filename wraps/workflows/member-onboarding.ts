import { defineWorkflow, delay, exit, sendEmail } from "@wraps.dev/client";

/**
 * Member Onboarding
 *
 * For people who join an organization via invitation — distinct from the
 * owner/self-serve flows (Onboarding Rescue, Activation Drip), which assume
 * the user is setting up infrastructure. Invited members join a workspace
 * that's already configured, and usually arrive with little context on what
 * Wraps is. This flow is informative first: explain the product, then show
 * them how to be useful inside an existing workspace.
 *
 * Triggered by `invitation.accepted`, emitted from acceptInvitation, which
 * also flags the contact `accountType: "invited"` so Onboarding Rescue exits
 * for these contacts instead of nagging them to "connect AWS".
 *
 *   +0    → Welcome: what Wraps is + you've joined a ready workspace
 *   Day 2 → Getting started: a guided tour of the existing workspace
 *   Day 5 → Tips: how Wraps clicks once you're past the basics
 */
export default defineWorkflow({
  name: "Member Onboarding",
  description:
    "Educational welcome sequence for invited teammates — explains Wraps and helps them get productive in an existing workspace.",

  trigger: { type: "event", eventName: "invitation.accepted" },
  settings: { allowReentry: false },

  steps: [
    // ── Immediate: welcome + what Wraps is ───────────────────────────────
    sendEmail("welcome", { template: "member-welcome" }),

    // ── Day 2: guided tour of the workspace they joined ──────────────────
    delay("wait-2d", { days: 2 }),
    sendEmail("getting-started", { template: "member-getting-started" }),

    // ── Day 5: deeper tips ───────────────────────────────────────────────
    delay("wait-3d", { days: 3 }),
    sendEmail("tips", { template: "member-tips" }),

    exit("done", { markAs: "completed" }),
  ],
});
