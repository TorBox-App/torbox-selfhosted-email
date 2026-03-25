---
name: release
description: Bump a package version, commit, tag, push, and create a GitHub release with proper naming conventions.
---

# Release a Package

Automates the full release workflow for publishable packages in this monorepo.

## Usage

- `/release cli patch` — Bump CLI patch, tag, push, release
- `/release cli minor` — Bump CLI minor version
- `/release cli major` — Bump CLI major version
- `/release cdk patch` — Bump CDK patch version
- `/release pulumi minor` — Bump Pulumi minor version
- `/release core patch` — Bump Core patch version

If no arguments are provided, ask the user which package and bump type.

## Publishable Packages

Only these packages trigger the CI release workflow:

| Short name | npm package | Directory |
|---|---|---|
| `cli` | `@wraps.dev/cli` | `packages/cli` |
| `cdk` | `@wraps.dev/cdk` | `packages/cdk` |
| `pulumi` | `@wraps.dev/pulumi` | `packages/pulumi` |
| `core` | `@wraps/core` | `packages/core` |

## Critical: Tag Format

The CI workflow (`.github/workflows/release.yml`) **requires** tags in the format:

```
<package>-v<version>
```

Examples: `cli-v2.9.3`, `cdk-v1.0.0`, `pulumi-v0.5.0-beta.1`

**NEVER** use bare `v<version>` tags (e.g., `v2.9.3`). These will fail CI.

## How CI Works

Pushing a tag triggers `.github/workflows/release.yml` which handles:
1. **npm publish** — all packages
2. **Standalone binary builds** — CLI only (darwin-arm64, darwin-x64, linux-x64, linux-arm64)
3. **GitHub release** — created by CI with built assets attached (binaries + checksums)

**NEVER create a GitHub release manually.** GitHub releases are immutable — once created, the tag is permanently locked to that release. CI must create the release with the built assets in a single step. If you pre-create the release, CI cannot attach assets to it or recreate it.

## Steps

1. **Read current version** from the package's `package.json`
2. **Bump version** in `package.json` (patch/minor/major)
3. **Determine what changed** since the last tag for this package using `git log <last-tag>..HEAD -- <package-dir>`
4. **Commit** with message: `chore(<package>): release v<new-version>`
5. **Push** the commit
6. **Create annotated tag**: `git tag -a <package>-v<new-version> -m "<package>-v<new-version>"`
7. **Push the tag**: `git push origin <package>-v<new-version>`
8. **Wait for CI** — the workflow creates the GitHub release with assets automatically. Use `gh run watch` to monitor.

Do NOT create a GitHub release with `gh release create`. CI does this.

## Pre-release Versions

For pre-release tags (beta, alpha, rc), append the pre-release suffix:

- Tag: `cli-v2.10.0-beta.1`
- GH Release: Mark as pre-release with `--prerelease` flag
- npm dist-tag will be set automatically by CI (`beta`, `alpha`, or `rc`)

## Checklist

Before releasing, verify:
- [ ] `pnpm check:all` passes (lint, typecheck, build, tests)
- [ ] Working directory is clean (no uncommitted changes besides the version bump)
- [ ] You're on the `main` branch (or the user confirms releasing from a different branch)
