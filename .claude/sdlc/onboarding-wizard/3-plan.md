# Plan: Onboarding Wizard

## Strategy

Rather than building a third onboarding experience, **improve the two existing ones and connect them**:

1. **Enrich the status API** so both wizard and dashboard share the same granular step data
2. **Restructure the "Deploy & Connect" step** into guided sub-steps with prerequisites, CLI as primary path with CloudFormation fallback
3. **Improve the Getting Started Dashboard** with sequential guidance, polling, and prominent blockers (DNS, sandbox)
4. **Add "Need help?" booking link** throughout both experiences

## Pattern Baseline

The template for this feature is the existing onboarding wizard and Getting Started dashboard:

- `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/page.tsx` — step state machine pattern (useState + localStorage + effects)
- `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx` — view state pattern (`ViewState` union type), CLI command display, CloudFormation flow
- `apps/web/src/app/(dashboard)/[orgSlug]/page.tsx` — `getSetupStatus()` server-side computation pattern (lines 152-202)
- `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx` — `ExpandableChecklistItem` pattern, inline actions, progress bar
- `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts` — onboarding status API response shape
- `apps/web/src/components/ui/stepper.tsx` — Stepper compound component API

Follow these patterns exactly. Do not invent new patterns.

## Change List

### Chunk 1: Shared Setup Status Utility + Enriched Status API

Extract the duplicated status computation into a shared utility and enrich the onboarding status API.

| # | File | Change | Pattern From |
|---|------|--------|-------------|
| 1 | `apps/web/src/lib/setup-status.ts` | **Create**: Extract `getSetupStatus()` logic from dashboard `page.tsx` (lines 152-202) into a shared async function. Export `SetupStatus` type and `getSetupStatus(organizationId: string)` function. Include all current fields: `hasAwsAccount`, `hasPlatformConnection`, `hasVerifiedDomain`, `hasSentEmail`, `hasTemplate`, `hasBroadcast`, plus new fields: `isOutOfSandbox` (from `features.email.sandbox === false`), `awsAccountId` (for scan actions), `awsRegion`, `verifiedDomains` (string array), `domainCount`. | `apps/web/src/app/(dashboard)/[orgSlug]/page.tsx:152-202` |
| 2 | `apps/web/src/app/(dashboard)/[orgSlug]/page.tsx` | **Modify**: Replace inline `getSetupStatus()` with import from `@/lib/setup-status`. Remove the local function definition (lines 152-202) and local `SetupStatus` type (lines 23-33). Keep everything else. | Same file, refactor only |
| 3 | `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts` | **Modify**: Import and call `getSetupStatus()` from `@/lib/setup-status`. Extend response to include all granular fields alongside existing `completed`, `hasAwsAccount`, `hasActiveSubscription`. New response shape adds: `steps: { hasAwsAccount, hasPlatformConnection, hasVerifiedDomain, hasSentEmail, isOutOfSandbox }`. Keep existing fields for backwards compatibility. | `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts` (existing pattern) |

**Verify**: `pnpm --filter @wraps/web typecheck`

### Chunk 2: Restructured Deploy & Connect Step

Break the monolithic "Deploy & Connect" step into a guided sub-step flow. CLI is the primary path with CloudFormation as a fallback for users who can't use the CLI. Add prerequisite guidance and "Need help?" booking link.

| # | File | Change | Pattern From |
|---|------|--------|-------------|
| 1 | `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx` | **Major rewrite**: Replace the current 3-view-state pattern (`CLI_FIRST`, `CLOUDFORMATION_CONFIG`, `CLOUDFORMATION_VALIDATE`) with a 2-tab layout: "CLI Setup" (default, primary) and "CloudFormation" (fallback for users without Node.js). **CLI tab** (default): (1) Prerequisites checklist (Node.js, AWS CLI — informational only, checkboxes with links to install guides), (2) Install CLI: `npm i -g @wraps.dev/cli`, (3) Login: `wraps auth login`, (4) Deploy: `wraps email init`, (5) Connect: `wraps platform connect`. Add per-sub-step time estimates ("~2 min", "~5 min"). **CloudFormation tab**: (1) Click "Deploy to AWS" button → opens CFN quick-create, (2) Copy Role ARN + External ID from outputs, (3) Paste into validation form. Label this tab "Don't have Node.js? Use CloudFormation instead." Keep existing connection check polling (`/api/{orgSlug}/connections`). Add "Need help?" card at bottom with cal.com booking link: `https://cal.com/wraps/get-started-with-wraps`. | Same file (rewrite, keep connection check logic from lines 109-131, CFN URL generation from lines 61-80, webhook secret from line 94, validation mutation from lines 149-183) |
| 2 | `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx` | **Add Tabs UI**: Use shadcn `Tabs` component (`@/components/ui/tabs`) for the CLI vs CloudFormation split. Each tab content uses numbered steps with the existing `CliCommand` copy-paste pattern. | `apps/web/src/components/ui/tabs.tsx` for Tabs pattern; existing `CliCommand` blocks in same file for command display |

Note: Items 1 and 2 are the same file — listed separately for clarity on what changes. This is a single file rewrite.

**Verify**: `pnpm --filter @wraps/web typecheck` + manual test: visit `/[orgSlug]/onboarding`, advance to step 3, verify both tabs render correctly

### Chunk 3: Improved Getting Started Dashboard

Make the Getting Started dashboard more actionable: surface DNS/sandbox blockers prominently, add "Need help?" booking link, add manual refresh button, and improve sequential guidance.

| # | File | Change | Pattern From |
|---|------|--------|-------------|
| 1 | `apps/web/src/app/(dashboard)/[orgSlug]/page.tsx` | **Modify**: Pass `orgSlug` to `GettingStartedDashboard` (already passed). Add `calBookingUrl` prop with value `"https://cal.com/wraps/get-started-with-wraps"`. | Same file |
| 2 | `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx` | **Modify Help card** (lines 941-995): Replace generic "Email us" with prominent "Book a Setup Call" button linking to `https://cal.com/wraps/get-started-with-wraps`. Keep Discord and docs links. Add subtitle: "Free 15-minute walkthrough — we'll help you get set up." | Same file, Help card section |
| 3 | `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx` | **Add DNS/Sandbox awareness**: In the "Verify your domain" checklist item (lines 756-768), if `!setupStatus.hasVerifiedDomain && setupStatus.hasAwsAccount`, show an info callout: "DNS changes can take up to 48 hours to propagate. Click 'Scan Features' to check again." In the "Send first email" item (lines 770-777), if `setupStatus.hasVerifiedDomain && !setupStatus.isOutOfSandbox`, show a warning callout: "Your AWS account is in SES sandbox mode. You can only send to verified email addresses. Request production access in the AWS console." | Existing callout/alert patterns in the codebase |
| 4 | `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx` | **Add manual refresh button**: Add a "Refresh status" button in the progress card header that calls `router.refresh()` to re-run `getSetupStatus()` server-side. Use the existing `Button` component with a `RefreshCw` icon from lucide-react. No auto-refresh — manual only. | Existing `router.refresh()` pattern used by `ScanFeaturesAction` (line 343) |

**Verify**: `pnpm --filter @wraps/web typecheck` + manual test: visit dashboard with incomplete setup, verify DNS/sandbox callouts appear, verify refresh button works

## New Tests

No new test files for this change. The modifications are UI-focused and best verified manually + with existing typecheck. The shared `setup-status.ts` utility could get a test later but the logic is extracted from working code, not new.

## Risks

| Risk | Mitigation |
|------|-----------|
| Breaking existing onboarding flow | Chunk 1 is a pure refactor (extract function). Chunk 2 rewrites one component but preserves all connection check + CFN validation logic. Typecheck catches regressions. |
| CloudFormation quick-create URL generation breaks | Keep exact same URL generation logic (lines 61-80 of current file). Only change the UI wrapper. |
| `getSetupStatus()` DynamoDB calls failing for disconnected accounts | Already handled in existing code — `checkEmailsSent()` catches errors and returns false. Preserve this behavior. |
| Tabs component not installed | Verify `apps/web/src/components/ui/tabs.tsx` exists. If not, install via `npx shadcn@latest add tabs`. |

## Out of Scope

- Server-side step tracking (DB table for onboarding progress) — localStorage is sufficient
- Replacing the CLI flow — this supplements it
- SMS/CDN onboarding — email only
- Onboarding emails/notifications
- CloudFormation feature parity improvements
- New tests (typecheck + manual verification for UI changes)
- Re-entry into onboarding wizard after completion (the `onboardingCompleted` gate stays as-is; Getting Started dashboard handles post-completion guidance)
