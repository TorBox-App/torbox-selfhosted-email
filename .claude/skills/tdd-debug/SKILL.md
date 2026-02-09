# TDD Debug Skill

Use this skill for non-trivial bugs that need root cause analysis. For simple bugs, use `/debug` instead.

## Arguments

Pass a description of the bug or error after the command:
- `/tdd-debug SES send fails with "Email address not verified" in production`
- `/tdd-debug platform connect hangs after EventBridge deployment`

## Phase 1: Parallel Investigation (3 agents simultaneously)

Launch ALL THREE of these Task agents in a single message:

### Agent A — Reproduce
- Find or create a minimal test that reproduces the bug
- If the bug involves external services (AWS, API), write the test with mocked clients
- The test MUST fail — a passing test means you haven't captured the bug
- Write the test to `packages/<pkg>/src/__tests__/` following existing test patterns
- Output: one failing test file

### Agent B — Trace
- Read every file in the execution path from entry point to error
- Map the complete call chain with file:line references
- For each external API call, list all possible error types and how they're currently handled
- Flag any generic catches, misidentified error types, or missing error branches
- Check `MEMORY.md` for known SDK quirks
- Output: execution trace with flagged issues

### Agent C — State Audit
- Identify every point where state is created, mutated, or persisted
- Check save ordering: is critical data persisted BEFORE operations that can fail?
- Check if rollback/cleanup happens when later steps fail
- Output: state flow diagram with flagged risks

## Phase 2: Synthesize

After all 3 agents complete:
1. Combine findings into a root cause hypothesis
2. Present the hypothesis to the user with evidence from all 3 agents
3. Do NOT proceed to fixing until the user confirms the hypothesis

## Phase 3: Fix

1. Write the fix
2. Run `npx tsc --noEmit` — must pass
3. Run the failing test from Phase 1 — must now pass
4. Run the full test suite for the affected package — must pass
5. If any check fails, return to Phase 2 with new evidence

## Rules

- NEVER skip Phase 1. The test must exist before the fix.
- NEVER use generic error handling. Every catch must distinguish specific error types.
- If the bug involves AWS SDK, check error.name AND error.message (AWS SDK v3 sometimes returns `name: "Error"` with the real error in `message`).
- Persist state before risky operations, not after.
