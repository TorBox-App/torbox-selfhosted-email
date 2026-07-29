# Wraps Mail Check (packages/mail-check)

Standalone CLI tool (`mail-audit`) for email deliverability auditing: SPF, DKIM, DMARC, MX, blacklists, TLS — returning letter grades A–F.

## Critical Rules

### 1. This Is a Standalone CLI, Not a Library

`mail-check` publishes a `bin` entry (`mail-audit`) and builds with tsup to `dist/`. It is **not** imported by `apps/web` or `apps/api`. The package name in `package.json` is `mail-audit` (no `@wraps/` scope), meaning it is designed for public distribution, not monorepo workspace import.

### 2. Email Check Logic Lives in `@wraps.dev/email-check`

DNS probes, deliverability scoring, and letter grading are all in the separate `@wraps.dev/email-check` package (workspace ref). `packages/mail-check` only owns the CLI layer: argument parsing, spinner, colorized output, JSON mode, and exit codes. Do not duplicate check logic here.

### 3. Exit Codes Are Meaningful

`getExitCode(grade)` from `@wraps.dev/email-check` maps grades to process exit codes. This is used by CI pipelines and the Wraps dashboard's domain health check. Do not swallow non-zero exits or replace `process.exit()` with throws.

### 4. Subcommands: `check` (default) and `spf`

- `mail-audit <domain>` — full audit (check command)
- `mail-audit spf <domain>` — SPF-only with lookup tree
- `--json` flag on both subcommands emits machine-readable JSON (used by dashboard integration)

## Commands

```bash
pnpm --filter mail-audit build    # Build with tsup → dist/
pnpm --filter mail-audit test     # Run vitest
```
