# Wraps Email (packages/email)

Internal email utilities for Wraps platform sends: React Email templates, SES template management, and a Vercel OIDC-authenticated SES client for sending from `apps/web` server actions.

## Critical Rules

### 1. This Is Not the Customer-Facing SDK

`@wraps/email` is a **private, internal** package (`"private": true`). It handles Wraps' own outbound emails (invitations, verifications, topic confirmations, mobile rescue). Customer-facing sending lives in `@wraps.dev/email` (separate repo: `wraps-js`). Do not expose `@wraps/email` to CLI output or customer docs.

### 2. The SES Client Uses Vercel OIDC in Production

`getWrapsClient()` in `src/lib/client.ts` detects production via `VERCEL === "1"` and uses `@vercel/oidc-aws-credentials-provider` to assume `WRAPS_EMAIL_ROLE_ARN` — no stored credentials. In dev it falls back to the standard AWS credential chain. Never hardcode credentials.

### 3. SES Variables Must Use the Transformer

SES templates use `{{variable_name}}` (snake_case, double-brace) not Handlebars syntax. Use `toSesVariableName()` and `flattenVariablesForSes()` from `src/lib/ses-variables.ts` to convert dot-notation keys to snake_case before calling SESv2 template APIs. Bypassing this breaks SES test-render.

### 4. SESv2 Is Used, Not SES v1

`ses-templates.ts` creates `SESv2Client` explicitly (JSON protocol) — not the older `SESClient`. SES v1 has XML entity expansion limits that silently corrupt large templates. Do not substitute v1.

## Consumers

- `apps/web` — server actions for invitation, verification, topic-confirmation, mobile-rescue emails
- `packages/auth` — invitation email trigger

## Commands

```bash
pnpm --filter @wraps/email build   # Build with tsdown
pnpm --filter @wraps/email test    # Run vitest
```
