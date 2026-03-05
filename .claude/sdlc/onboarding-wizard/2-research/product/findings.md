# Onboarding Wizard - Product Research Findings

## 1. Current Onboarding Flow

### What exists today

There are **two separate onboarding experiences** that serve overlapping purposes:

#### A. The Onboarding Wizard (`apps/web/src/app/(onboarding)/`)

A dedicated 4-step wizard shown to users who haven't completed onboarding. The flow is:

1. **Welcome** — value props (ownership, pricing, DX), outlines what's next
2. **Choose Plan** — billing step with free/starter/growth/scale plans; Stripe checkout for paid plans, inline `createFreeSubscription()` for free tier
3. **Deploy & Connect** — CLI commands or CloudFormation fallback (see below)
4. **Success** — next steps (SDK install, domain verification, explore dashboard)

**Key files:**
- `/Users/jarod/Projects/wraps/apps/web/src/app/(onboarding)/[orgSlug]/onboarding/page.tsx` — orchestrator with step state, localStorage persistence, PostHog analytics
- `/Users/jarod/Projects/wraps/apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/cli-deploy-connect-step.tsx` — the deploy step (CLI-first with CloudFormation fallback)
- `/Users/jarod/Projects/wraps/apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/billing-step.tsx` — plan selection + Stripe checkout
- `/Users/jarod/Projects/wraps/apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/success-step.tsx` — completion with different states for connected vs skipped
- `/Users/jarod/Projects/wraps/apps/web/src/app/(onboarding)/[orgSlug]/onboarding/components/step-progress.tsx` — stepper UI component

**Routing guard:** The dashboard layout at `/Users/jarod/Projects/wraps/apps/web/src/app/(dashboard)/[orgSlug]/layout.tsx` (line 43) redirects to onboarding if `orgData.extension?.onboardingCompleted` is false. This is a hard gate — users cannot access the dashboard until onboarding is marked complete.

**Completion tracking:** Stored in `organization_extension.onboarding_completed` (boolean) + `onboarding_completed_at` (timestamp) in the DB. Set via `POST /api/{orgSlug}/onboarding/complete`.

**Step persistence:** localStorage only (`onboarding_step_{orgSlug}`). No server-side step tracking. If a user clears browser data or switches devices, they restart from step 1.

#### B. The Getting Started Dashboard (`apps/web/src/app/(dashboard)/[orgSlug]/`)

Once onboarding is marked "complete" (even if skipped), the dashboard root shows either:
- **GettingStartedDashboard** — if not all 4 required steps are done (hasAwsAccount, hasPlatformConnection, hasVerifiedDomain, hasSentEmail)
- **OverviewDashboard** — if all 4 required steps are complete (100%)

The Getting Started Dashboard is a **6-item checklist** with expandable items:
1. Deploy email infrastructure (expandable: scan features action)
2. Connect to platform (expandable: webhook secret form)
3. Verify your domain (expandable: domain list)
4. Send your first email (expandable: SDK guide + sender defaults link)
5. Create an email template (optional)
6. Send a broadcast (optional)

**Key files:**
- `/Users/jarod/Projects/wraps/apps/web/src/app/(dashboard)/[orgSlug]/page.tsx` — server component that computes `SetupStatus` from DB
- `/Users/jarod/Projects/wraps/apps/web/src/app/(dashboard)/[orgSlug]/components/getting-started-dashboard.tsx` — checklist UI with inline actions
- `/Users/jarod/Projects/wraps/apps/web/src/app/(dashboard)/[orgSlug]/components/infrastructure-status-card.tsx` — sidebar status card

### The gap between the two

The onboarding wizard is high-level (Welcome > Plan > Deploy > Done) and focuses on getting the user to connect AWS. The Getting Started Dashboard is more granular and tracks domain verification, first email, templates, and broadcasts. **There is no single unified experience** — the wizard gates the dashboard, then the dashboard itself has a second getting-started flow.

---

## 2. Step Detection Feasibility

### "CLI installed"

**Cannot be reliably detected.** The CLI runs on the user's local machine. There is no API call the CLI makes upon installation that would notify the platform. The `verify-cli` endpoint at `/Users/jarod/Projects/wraps/apps/web/src/app/api/[orgSlug]/onboarding/verify-cli/route.ts` exists but is a stub — it just returns `{ success: true }` with no actual verification logic (see line 37: "In a real implementation, we might check for a token or specific header").

**Workaround options:**
- Detect indirectly: if `wraps auth login` has been called, the user has the CLI. The `wraps auth login` command authenticates via the platform — a session/token would exist server-side.
- Self-report: the current wizard has a "I've finished — check connection" button that polls for an AWS account record. Same pattern could work for CLI install.
- Skip this step: treat "CLI installed" as instructional-only, not a tracked step.

### "AWS connected" (platform connect)

**Fully detectable.** When the user runs `wraps platform connect` or completes CloudFormation validation, an `aws_account` record is created in the DB.

**Detection mechanism (already implemented):**
- `GET /api/{orgSlug}/connections` — returns `awsAccount` records for the org
- The onboarding wizard's `CliDeployConnectStep` calls this endpoint on "I've finished — check connection" button click
- The dashboard checks `awsAccount.organizationId` with `isVerified: true`

**DB records created by `wraps platform connect`:**
- `aws_account` row with `accountId`, `region`, `roleArn`, `externalId`, `isVerified`, `webhookSecret`
- Via the API: `POST /api/{orgSlug}/onboarding/aws/validate` creates/updates the `aws_account` row
- Via CLI: `registerConnection()` calls the platform API which creates the same record

**Key schema:** `/Users/jarod/Projects/wraps/packages/db/src/schema/app.ts` — `awsAccount` table (lines 51-123).

### "Infrastructure deployed" (`wraps email init`)

**Partially detectable.** `wraps email init` deploys Pulumi resources to the user's AWS account but does NOT directly write to the Wraps platform DB. The connection is established later via `wraps platform connect`.

However, once connected, the dashboard can **scan features** by assuming the IAM role and checking what exists in AWS:
- `scanAWSAccountFeatures()` in `/Users/jarod/Projects/wraps/apps/web/src/actions/aws-accounts.ts` calls AWS APIs to detect: config set, event tracking, event history, identities, sandbox status
- Results stored in `awsAccount.features` JSONB column
- The Getting Started Dashboard already has a "Scan Features" button

**Detection approach:** Infrastructure deployment and platform connection are effectively the same step from the dashboard's perspective — you can't see infrastructure without a connection. The `awsAccount.features.email.configSetName` being non-null means infrastructure is deployed.

### "Domain verified"

**Fully detectable.** Domain verification status is stored in `awsAccount.features.email.identities` (array of `{ identity, type }` where type is "DOMAIN" or "EMAIL_ADDRESS").

**Detection mechanism (already implemented):**
- `extractDomainsFromAccount()` in the dashboard page extracts domains from the features JSONB
- The Getting Started Dashboard shows verified domains in the checklist item
- `scanAWSAccountFeatures()` refreshes this data from AWS SES

**Important nuance:** Domain verification requires DNS propagation. The data in the DB reflects what was true at last scan, not real-time. A "Refresh" / "Re-scan" action is needed for the user to see updated status.

### "Test email sent"

**Detectable but with caveats.** The dashboard checks DynamoDB (not PostgreSQL) for email events:
- `queryEmailEvents()` in `/Users/jarod/Projects/wraps/apps/web/src/lib/aws/dynamodb.ts` queries the user's DynamoDB table in their AWS account
- The dashboard page calls `checkEmailsSent()` which queries for any events in the last 90 days
- If events exist, `hasSentEmail` is true

**Caveats:**
- Requires the platform connection (IAM role) to be established first
- The DynamoDB table must exist (created by `wraps email init`)
- Email events are written by the Lambda in the user's AWS account, not by the Wraps platform
- If the user sends a test email via the CLI (`wraps email test`), it will show up in DynamoDB
- There's also `messageSend` table in the Wraps DB for broadcasts sent through the platform, tracked via `countSentMessages()` in activation tracking

### "SES sandbox status"

**Detectable via feature scan.** The `scanAWSAccountFeatures()` action checks `SESv2Client.GetAccount().ProductionAccessEnabled` and stores the result in `awsAccount.features.email.sandbox` (boolean). The CLI also checks this during `wraps email init`.

---

## 3. Edge Cases and Error States

### DNS Propagation Delays
- Domain verification (DKIM, SPF) requires DNS record creation and propagation
- Propagation can take **minutes to 48 hours** depending on the DNS provider
- The dashboard's domain status is snapshot-based — a manual "Re-scan" is needed
- Users may see "0 verified domains" even after correctly configuring DNS
- **Current UX gap:** no polling/auto-refresh for domain verification status

### SES Sandbox Limits
- New AWS accounts start in SES sandbox mode
- Sandbox limits: can only send to verified email addresses, 200 emails/day, 1 email/second
- Requesting production access requires an AWS support case (can take 24-48 hours)
- The CLI detects sandbox status and warns the user during `wraps email init`
- The dashboard can detect sandbox status via feature scan but does **not currently surface it prominently** in the Getting Started flow
- **Implication for wizard:** "Send test email" step may fail if user hasn't verified a recipient address in sandbox mode

### AWS Credential Issues
- `wraps email init` requires valid AWS credentials (`aws configure` or `aws sso login`)
- Common errors: expired SSO session, wrong profile, insufficient permissions
- The CLI has specific error handling for credential issues in `handleCLIError()`
- CloudFormation fallback avoids local credential issues but requires AWS Console access

### CloudFormation vs CLI Path Divergence
- CLI path: `wraps email init` + `wraps platform connect` = two separate steps
- CloudFormation path: single stack creates everything including IAM role + OIDC provider
- CloudFormation validation requires user to manually copy Role ARN + External ID from stack outputs
- **Current UX gap:** The wizard's CloudFormation validation form has a regex check for role ARN format but error messages for failed AssumeRole can be cryptic

### Onboarding Completion vs Actual Readiness
- Users can **skip** the deploy step and still complete onboarding (success step has "Continue to dashboard anyway" button)
- The `onboardingCompleted` flag is a one-time gate — once set to true, the user is never redirected back to onboarding
- This means a user can be "onboarded" but have zero infrastructure deployed
- The Getting Started Dashboard catches this case and shows the checklist

### Multi-Device / Cleared Browser State
- Onboarding step progress is localStorage-only
- Switching devices or clearing browser data loses progress
- The `onboardingStatus` API check partially mitigates this: it detects active subscription and AWS accounts, so the wizard can skip billing/deploy steps if already done
- **Potential improvement:** persist step progress server-side in `organization_extension`

### Stripe Checkout Interruption
- If user starts Stripe checkout but doesn't complete it, they return to step 2
- URL params (`?subscribed=true`, `?plan=X&interval=Y`) handle the return flow
- The billing step auto-detects active subscriptions and skips forward

---

## 4. Existing UI Patterns

### Empty States
The codebase has a consistent empty state pattern using the `Empty` component from shadcn:
- `/Users/jarod/Projects/wraps/apps/web/src/app/(dashboard)/[orgSlug]/emails/setup/page.tsx` — "Email Not Configured" with CLI commands
- `/Users/jarod/Projects/wraps/apps/web/src/app/(dashboard)/[orgSlug]/sms/setup/page.tsx` — similar for SMS
- `/Users/jarod/Projects/wraps/apps/web/src/app/(dashboard)/[orgSlug]/contacts/components/contacts-empty-state.tsx` — "No contacts yet" with SDK code snippet + create dialog

**Pattern:** Icon + Title + Description + Code snippet/CLI command + Action buttons (docs + primary action)

### Checklist / Progress Pattern
The Getting Started Dashboard uses:
- `Progress` bar component for overall completion percentage
- `ExpandableChecklistItem` — collapsible list items with icon, title, description, complete/incomplete badge
- Inline actions within expanded items (scan features, webhook secret form, domain list)

### Step Wizard Pattern
The onboarding wizard uses:
- `Stepper` / `StepperItem` / `StepperIndicator` components from `@/components/ui/stepper`
- Card-based step content with consistent header (icon + title + description) and footer (back/skip/next)
- `StepProgress` component shows numbered circles with connecting lines

### Status Badges
Consistent use of:
- Green outline badge: "Connected", "Streaming", "Verified", "Complete"
- Secondary badge: "Not connected", "Not configured"
- Optional badge: "Optional"

### CLI Command Display
- `CliCommand` component for copyable CLI commands
- Numbered steps with copy buttons in the deploy step
- Code blocks with `pre > code` styling using `bg-secondary` background

---

## 5. User Flow Mapping

### Happy Path (experienced developer, ~10 minutes)

```
Create org
  -> Onboarding Step 1: Welcome (click "Get Started")
  -> Onboarding Step 2: Choose Plan (select free, click "Continue")
  -> Onboarding Step 3: Deploy & Connect
     - Already has Node.js + AWS CLI configured
     - Copies and runs: npm install -g @wraps.dev/cli
     - Copies and runs: wraps auth login
     - Copies and runs: wraps email init (2-3 min deploy)
     - Copies and runs: wraps platform connect
     - Clicks "I've finished — check connection" -> detected!
  -> Onboarding Step 4: Success (clicks "Continue to Dashboard")
  -> Dashboard: Getting Started checklist shown
     - AWS Account: Connected
     - Platform Events: Streaming
     - Domain: Not verified yet
     - Runs: wraps email domains add -d example.com
     - Configures DNS records
     - Waits for DNS propagation...
     - Clicks "Scan Features" -> domain verified
     - Sends test email via SDK
  -> Dashboard: Overview (all 4 required steps complete)
```

### Realistic Path with Delays (less technical user, hours to days)

```
Create org
  -> Onboarding Step 1: Welcome
  -> Onboarding Step 2: Choose Plan (selects free)
  -> Onboarding Step 3: Deploy & Connect
     - Does not have Node.js installed
     - BLOCKER: needs to install Node.js first (not covered in wizard)
     - Installs Node.js...
     - Does not have AWS CLI or credentials
     - BLOCKER: needs AWS account setup + IAM configuration
     - Gives up, clicks "Skip"
  -> Onboarding Step 4: Success ("Setup Incomplete" variant shown)
     - Clicks "Continue to dashboard anyway"
  -> Dashboard: Getting Started checklist with 0% progress

  === Days later, returns ===

  -> Dashboard: Getting Started checklist (remembers they need to connect AWS)
     - Clicks "Deploy email infrastructure" -> links to /onboarding (but onboarding is already complete!)
     - ISSUE: onboarding page checks `completed` flag and redirects to /emails
     - Must use CLI independently following docs

  === After getting AWS set up ===

  -> Runs CLI commands, deploys, connects
  -> Dashboard: Getting Started checklist now shows AWS + Platform connected
  -> Runs domain add command, configures DNS
  -> DNS propagation: 15 minutes to 48 hours
     - BLOCKER: cannot send email until domain is verified
     - Dashboard still shows "0 verified domains" until re-scan
  -> SES sandbox: can only send to verified recipients
     - BLOCKER: must request production access (24-48 hours AWS review)
  -> Finally sends test email
  -> Dashboard: Overview shown
```

### CloudFormation Path (alternative for users without local Node.js)

```
Create org -> Welcome -> Plan -> Deploy & Connect
  -> Clicks "Deploy via CloudFormation instead"
  -> Sees what gets deployed, clicks "Deploy to AWS Console"
  -> Redirected to AWS CloudFormation Quick Create in new tab
  -> Waits for stack creation (~5 minutes)
  -> Copies ConsoleRoleArn and ExternalId from Outputs tab
  -> Pastes into validation form
  -> Clicks "Validate Connection"
  -> Success! -> Dashboard
```

### Key Observations

1. **The wizard and the dashboard checklist are disconnected.** The wizard gates access but is coarse-grained (4 steps). The dashboard checklist is fine-grained (6 items) but only appears after onboarding is "complete." There's no single unified progression.

2. **"CLI installed" is a prerequisite but not trackable.** The wizard assumes Node.js is available and doesn't guide through prerequisites.

3. **The skip path creates a dead end.** If a user skips the deploy step, they land on a dashboard with 0% progress and no way to re-enter the guided wizard (the onboarding redirect guard checks `onboardingCompleted` and skips if true).

4. **DNS and SES sandbox are the biggest real-world blockers** but neither is prominently surfaced. The wizard's success step mentions "verify your domain" as a next step link, but doesn't prepare users for the wait.

5. **Step detection is mostly feasible** via existing DB records and AWS API calls — the infrastructure is already there. The main gap is "CLI installed" which cannot be passively detected.

6. **The Getting Started Dashboard already has most of the checklist logic** — the proposed wizard would largely be a better UX wrapper around the same detection mechanisms.
