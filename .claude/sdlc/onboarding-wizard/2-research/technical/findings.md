# Technical Research: Onboarding Wizard

## 1. Architecture Fit

### Existing Onboarding Flow (Already Built)

There is already a substantial onboarding flow at `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/`. It is a **4-step wizard**: Welcome -> Choose Plan -> Deploy & Connect -> Success.

**Current steps:**
1. **Welcome** - Value props, overview of what's next
2. **Billing** - Plan selection (free/starter/growth/scale) with Stripe checkout
3. **Deploy & Connect** - Two paths: CLI commands or CloudFormation Quick Create
4. **Success** - Next steps (SDK install, domain verification, explore dashboard)

**Key architecture patterns already in use:**
- `"use client"` page with `useState` for step management
- `localStorage` for step persistence (`onboarding_step_{orgSlug}`)
- `@tanstack/react-query` polling for onboarding status via `/api/{orgSlug}/onboarding/status`
- PostHog analytics capture on every step transition
- `Stepper` UI component from shadcn/ui (`apps/web/src/components/ui/stepper.tsx`)
- Dynamic imports for heavy components (CLI deploy step)

### Post-Onboarding Dashboard (Also Already Built)

The dashboard page (`apps/web/src/app/(dashboard)/[orgSlug]/page.tsx`) already has a **"Getting Started" checklist** that shows when setup is incomplete. It renders `GettingStartedDashboard` when `completionPercent < 100`, and `OverviewDashboard` when complete.

**Getting Started Dashboard tracks 6 steps:**
1. Deploy email infrastructure (AWS account exists + verified)
2. Connect to platform (webhook secret set)
3. Verify your domain (SES identity with `wraps-email-*` config set)
4. Send your first email (DynamoDB event history check)
5. Create an email template (optional)
6. Send a broadcast (optional)

Each step has expandable inline actions (scan features, save webhook secret, domain verification list) and links to the appropriate page.

### Route Groups

| Group | Layout | Purpose |
|---|---|---|
| `(onboarding)` | Header + footer, max-w-4xl centered | Initial wizard flow |
| `(dashboard)` | Sidebar, org context, query provider | Main app with Getting Started checklist |

### Server Actions Pattern

Server actions in `apps/web/src/actions/` follow a consistent pattern:
1. Call `verifyOrgAccess(organizationId)` or manual session + membership check
2. Validate input (Zod or TanStack Form server validation)
3. Execute DB operations scoped by `organizationId`
4. Call `revalidatePath` with `orgSlug`
5. Return typed result object

### Data Fetching Patterns

- **Server components** (dashboard page): Direct Drizzle queries in `page.tsx`
- **Client components** (onboarding): `fetch()` to Next.js API routes, polled via React Query
- **Server actions**: Called from client via `useTransition` or `useActionState`

## 2. Database Schema for Onboarding State

### What Already Exists

**`organization_extension` table** (`packages/db/src/schema/app.ts` line 24-48):
```typescript
onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
onboardingCompletedAt: timestamp("onboarding_completed_at"),
```

This is a binary flag -- onboarding is either complete or not. There is no per-step tracking in the DB.

**`aws_account` table** (`packages/db/src/schema/app.ts` line 51-124):
- Tracks AWS connections per org
- `isVerified`, `lastVerifiedAt` - connection status
- `webhookSecret` - platform connection (non-null = connected)
- `emailEnabled`, `smsEnabled` - product flags
- `features` (JSONB) - detailed scanned features including:
  - `email.configSetName`, `email.sandbox`, `email.identities[]`
  - `sms.enabled`, `sms.phoneNumbers[]`

**`subscription` table** (Better-Auth Stripe plugin, `packages/db/src/schema/auth.ts`):
- `status` ("active" | "trialing" | etc), `plan`, `referenceId` (= org ID)

**No dedicated onboarding state table exists.** Step progress is tracked client-side in localStorage.

### Recommendation: Onboarding State Approach

The current approach (localStorage + binary DB flag) is actually well-suited for the feature idea. Here's why:

**Keep current approach (no new table) because:**
- Step completion is already derived from existing records (aws_account, subscription, features scan)
- The `/api/{orgSlug}/onboarding/status` endpoint already computes: `hasAwsAccount`, `hasActiveSubscription`, `completed`
- The `GettingStartedDashboard` already computes: `hasAwsAccount`, `hasPlatformConnection`, `hasVerifiedDomain`, `hasSentEmail`, `hasTemplate`, `hasBroadcast`
- Adding a new table would duplicate state that is already derivable

**What could be improved:**
- Consolidate the "setup status" computation into a shared utility (currently duplicated between dashboard page.tsx and onboarding status API)
- Add more granular fields to the status endpoint (domain verification, email sent, etc.)
- Consider adding an `onboardingDismissedAt` timestamp to `organization_extension` for "skip" behavior

## 3. API Endpoints

### Existing Endpoints That Serve Onboarding

| Endpoint | Method | Purpose | Location |
|---|---|---|---|
| `/api/{orgSlug}/onboarding/status` | GET | Returns `completed`, `hasAwsAccount`, `hasActiveSubscription` | `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts` |
| `/api/{orgSlug}/onboarding/complete` | POST | Marks onboarding as done, emits tracking event | `apps/web/src/app/api/[orgSlug]/onboarding/complete/route.ts` |
| `/api/{orgSlug}/onboarding/aws/validate` | POST | Validates CloudFormation role ARN + external ID, saves aws_account | `apps/web/src/app/api/[orgSlug]/onboarding/aws/validate/route.ts` |
| `/api/{orgSlug}/onboarding/verify-cli` | POST | Stub -- returns success if authenticated | `apps/web/src/app/api/[orgSlug]/onboarding/verify-cli/route.ts` |
| `/api/{orgSlug}/connections` | GET | Lists AWS account connections for org | `apps/web/src/app/api/[orgSlug]/connections/route.ts` |

### Elysia API (Lambda)

| Endpoint | Method | Purpose | Location |
|---|---|---|---|
| `/v1/connections` | POST | Register/update AWS connection (CLI `platform connect`) | `apps/api/src/routes/connections.ts` |
| `/v1/connections` | GET | List connections for authenticated org | `apps/api/src/routes/connections.ts` |

### What New Endpoints Would Be Needed

The feature idea wants more granular step detection. The existing `/api/{orgSlug}/onboarding/status` would need to be **extended** (not replaced) to return:

```typescript
{
  completed: boolean;
  completedAt: string | null;
  steps: {
    hasActiveSubscription: boolean;
    hasAwsAccount: boolean;
    hasPlatformConnection: boolean;  // webhookSecret != null
    hasVerifiedDomain: boolean;      // features.email.identities.length > 0
    hasSentEmail: boolean;           // DynamoDB event check
    isOutOfSandbox: boolean;         // features.email.sandbox === false
  };
}
```

This requires merging logic from two places:
- Current onboarding status route (subscription + aws_account check)
- Dashboard `getSetupStatus()` function (domain, email sent, features checks)

**No entirely new endpoints are needed** -- just enriching the existing status endpoint.

## 4. Step Completion Detection

### Per-Step Detection Mechanisms

| Step | Detection Method | DB/API Source |
|---|---|---|
| **Install Node.js / npm** | Cannot detect server-side | Client-side self-report only |
| **Install CLI** | Cannot detect server-side | Client-side self-report only |
| **AWS credentials configured** | Cannot detect server-side | Client-side self-report only |
| **`wraps email init`** | `aws_account.emailEnabled = true` and `features.email.configSetName` exists | DB query on `aws_account` |
| **DNS verification** | `features.email.identities` array has DOMAIN entries | DB query or `scanAWSAccountFeatures()` server action |
| **SES sandbox exit** | `features.email.sandbox === false` | DB query (populated by scan) or live SES `GetAccount` call |
| **Platform connected** | `aws_account.webhookSecret IS NOT NULL` | DB query on `aws_account` |
| **Test email sent** | DynamoDB `wraps-email-history` table has records | `queryEmailEvents()` in `apps/web/src/lib/aws/dynamodb.ts` |

### How CLI `platform connect` Creates Records

1. CLI authenticates via `wraps auth login` (session token)
2. CLI calls `POST /v1/connections` (Elysia API) with `accountId`, `region`, `features`
3. API generates `externalId`, `webhookSecret`, creates/updates `aws_account` row
4. API returns `connectionId`, `externalId`, `roleArn`, `webhookSecret`, `webhookEndpoint`
5. CLI saves these to local metadata (`~/.wraps/connections/{accountId}-{region}.json`)

### How SES Domain Verification Is Checked

Two paths:
1. **Scan Features** (`scanAWSAccountFeatures` server action): Assumes IAM role into customer account, calls `ListEmailIdentities` + `GetEmailIdentity` for each, checks `VerifiedForSendingStatus` and `ConfigurationSetName.startsWith("wraps-email-")`. Saves to `aws_account.features` JSONB.
2. **Dashboard read**: Reads `aws_account.features.email.identities` from DB (populated by previous scan).

### How Email Events Are Stored

- **In customer AWS**: SES -> EventBridge -> SQS -> Lambda -> DynamoDB (`wraps-email-history` table)
- **In platform DB**: Webhook from customer Lambda -> `POST /webhooks/ses/{accountId}` -> `contact_event` table
- Dashboard checks DynamoDB via `queryEmailEvents()` (assumes role into customer account)

## 5. Existing Code to Reuse

### UI Components Available

| Component | Location | Notes |
|---|---|---|
| **Stepper** (shadcn/ui) | `apps/web/src/components/ui/stepper.tsx` | Already used in current onboarding `StepProgress` |
| **Card, CardHeader, etc.** | `apps/web/src/components/ui/card.tsx` | Used throughout onboarding steps |
| **Progress** | `apps/web/src/components/ui/progress.tsx` | Used in Getting Started dashboard |
| **Badge** | `apps/web/src/components/ui/badge.tsx` | Used for status indicators |
| **Collapsible** | `apps/web/src/components/ui/collapsible.tsx` | Used in Getting Started checklist |
| **Button** | `apps/web/src/components/ui/button.tsx` | Standard, with `loading` prop |
| **Input, Label** | Standard shadcn | Used in CloudFormation validation form |

### Existing Patterns to Reuse

| Pattern | Source | Reuse For |
|---|---|---|
| `ExpandableChecklistItem` | `getting-started-dashboard.tsx` | Checklist items with expandable details |
| `ScanFeaturesAction` | `getting-started-dashboard.tsx` | "Scan Features" button inline in checklist |
| `WebhookSecretForm` | `getting-started-dashboard.tsx` | Inline webhook connection form |
| `DomainVerification` | `getting-started-dashboard.tsx` | Domain verification status display |
| PostHog analytics pattern | `onboarding/page.tsx` | Step tracking events |
| localStorage persistence | `onboarding/page.tsx` | Step progress persistence |
| CLI command copy blocks | `cli-deploy-connect-step.tsx` | Copy-to-clipboard CLI instructions |
| Activation tracking | `apps/web/src/lib/activation-tracking.ts` | Tier 1/2 event emission |

### Contacts Empty State

`apps/web/src/app/(dashboard)/[orgSlug]/contacts/components/contacts-empty-state.tsx` -- example of an empty state component pattern.

## 6. Key Files That Will Be Touched

### Files to Modify

| File | Change |
|---|---|
| `apps/web/src/app/api/[orgSlug]/onboarding/status/route.ts` | Extend response with granular step status (domain, email sent, sandbox) |
| `apps/web/src/app/(dashboard)/[orgSlug]/page.tsx` | Extract `getSetupStatus()` into shared utility to avoid duplication |
| `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/page.tsx` | Add new steps or restructure existing 4-step flow into more granular wizard |

### Files to Potentially Create

| File | Purpose |
|---|---|
| `apps/web/src/lib/setup-status.ts` | Shared setup status computation (deduplicate dashboard page + onboarding status API) |

### Files That Are Reference-Only (Read, Not Modify)

| File | Why |
|---|---|
| `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx` | Existing CLI command UI pattern |
| `apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/step-progress.tsx` | Existing stepper usage |
| `apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx` | Existing checklist pattern with expandable items |
| `apps/web/src/actions/aws-accounts.ts` | `scanAWSAccountFeatures`, `getVerifiedDomains` |
| `apps/web/src/lib/activation-tracking.ts` | Tracking event helpers |
| `packages/db/src/schema/app.ts` | `organizationExtension`, `awsAccount` schemas |
| `apps/api/src/routes/connections.ts` | CLI connection flow |

## Summary Assessment

**The feature idea largely describes functionality that already exists in two places:**

1. **Initial onboarding wizard** (`(onboarding)` route group) -- 4-step wizard for new users
2. **Getting Started dashboard** (`(dashboard)` route group) -- 6-step checklist for the main dashboard

The gap between what exists and what the idea describes is:
- The initial wizard focuses on billing + deploy, but lacks granular sub-steps (install Node, install CLI, configure AWS, verify DNS, exit sandbox)
- The Getting Started dashboard has the granular checklist but is not a "wizard" -- it's a static checklist
- Neither provides step-by-step instructions for prerequisite setup (Node.js, AWS CLI, etc.)

**The real work is likely:**
1. Enrich the existing onboarding wizard with more granular, guided sub-steps (especially the "Deploy & Connect" step which currently just shows 4 CLI commands)
2. Add auto-detection by extending the onboarding status API with data from the Getting Started dashboard's `getSetupStatus()` function
3. Improve the post-onboarding Getting Started dashboard to act more like a wizard (sequential guidance, not just a checklist)
4. OR: Merge both into a single unified experience that works in both contexts
