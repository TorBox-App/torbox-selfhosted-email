---
name: pr
description: Create a pull request from the current branch. Use when the user says "create a PR", "open a PR", or "/pr".
---

# Pull Request Skill

Create a GitHub pull request from the current branch.

## Arguments

- `/pr` (no args = draft PR, auto-generate title and body)
- `/pr --ready` (create as ready for review, not draft)
- `/pr fix contact deduplication` (hint for the PR title/body)

## Step 1: Check for Uncommitted Changes

Run `git status`. If there are uncommitted changes:
1. Ask the user if they want to commit first
2. If yes, invoke the `/commit` skill
3. If no, proceed without committing (warn that uncommitted changes won't be in the PR)

## Step 2: Check Branch State

Run `git branch --show-current` and `git rev-parse --abbrev-ref @{upstream} 2>/dev/null` in parallel.

- If on `main`: stop and tell the user to create a feature branch first
- If the branch has no upstream: push with `git push -u origin HEAD`
- If the branch is behind the remote: push with `git push`

## Step 3: Gather Context

Run in parallel:
- `git log main..HEAD --oneline` to see all commits on this branch
- `git diff main...HEAD --stat` to see all files changed vs main

## Step 4: Create Pull Request

Use `gh pr create` with:

- **`--draft`** by default (unless `--ready` was passed as an argument)
- **Title**: Derive from the branch name or the user's hint. Keep under 70 chars.
- **Body**: Use this format:

```
gh pr create --draft --title "the pr title" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points summarizing what changed and why>

## Test plan
- [ ] <testing steps>

## Known Issues
<only include this section if there are known issues or partial implementations>

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If `--ready` was passed, omit the `--draft` flag.

## Step 5: Return Result

Show the PR URL to the user.

## Rules

- NEVER create a PR from the `main` branch
- NEVER force-push as part of this skill
- ALWAYS use `--draft` by default (safer for CI and reviewers)
- ALWAYS include a summary and test plan in the body
- ALWAYS push to remote before creating the PR
- If `gh` CLI is not available, tell the user to install it
