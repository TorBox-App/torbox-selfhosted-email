# Wraps Unsubscribe Token (packages/unsubscribe-token)

Shared unsubscribe token implementation for `apps/api` and `apps/web`. Issues and verifies RFC 8058 HS256 JWTs (90-day expiry) for email unsubscribe and preferences links.

## Critical Rules

### 1. `UNSUBSCRIBE_SECRET` Is Required in Production

`getSecret()` throws if `UNSUBSCRIBE_SECRET` is missing when running in production (detected by `NODE_ENV=production`, `AWS_LAMBDA_FUNCTION_NAME`, or `VERCEL_ENV`). In development it falls back to a hardcoded dev secret. Never deploy without setting this env var — tokens signed with the dev secret are trivially forgeable.

### 2. `verifyUnsubscribeToken` Returns `null`, Never Throws

Verification swallows all errors and returns `null` for expired, invalid, or structurally wrong tokens. Callers must check for `null` before trusting the payload. Pass a logger (`TokenLogger`) to surface expiry and invalidity as structured log entries rather than silently discarding them.

### 3. Payload Shape Is Fixed (`cid`, `oid`, `tid?`, `type: "unsub"`)

The JWT payload uses short claim names for compactness. `cid` = contactId, `oid` = organizationId, `tid` = optional topicId. Do not rename these without migrating all outstanding tokens (90-day window means live tokens will exist in the wild).

### 4. Use `generateUnsubscribeUrl` / `generatePreferencesUrl`, Not Raw Token Generation

These helpers read `API_BASE_URL` / `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL` to construct the full URL. Assembling URLs manually in callers risks base-URL drift between environments.

## Consumers

- `apps/api` — unsubscribe endpoint, one-click POST handler
- `apps/web` — preferences page, unsubscribe confirmation

## Commands

```bash
pnpm --filter @wraps/unsubscribe-token build     # Build with tsdown
pnpm --filter @wraps/unsubscribe-token test      # Run vitest
pnpm --filter @wraps/unsubscribe-token typecheck # tsc --noEmit
```
