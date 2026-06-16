# Wraps Email Send (packages/email-send)

Canonical SESv2 send pipeline for Wraps. One place for `List-Unsubscribe` headers, configuration set, and `EmailTags` so test sends, broadcasts, and workflow sends produce identical messages.

## Critical Rules

### 1. Every Send Path Must Go Through This Package

`sendEmail()` is the single send entry point. If you build a new send path (drip, transactional, etc.) and bypass this package, recipients will have inconsistent headers, missing tracking tags, or a wrong configuration set. The invariant: `apps/api` + `apps/web` both depend on this package — keep it that way.

### 2. The Configuration Set Is Hard-Coded by Design

`WRAPS_CONFIGURATION_SET_NAME = "wraps-email-tracking"` is the SES configuration set that drives open/click/bounce/complaint events → CloudWatch + EventBridge. Do not allow callers to override it except via `configurationSetName` on the input when there is an explicit operational reason. Omitting the set causes silent tracking loss.

### 3. Missing MessageId Is a Hard Error

SES is contractually required to return a `MessageId` on any 2xx. The function throws if `MessageId` is absent rather than returning a fake ID. A phantom ID would silently break correlation with open/click/bounce events arriving later through the configuration set.

### 4. Marketing Mail Requires `marketing.unsubscribeUrl`

Pass `marketing: { unsubscribeUrl }` for any bulk or broadcast send. This attaches RFC 8058 `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers — required by Gmail/Yahoo for high-volume senders. Transactional sends omit this field.

## Consumers

- `apps/api` — broadcast sends, workflow step sends
- `apps/web` — test sends from the dashboard

## Commands

```bash
pnpm --filter @wraps/email-send build      # Build with tsdown
pnpm --filter @wraps/email-send test       # Run vitest
pnpm --filter @wraps/email-send typecheck  # tsc --noEmit
```
