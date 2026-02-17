---
name: commit
description: Run checks and commit using conventional commits. Use when the user says "commit", "save my changes", or "/commit".
---

# Commit Skill

Run `pnpm check:all` and create a conventional commit.

## Arguments

Optional commit message hint:

- `/commit` (no args = auto-generate message from diff)
- `/commit add SMS batch sending` (hint for the message)

## Step 1: Check for Changes

Run `git status` and `git diff --stat` in parallel to see what changed. If there are no changes, tell the user and stop.

## Step 2: Run Checks

Run `pnpm check:all`. This runs lint, typecheck, guardrails, build, and tests.

If checks fail:
1. Show the user what failed
2. Ask if they want you to fix the issues
3. If yes, fix them and re-run `pnpm check:all`
4. If checks fail again after 2 attempts, stop and show the errors

Do NOT skip checks. Do NOT commit with failing checks.

## Step 3: Analyze Changes

Run `git diff` and `git diff --cached` to understand all staged and unstaged changes. Also run `git log --oneline -5` to see recent commit style.

## Step 4: Stage Files

Only stage files that were changed **in this session**. If there are pre-existing uncommitted changes from before this session, do NOT include them — ask the user what to do with those.

Stage files by name. Do NOT use `git add -A` or `git add .`. Never stage `.env` files or credentials.

## Step 5: Write Commit Message

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>
```

### Types
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `chore` — maintenance (deps, config, CI)
- `docs` — documentation only
- `test` — adding or fixing tests
- `perf` — performance improvement
- `style` — formatting, missing semicolons (not CSS)

### Scope
Use the package or app name: `cli`, `web`, `api`, `db`, `auth`, `email`, `sms`, `cdn`, `ui`, `core`, `website`.

For changes spanning multiple packages, use the primary one or omit scope.

### Rules
- Subject line: imperative mood, lowercase, no period, under 72 chars
- If the user provided a hint, use it to inform the message
- If no hint, derive the message from the diff
- Focus on **why**, not **what**
- Add body only if the change is non-obvious

### Examples
```
feat(cli): add SMS batch sending command
fix(web): prevent duplicate form submissions on slow connections
refactor(api): extract workflow event emission into service layer
chore(db): add index on events table for org lookups
```

## Step 6: Commit

Create the commit using a HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Optional body explaining why.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Run `git status` after to confirm success.

## Rules

- NEVER commit with failing checks
- NEVER use `git add .` or `git add -A`
- NEVER stage `.env`, credentials, or secrets
- NEVER skip `pnpm check:all`
- NEVER amend previous commits unless explicitly asked
- ALWAYS use conventional commit format
- ALWAYS include `Co-Authored-By` trailer
