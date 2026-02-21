---
name: debug
description: Structured debugging - trace execution path, identify root cause, fix with tests. Use when investigating bugs.
---

# Debug Skill

You are debugging a bug in the Wraps codebase. Follow this process strictly — do NOT guess at fixes.

## Step 1: Reproduce & Understand

- Get the exact error message, stack trace, or unexpected behavior
- Identify which package/app is affected (cli, api, web, db, core)
- Use a Task agent to read ALL files in the affected execution path in parallel

## Step 2: Trace the Execution Path

Map the flow from entry point to failure:
- For API bugs: route handler → service → database → response
- For CLI bugs: command → AWS SDK calls → metadata → output
- For web bugs: page/action → server component → database → client render
- For workflow bugs: trigger → step execution → event emission → next step

## Step 3: Identify Root Cause

Before proposing any fix, answer:
1. What is the exact error type? (Not "it fails" — the specific exception class)
2. What input triggers it? (The specific request, data shape, or state)
3. Why does the current code fail? (The logic gap, not just the symptom)

### Common Root Causes in This Codebase

| Symptom | Likely Cause |
|---------|-------------|
| Lambda timeout / incomplete work | Unawaited async operation (fire-and-forget) |
| Wrong data returned | Missing `organizationId` scope on query |
| Race condition | Concurrent workflow executions, missing idempotency |
| "Cannot read property of undefined" | Missing null check on optional DB join result |
| SES template rendering failure | Dot-notation variables not transformed for SES |
| Workflow stuck | Missing transition, orphan node, or killed promise |

### Error Handling Check

Verify the code distinguishes specific error types:
```typescript
// BAD - generic catch hides the real error
catch (e) { return { error: "Something went wrong" }; }

// GOOD - specific error handling
catch (e) {
  if (e instanceof NotFoundError) return { error: "Contact not found" };
  if (e instanceof CredentialsError) return { error: "AWS credentials expired" };
  throw e; // Re-throw unknown errors
}
```

## Step 4: Fix & Verify

1. Make the minimal fix that addresses the root cause
2. Run type check: `npx tsc --noEmit`
3. Run relevant tests: `pnpm --filter <package> test`
4. If no test covers this case, write one before fixing (TDD the bug)
5. Verify edge cases: missing credentials, not found, permission denied, empty arrays, concurrent access

## Step 5: Check for Siblings

After fixing, check: does this same pattern exist elsewhere?
```bash
# Example: if you fixed an unawaited promise
# Search for other fire-and-forget patterns in the same package
```

## Rules

- NEVER propose a fix before completing Steps 1-3
- NEVER use generic catch-all error handling in the fix
- ALWAYS run `npx tsc --noEmit` after the fix
- If the bug is in shared code, check all callers for impact
