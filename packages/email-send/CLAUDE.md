# Wraps Email Send (packages/email-send)

Canonical SESv2 send pipeline for Wraps. One place for `List-Unsubscribe` headers, configuration set, and `EmailTags` so test sends, broadcasts, and workflow sends produce identical messages.

## Critical Rules

### 1. Every Send Path Must Go Through This Package

`sendEmail()` is the single send entry point. If you build a new send path (drip, transactional, etc.) and bypass this package, recipients will have inconsistent headers, missing tracking tags, or a wrong configuration set. The invariant: `apps/api` + `apps/web` both depend on this package — keep it that way.

### 2. The Configuration Set Is Resolved Per-Domain, Never Derived

`WRAPS_CONFIGURATION_SET_NAME = "wraps-email-tracking"` is the legacy global SES configuration set that drives open/click/bounce/complaint events → CloudWatch + EventBridge. Configuration sets are **per-domain** now (`wraps-email-<domain>`), so send paths resolve the set from the sender domain with `resolveConfigurationSetName()`.

**Only ever use a config-set name discovery confirmed exists.** A send that references a missing set hard-fails at the SES request level (failing an entire broadcast chunk), so `resolveConfigurationSetName()` never *derives* `wraps-email-<domain>` from a domain — it looks up the set SES returned for that identity during the scan (`features.email.identities[].configSetName`), then falls back to the stored canonical, then the legacy global set. It never omits the set: omitting silently disables tracking and makes engagement-gated workflows take the "not engaged" branch. `sendEmail`'s `configurationSetName` still defaults to `WRAPS_CONFIGURATION_SET_NAME` when the caller passes nothing (test sends rely on this).

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
