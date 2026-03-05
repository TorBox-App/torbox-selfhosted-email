# Build: Onboarding Wizard

## Completed Chunks

### Chunk 1: Shared Setup Status Utility + Enriched Status API
- [x] Created `apps/web/src/lib/setup-status.ts` — extracted `getSetupStatus()`, helper functions, and types from dashboard page
- [x] Modified `apps/web/src/app/(dashboard)/[orgSlug]/page.tsx` — replaced inline `getSetupStatus()` with import from `@/lib/setup-status`, re-exports `SetupStatus` and `AwsAccountData` types for backwards compatibility
- [x] Modified `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts` — uses shared `getSetupStatus()`, parallelizes DB queries, adds `steps` object with granular fields including `isOutOfSandbox`
- Verification: PASS (`pnpm --filter @wraps/web typecheck`)

### Chunk 2: Restructured Deploy & Connect Step
- [x] Rewrote `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx` — replaced 3-view-state pattern with Tabs UI (CLI Setup / CloudFormation)
- [x] CLI tab: added prerequisites checklist with install guide links, per-step time estimates (~1 min, ~5 min, ~2 min)
- [x] CloudFormation tab: streamlined flow — deploy button first, then validation form appears after deploy
- [x] Added "Need help?" card with cal.com booking link at bottom
- [x] Preserved all existing logic: connection check polling, CFN URL generation, webhook secret, validation mutation, posthog events
- Verification: PASS (`pnpm --filter @wraps/web typecheck`)

### Chunk 3: Improved Getting Started Dashboard
- [x] Added refresh button (RefreshCw icon) in progress card header using `router.refresh()`
- [x] Added DNS propagation info callout in "Verify your domain" section (shows when `!hasVerifiedDomain && hasAwsAccount`)
- [x] Added SES sandbox warning callout in "Send first email" section (shows when `hasVerifiedDomain && !isOutOfSandbox`) with link to AWS production access docs
- [x] Updated Help card: replaced "Email Support" with prominent "Book a Setup Call" button linking to cal.com, kept docs and Discord links
- Verification: PASS (`pnpm --filter @wraps/web typecheck`)

## Deviations from Plan
- Plan listed `calBookingUrl` as a new prop on `GettingStartedDashboard` passed from `page.tsx`. Instead, defined `CAL_BOOKING_URL` as a constant within the dashboard component file — simpler, avoids prop drilling for a static string.
- CloudFormation tab uses a `cfnDeployed` boolean state instead of separate view states — cleaner than maintaining the old `ViewState` union type.
- Removed the `handleBack` internal view-state reset from the old component since Tabs handle navigation natively.

## Files Changed
| File | Lines Changed |
|------|--------------|
| `apps/web/src/lib/setup-status.ts` | +170 (new) |
| `apps/web/src/app/(dashboard)/[orgSlug]/page.tsx` | +17 -150 |
| `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts` | +48 -38 |
| `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx` | +338 -270 (rewrite) |
| `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx` | +72 -24 |

## How to Test
1. Visit `/{orgSlug}/onboarding` → advance to step 3 → verify CLI and CloudFormation tabs render correctly
2. Visit dashboard with incomplete setup → verify DNS info callout appears when domain not verified but AWS connected
3. Visit dashboard with verified domain but sandbox account → verify sandbox warning appears
4. Click refresh button in progress card → verify page re-fetches status
5. Verify "Book a Setup Call" link appears in both onboarding wizard and dashboard help card
