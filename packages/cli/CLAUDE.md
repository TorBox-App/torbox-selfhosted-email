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

1. Parse args with `args.parse(process.argv)` → flags + subcommands
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

## Key Directories

- `src/commands/` — Command implementations (by service)
- `src/infrastructure/` — Pulumi stacks and resource definitions
- `src/utils/shared/` — Cross-service utilities (errors, config, metadata, output)
- `src/utils/email/` — Email-specific utilities
- `src/utils/sms/` — SMS-specific utilities
- `src/types/` — Shared TypeScript types
- `lambda/` — Lambda function source (bundled by esbuild into deployments)

## Build

- Bundler: tsup (CLI + console bundle)
- Lambda: esbuild (bundled at deploy time, not build time)
- Entry: `cli.ts` → `dist/cli.js` (bin.wraps in package.json)
