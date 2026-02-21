# Preflight Skill

Use this skill BEFORE implementing any non-trivial feature. It enforces a discovery-first pipeline that prevents the "code first, debug later" pattern.

## Arguments

Pass a description of the feature after the command:
- `/preflight add inbound email S3 bucket support`
- `/preflight implement webhook retry with exponential backoff`

## Phase 1: Discovery

Launch parallel Task agents to gather all context:

### Agent A — File Mapping
- Identify every file that will be touched or is relevant
- Read all of them (use parallel reads for >3 files)
- List the files with a one-line description of each file's role

### Agent B — Pattern Analysis
- Find 2-3 existing features that are architecturally similar to what's being built
- Document the patterns they use: error handling, state management, API calls, tests
- These patterns are the template for the new feature

### Agent C — External Service Audit
- For every external API call the feature will make (AWS SDK, fetch, etc.):
  - List every possible error type
  - List every possible response shape
  - Check CLAUDE.md and relevant skills for known patterns and gotchas
- Document rate limits, retries, and timeout considerations

**Gate**: Present discovery findings to user. Do NOT proceed until user confirms.

## Phase 2: Contract

Based on discovery findings:

1. Define TypeScript interfaces/types for the feature's public API
2. Write integration tests that define expected behavior:
   - Happy path
   - Each distinct error case from the External Service Audit
   - Edge cases: missing data, partial failures, concurrent access
   - State persistence ordering (save before risky operations)
3. All tests should FAIL at this point (the feature doesn't exist yet)

**Gate**: Present contracts to user. Do NOT proceed until user confirms.

## Phase 3: Implementation Plan

1. List the exact changes needed, in order, with file:line references
2. For each change, note which contract test(s) it satisfies
3. Flag any change that affects shared code or could break other features
4. Estimate the blast radius of each change

**Gate**: Present plan to user. Do NOT proceed until user confirms.

## Phase 4: Incremental Implementation

For each step in the plan:
1. Make the change
2. Run `npx tsc --noEmit` — must pass
3. Run the contract tests — note which ones now pass
4. If type check fails or a previously passing test breaks, STOP and fix before continuing
5. After all steps: run full test suite for the affected package

## Rules

- NEVER skip phases. The gates exist because premature implementation is the #1 source of bugs.
- NEVER write implementation code during Discovery or Contract phases.
- If the feature touches >5 files, use the plan mode (`EnterPlanMode`) for Phase 3.
- If discovery reveals the feature is more complex than expected, say so and let the user decide whether to simplify scope.
