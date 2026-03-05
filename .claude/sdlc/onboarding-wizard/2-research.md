# Research: Onboarding Wizard

## Summary

The research reveals a critical insight: **most of what the feature describes already exists in two disconnected places** — a 4-step onboarding wizard (Welcome > Plan > Deploy > Success) and a 6-item Getting Started checklist on the dashboard. The real gap is between these two experiences: the wizard is too coarse (doesn't guide through prerequisites or DNS/sandbox), and the checklist is too passive (no sequential guidance, no hand-holding).

The market research confirms this is the highest-ROI investment for activation. Wraps has the highest onboarding friction of any competitor (30-60 minutes vs Resend's 3 minutes). Three-step flows achieve 72% completion vs 16% for seven-step flows — so the wizard must group steps into phases, not enumerate them individually. Auto-detection of completion (not "I did it" buttons) is table stakes.

The contrarian analysis raises a legitimate challenge: **the wizard narrates complexity rather than removing it**. A non-technical user who needs help installing Node.js is unlikely to successfully deploy AWS infrastructure regardless of how well the wizard guides them. The strongest counter-argument is concierge onboarding first (zero engineering, generates real data), followed by CloudFormation one-click (removes steps instead of explaining them).

## Key Insights

1. **Two onboarding experiences already exist and should be unified**, not replaced with a third. The onboarding wizard gates the dashboard, then the Getting Started dashboard provides a second checklist. Users who skip the deploy step hit a dead end — the wizard is "completed" but the dashboard shows 0% progress.

2. **Step detection is mostly solved.** AWS connection, domain verification, SES sandbox status, and email events are all detectable via existing DB records and AWS API calls. "CLI installed" cannot be passively detected — treat it as instructional only.

3. **No new DB table needed.** `organization_extension` already has `onboardingCompleted`/`onboardingCompletedAt`. All step states are derivable from existing records (`aws_account`, `subscription`, DynamoDB events). The onboarding status API just needs enrichment.

4. **The "Deploy & Connect" step is where the real work is.** Currently it shows 4 CLI commands with no prerequisite guidance, no sub-steps, no error recovery. This single step spans: install Node, install CLI, configure AWS, deploy, connect platform — and is where users get stuck.

5. **CloudFormation already exists as a fallback** in the current wizard (`cli-deploy-connect-step.tsx`). It's presented as a secondary option. Making it more prominent (or even primary for non-technical users) would remove more friction than better CLI guidance.

6. **DNS propagation (minutes to 48 hours) and SES sandbox (24-48 hour AWS review) are inherent blockers** that no wizard can eliminate. The wizard must set expectations, provide "check again" functionality, and suggest what to do while waiting.

## Risks & Concerns

1. **Narrating complexity vs. removing it.** The wizard walks users through AWS credential setup, DNS records, and SES sandbox — tasks that are fundamentally hard for non-technical users. A wizard makes them more visible but not easier. Consider whether CloudFormation one-click should be the primary path, not a fallback.

2. **Maintenance burden.** The wizard couples to CLI command syntax, AWS console UI, DNS provider interfaces, Node.js installation methods, and SES sandbox processes. Every CLI change could break wizard instructions. This is a long-term cost.

3. **False completion detection.** Showing a green checkmark when an IAM role has been deleted, DNS hasn't propagated, or the CLI is outdated creates false confidence and harder-to-debug support issues.

4. **Unvalidated drop-off assumptions.** "Users drop off after org creation" is stated as fact but not backed by data. The actual bottleneck might be earlier (landing page, pricing) or deeper (the self-hosted model itself). Concierge onboarding with 20 users would reveal the true cause.

5. **Scope creep.** Each wizard step has edge cases (Windows vs Mac vs Linux, AWS SSO vs IAM, Route53 vs Cloudflare vs GoDaddy). Handling these properly turns a "simple wizard" into a decision tree.

## Recommendations

1. **Don't build a third experience — unify the existing two.** Merge the onboarding wizard and Getting Started dashboard into a single progressive flow that works both pre- and post-onboarding-completion.

2. **Enrich the onboarding status API** with granular step data from the dashboard's `getSetupStatus()` logic. Consolidate duplicated computation into a shared utility.

3. **Restructure "Deploy & Connect" into guided sub-steps** with prerequisites (Node.js, AWS CLI), copy-paste commands, expected output, and auto-detection where possible.

4. **Make CloudFormation the primary path for non-technical users**, CLI for power users. The current wizard buries CloudFormation as a fallback — flip the hierarchy.

5. **Group steps into 3-4 phases** (e.g., "Set Up Billing", "Connect AWS", "Verify & Send") to hit the 72% completion sweet spot. Don't show 7+ individual steps.

6. **Add "waiting" states** for DNS propagation and SES sandbox with polling, estimated times, and suggestions for what to do while waiting.

7. **Consider concierge onboarding first** (zero engineering, generates real data on where users actually get stuck) before investing in the wizard UI. This aligns with "Demo -> Sell -> Build."

## Answers to Open Questions

**How do we detect step completion from the dashboard?**
Most steps are already detectable: `aws_account` record (AWS connected), `aws_account.webhookSecret` (platform connected), `aws_account.features.email.identities` (domain verified), `aws_account.features.email.sandbox` (SES sandbox status), DynamoDB query (email sent). "CLI installed" cannot be passively detected — treat as instructional. The onboarding status API needs enrichment to expose these, borrowing logic from the dashboard's `getSetupStatus()`.

**Should we track onboarding progress in the DB or simpler approach?**
No new table needed. Current localStorage + binary DB flag (`organization_extension.onboardingCompleted`) is sufficient because all step states are derivable from existing records. Consider adding `onboardingDismissedAt` to handle the skip-and-return case. Server-side step tracking would help with multi-device but adds complexity — start without it.

**Do we want "estimated time remaining" or keep it simple?**
Add per-step time estimates ("~2 minutes", "5-10 minutes", "up to 48 hours for DNS"). Market research shows time estimates increase completion rates. Don't estimate total time — it's misleading because of DNS/sandbox waiting periods.

**Should the wizard be dismissible/skippable for power users?**
Yes, absolutely. The current wizard already has a "Skip" option. Make it more prominent: "Already set up? Skip to dashboard" at the top. Power users who already have the CLI configured shouldn't be forced through instructional steps.

## Detailed Findings
- [Market Analysis](2-research/market/findings.md)
- [Product Analysis](2-research/product/findings.md)
- [Technical Analysis](2-research/technical/findings.md)
- [Contrarian Analysis](2-research/contrarian/findings.md)
