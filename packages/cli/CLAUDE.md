# CLI Package Context

## Command Pattern

Every command is an async function that takes a typed options object:

```typescript
export async function commandName(options: CommandOptions): Promise<void> {
  const progress = new DeploymentProgress();
  // ...
}
```

- Export a single async function per command file
- No class wrappers — pure functions
- Errors bubble to `handleCLIError()` in `cli.ts`
- All imports are explicit path imports (no barrel re-exports from index.ts)

## CLI Router (`src/cli.ts`)

1. Parse args with `parseCliArgs(process.argv)` (mri-backed) → `{ flags, sub }`
2. Check global flags (`--help`, `--version`, `--json`) before routing
3. Interactive menu if no command provided
4. Route by service: `if (primaryCommand === "email") { switch(subCommand) { ... } }`
5. Track command execution with `trackCommand()` (duration, success, service)
6. Call `telemetry.shutdown()` before exit

## Output & Spinners

Use `DeploymentProgress` from `utils/shared/output.ts` for all user-facing output:

- `progress.execute(message, fn)` — run async fn with spinner
- `progress.succeed/fail/info/step(message)` — manual output
- Auto-suppresses visual output in JSON mode (`--json` flag)

For interactive prompts, use `@clack/prompts`:

- `clack.select()` — radio button selection
- `clack.confirm()` — yes/no
- `clack.text()` — text input
- Always check `clack.isCancel()` after each prompt

Use `pc` (picocolors) for text formatting: `pc.bold()`, `pc.cyan()`, `pc.dim()`.

## JSON Output Mode

- `setJsonMode(flags.json)` early in cli.ts
- `isJsonMode()` returns current state
- Use `jsonSuccess()` / `jsonError()` for structured responses
- DeploymentProgress auto-suppresses in JSON mode

## Error Handling

Use `WrapsError` from `utils/shared/errors.ts`:

```typescript
throw errors.noAWSCredentials(); // Factory function with code, message, suggestion, docsUrl
```

- Include error code (for telemetry), message (for user), suggestion (for fixing)
- Use `isAWSError()`, `isAWSNotFoundError()`, `isPulumiError()` for type detection
- Use `sanitizeErrorMessage()` before logging (removes account IDs, domains, emails)
- Never swallow errors — handle specifically with instanceof guards

## Metadata Persistence

Stored at `~/.wraps/connections/{accountId}-{region}.json`:

- Versioned format (v1.0.0), auto-migrating on load
- Multi-service: `services.email`, `services.sms`, `services.cdn`
- Key functions: `loadConnectionMetadata()`, `saveConnectionMetadata()`, `findConnectionsWithService()`
- To add a migration: bump `CURRENT_VERSION`, write migration fn, add to chain, test in `metadata.test.ts`

## Pulumi Integration

Inline Pulumi programs via `pulumi.automation.LocalWorkspace`:

- Stack name format: `wraps-{accountId}-{region}`
- Stack state stored in `~/.wraps/` (passphrase-encrypted, empty passphrase)
- One AWS resource per file in `infrastructure/resources/`
- Tag all resources: `ManagedBy: 'wraps-cli'`
- Lambda functions bundled on-the-fly with esbuild

## Selfhost Surface

Customers can run the control plane in their own AWS account. Two variants ship, and they are not interchangeable:

| Variant | Entry point | Infra code | What it deploys |
|---|---|---|---|
| `pulumi` | `wraps selfhost deploy` | `infrastructure/selfhost-stack.ts` | API Lambda + Function URL, DynamoDB rate limit, SQS batch/workflow queues, scheduler group. **No dashboard** — the customer hosts `apps/web` themselves from `wraps selfhost env` |
| `sst` | `pnpm selfhost:deploy` from a fork | `infra/selfhost.config.ts` + `scripts/selfhost/*` | Full platform: the above plus the dashboard on CloudFront |

**They cannot coexist in one account.** Both create the account-global `wraps-selfhost-scheduler-role` and `wraps-selfhost-schedulers` group, so the second deploy fails partway with `EntityAlreadyExists`. Probe with `detectSelfhostVariant(region)` (`utils/selfhost/variant.ts`) before any deploy path. Probe order matters: the Pulumi Lambda `wraps-selfhost-api` is unique to Pulumi, the scheduler role is created by both — so the role only implies SST when the Lambda is absent.

`scripts/selfhost/` lives at the repo root, not in this package, and imports `packages/cli/src/**` through relative paths. It is not part of the tsup bundle and customers run it from a clone — so it must build against workspace deps (`pnpm selfhost:build-deps`), never against `dist/`.

### Two control planes, doubled resources

`selfhost connect` and `selfhost update-role` route into `commands/platform/connect.ts` and `update-role.ts` with `selfhosted: true`. Everything below forks on that flag. Nothing may key off the *presence* of selfhost metadata — an ordinary SaaS connect from a machine that had ever deployed selfhost silently revoked platform access that way.

| | Platform | Self-hosted |
|---|---|---|
| Console role | `wraps-console-access-role` | `wraps-selfhost-console-access-role` |
| Trust principal | `WRAPS_PLATFORM_ACCOUNT_ID` | the customer's own `metadata.accountId` |
| Identity in metadata | `platform.{externalId,connectionId}` | `selfhostPlatform.{externalId,connectionId}` |
| SES event target | `wraps-webhook-destination` | `wraps-selfhost-webhook-destination` |

Both sides of every row can exist at once and each flow must leave the other's alone. The separate `selfhostPlatform` key exists because the two planes issue *different* externalIds; writing one into `platform.externalId` breaks the other plane's `AssumeRole`.

**The load-bearing omission:** the self-hosted branch passes `selfhostWebhook` to `buildEmailStackConfig` and **no `webhook` key at all**. That makes the builder reconstruct the platform webhook from metadata, which is what keeps app.wraps.dev receiving events. An explicit `webhook: undefined` means "delete the platform target" and is the coexistence regression. See `deployEventBridge()` in `platform/connect.ts` and `resources/eventbridge-selfhost-webhook.ts`.

`--reroute-events` (a flag on `pnpm selfhost:deploy`/`:upgrade`, not on the CLI) is the legacy path that repointed the single platform target instead of adding a second one. It still works, but `selfhost connect` migrates an account off it and warns — two targets on one API deliver every event twice. The EventBridge rule caps at 5 targets (AWS hard quota), so count targets rather than assuming room for another.

`resources/iam-agent-user.ts` grants `lambda:InvokeFunction` on the agent enforcer to **every** console role that exists, each gated by its own existence probe — not to a hardcoded role name. A missing role is skipped with a warning rather than failing the stack, so a grant aimed at the wrong role name deploys clean and only surfaces later as an IAM denial in the agent approval flow. The platform grant keeps its Pulumi logical name `wraps-agent-invoke` so deployed stacks do not replace the policy; the self-hosted grant has its own.

### Region and URL resolution

- Region is `SELFHOST_AWS_REGION`, written to `.env.selfhost` on first deploy from `--region`. On upgrade, read it back from the env file — **never** fall back to ambient `AWS_REGION`, which would target a different region than the deployed stack.
- Always store the API URL through `normalizeApiUrl()` (`utils/selfhost/api-url.ts`). The raw Lambda Function URL's trailing slash produces a double slash in webhook paths that the API will not route.
- SST names resources `{app}-{stage}-{logical}-{suffix}`, so nothing can be fetched by exact name — recovering the SST variant's API URL is a paginated Lambda scan, not a lookup.
- The API reads `WRAPS_LICENSE_KEY`, not the `LICENSE_KEY` that `.env.selfhost` stores. `infra/selfhost.config.ts` maps one to the other; a bare `LICENSE_KEY` on the function is an unlicensed deployment.

Deployment tests for all of this are `tests/deployment/selfhost/`, `selfhost-sst/`, and `coexistence/` — see `tests/deployment/README.md`. They need real AWS and are kept out of CI.

## Key Directories

- `src/commands/` — Command implementations (by service)
- `src/infrastructure/` — Pulumi stacks and resource definitions
- `src/utils/shared/` — Cross-service utilities (errors, config, metadata, output)
- `src/utils/email/` — Email-specific utilities
- `src/utils/sms/` — SMS-specific utilities
- `src/utils/selfhost/` — Variant detection, API URL normalization, Neon provisioning
- `src/types/` — Shared TypeScript types
- `lambda/` — Lambda function source (bundled by esbuild into deployments)

Outside this package but part of its surface: `scripts/selfhost/` (SST variant's deploy/upgrade/destroy) and `infra/selfhost.config.ts`, both at the repo root.

## Build

- Bundler: tsup (CLI + console bundle)
- Lambda: esbuild (bundled at deploy time, not build time)
- Entry: `cli.ts` → `dist/cli.js` (bin.wraps in package.json)
