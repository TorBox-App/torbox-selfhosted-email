# Adversarial Review: Onboarding Wizard

**Reviewed files**:
- `apps/web/src/lib/setup-status.ts` (NEW)
- `apps/web/src/app/(dashboard)/[orgSlug]/page.tsx`
- `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts`
- `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx`
- `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx`

**Change intent**: Extract shared setup status logic, restructure the Deploy & Connect onboarding step into a tabbed CLI/CloudFormation flow, and add DNS/sandbox callouts + refresh button to the Getting Started dashboard.

**Blast radius**: Dashboard page load (every new user), onboarding wizard step 3 (every new user's critical conversion step), the status API polled by the wizard.

---

## Verdict: FIX AND SHIP

---

## Plan Compliance

| Chunk | Change | Status | Evidence |
|-------|--------|--------|----------|
| 1.1 | Create `setup-status.ts`, extract `getSetupStatus()` with all fields including `isOutOfSandbox`/`sandboxStatus`, `awsAccountId`, `awsRegion`, `verifiedDomains`, `domainCount` | Done | `setup-status.ts` lines 38-192; post-review rename to `sandboxStatus: boolean \| null` applied |
| 1.2 | `page.tsx` — replace inline `getSetupStatus()` with import, remove local function and local `SetupStatus` type | Done | `page.tsx` imports from `@/lib/setup-status`, re-exports types at line 26 |
| 1.3 | `status/route.ts` — use shared `getSetupStatus()`, extend response with `steps` object | Done | `route.ts` lines 41-55, 62-68 |
| 2.1 | `cli-deploy-connect-step.tsx` — rewrite with 2-tab layout, CLI tab with prerequisites + 4 steps + connection check, CFN tab with deploy + validation form | Done | Full rewrite; all connection check logic (line 136-177), CFN URL generation (lines 92-112), webhook secret (line 125), validation mutation (lines 180-214) preserved |
| 2.2 | Add `Tabs` UI from `@/components/ui/tabs` | Done | Lines 29, 294-553 |
| 3.1 | Pass `calBookingUrl` prop from `page.tsx` | Not Done (intentional deviation) | Build log documents: constant defined inline in dashboard component instead; acceptable |
| 3.2 | Help card: replace "Email us" with "Book a Setup Call" + cal.com link, keep Discord + docs | Done | Lines 988-1043 |
| 3.3 | DNS info callout in "Verify your domain" when `!hasVerifiedDomain && hasAwsAccount` | Done | Lines 784-792 |
| 3.4 | Sandbox warning in "Send first email" when `hasVerifiedDomain && sandboxStatus === true` | Done | Lines 804-821 |
| 3.5 | Manual refresh button calling `router.refresh()` in progress card header | Done | Lines 692-699 |

---

## Pattern Compliance

| File | Expected Pattern | Actual | Issue |
|------|-----------------|--------|-------|
| `cli-deploy-connect-step.tsx` | Connection check hits `/api/${orgSlug}/connections` (slug-keyed route) | Hits `/api/${organizationId}/connections` using the UUID | BUG — see Security/Correctness findings |
| `cli-deploy-connect-step.tsx` | Validate-infrastructure hits `/api/${orgSlug}/aws/validate-infrastructure` | Hits `/api/${organizationId}/aws/validate-infrastructure` using the UUID | Same URL pattern issue |
| `getting-started-dashboard.tsx` | DNS callout should only show inside the expandable section (children context) | Correctly placed inside the `ExpandableChecklistItem` children | OK |
| `setup-status.ts` | `getOrganizationWithMembership` used in API routes for auth; `getSetupStatus` receives already-verified `organizationId` | `getSetupStatus` accepts raw `organizationId` — callers are responsible for auth | OK, consistent with original pattern |

---

## Security Findings

#### [WARNING] Connection check and CFN validation use organizationId (UUID) in URL path instead of orgSlug

**File**: `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx:140,183`

**Attack**: The component receives `organizationId` (a UUID like `org_01j...`) from `onboarding/page.tsx` line 363 (`currentOrg.id`). It then constructs API URLs as `/api/${organizationId}/connections` and `/api/${organizationId}/aws/validate-infrastructure`. The route handler at `apps/web/src/app/api/[orgSlug]/connections/route.ts` passes the path segment to `getOrganizationWithMembership(orgSlug, userId)`.

`getOrganizationWithMembership` in `lib/organization.ts` line 36 does `or(eq(organization.slug, slugOrId), eq(organization.id, slugOrId))` — it accepts either slug or UUID. So this accidentally works: the UUID resolves the org correctly. However, the **membership check is still enforced** (line 45 checks `userId` against membership table), so this is not an IDOR — it will correctly reject unauthorized users.

**Impact**: Not a security hole in practice because membership is checked. But it is a URL shape mismatch: the route is designed for slug-keyed URLs. If `getOrganizationWithMembership` ever stops accepting UUIDs (e.g., due to a refactor), these calls silently break and return 403. The old component (preserved in the CFN validation path) also used `organizationId`, so this is a pre-existing pattern carried forward — not a regression introduced by this PR.

**Fix**: Pass `orgSlug` as a prop to `CliDeployConnectStep` and use it in URL construction. The parent `onboarding/page.tsx` already has `orgSlug` in scope.

```typescript
// In cli-deploy-connect-step.tsx props
type CliDeployConnectStepProps = {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onConnected?: () => void;
  organizationId: string;
  orgSlug: string; // add this
};

// In URL construction
const res = await fetch(`/api/${orgSlug}/connections`);
// and
const response = await fetch(`/api/${orgSlug}/aws/validate-infrastructure`, { ... });
```

Note: This is a pre-existing issue not introduced by this PR. The PR carries it forward unchanged. Flagged for awareness.

---

## Correctness Findings

#### [WARNING] Sandbox warning shows before user has sent any email — the trigger condition is wrong

**File**: `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx:804`

**Attack**: The plan says: show sandbox warning in the "Send first email" item "if `setupStatus.hasVerifiedDomain && !setupStatus.isOutOfSandbox`". The implementation correctly renders `sandboxStatus === true` (in-sandbox). But the condition does not require that the user is actually trying to send — it shows unconditionally once the domain is verified and the account is in sandbox, including before the user has ever attempted to send.

This is a UX correctness issue, not a logic bug per se, but the condition placement is subtly wrong: `sandboxStatus` is `null` (not yet scanned) for accounts that have not yet run `wraps email init`. After `init`, the scan populates `sandbox: true` from SES features. But there is a window where:

1. Account is verified (infra deployed)
2. Domain is verified
3. `sandboxStatus` is `null` because the "Scan Features" action hasn't been run yet

In that window the warning is correctly suppressed (`=== true` check handles this). The `null` case is handled correctly by the tri-state. This is fine.

The more real issue: if `hasVerifiedDomain` is true and `sandboxStatus === true`, the warning shows even if `hasSentEmail` is also true (the user already sent successfully). This is a minor UX annoyance — a user who successfully sent an email while in sandbox still sees the warning. Not critical.

**Fix**: Add `&& !hasSentEmail` to the condition:
```typescript
{hasVerifiedDomain && setupStatus.sandboxStatus === true && !hasSentEmail && (
```

#### [INFO] `checkEmailsSent` returns at the first account with events, but `emailCount` is capped at the query `limit: 10`

**File**: `apps/web/src/lib/setup-status.ts:86-108`

The function queries up to 10 events to determine `hasSentEmail` and uses that count as `emailCount`. The `emailCount` value is exposed in `SetupStatus` but is not actually used anywhere in the changed files (no component renders it). It's dead data for now. Not a bug, just noting it's misleading — the count is "up to 10 from the first active account" not a real total.

#### [INFO] DNS callout references "Click 'Scan Features' above" but the callout is inside the "Verify your domain" item — the Scan Features action is inside the "Deploy infrastructure" item above

**File**: `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx:788-791`

The callout says: "Click 'Scan Features' above to check again." But `ScanFeaturesAction` (with the Scan Features button) lives in the "Deploy email infrastructure" checklist item, not the "Verify your domain" item. A user reading this would look for a "Scan Features" button inside the domain section and not find it.

**Fix**: Change the copy to: "Expand 'Deploy email infrastructure' above and click 'Scan Features' to check again."

#### [INFO] `onNext` prop is declared in `CliDeployConnectStepProps` but never called

**File**: `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx:32`

The `onNext` prop is in the type definition but the component never calls it. The old component used it to advance on connection detection; the new one calls `onConnected` instead (which the parent wires to `handleConnected` → `setCurrentStep(4)`). The unused prop is passed from `onboarding/page.tsx` line 357. TypeScript doesn't catch this because the prop is optional in practice (it's accepted but not used). This is harmless but leaves dead surface area in the interface.

---

## Performance Findings

#### [INFO] `getSetupStatus` runs `checkEmailsSent` sequentially per account (for loop with await)

**File**: `apps/web/src/lib/setup-status.ts:85-108`

`checkEmailsSent` iterates verified accounts one at a time with `await` inside a `for` loop (early return on first hit). For orgs with multiple verified AWS accounts, this is sequential DynamoDB calls. The original code had this same pattern — not a regression. For most users with one account this is fine. At scale (multiple verified accounts) it adds latency to every dashboard page load.

This is unchanged from the original, not introduced by this PR. Flagged for future optimization.

#### [INFO] The status API route now calls `getSetupStatus()` inside `Promise.all` alongside two DB queries — `getSetupStatus` itself issues multiple DB queries internally

**File**: `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts:41-55`

`getSetupStatus` does: 1 `findMany` for AWS accounts, then `Promise.all([checkEmailsSent, checkHasTemplates, checkHasBroadcasts])`. Running this inside `Promise.all` alongside the extension and subscription queries is correct (they're truly parallel since they touch different tables). No issue — just noting the call graph is deeper than it looks from the route file.

---

## Lint Rule Candidates

| Finding | Automatable? | Rule Description |
|---------|-------------|-----------------|
| API URL uses `organizationId` UUID instead of `orgSlug` in fetch calls within onboarding components | Partially | GritQL: in client components under `(onboarding)/`, flag `fetch(\`/api/${...Id}/...\`)` where the interpolated variable name contains `Id` or `organizationId` — suggests slug should be used instead |
| `onNext` prop declared in type but never called | No | TypeScript can't catch "declared but never called" for props. Would need ESLint `@typescript-eslint/no-unused-vars` extended to prop usage analysis — not practical |
| Sandbox warning condition missing `!hasSentEmail` guard | No | Semantic rule — no practical GritQL pattern |

---

## Required Fixes

- [ ] **[WARNING] Sandbox callout shows even after user has successfully sent email** — add `&& !hasSentEmail` to the condition at `getting-started-dashboard.tsx:804`
- [ ] **[INFO] DNS callout copy is misleading** — "Click 'Scan Features' above" points to a button that lives in a different checklist item; update the copy to direct users to expand "Deploy email infrastructure"
