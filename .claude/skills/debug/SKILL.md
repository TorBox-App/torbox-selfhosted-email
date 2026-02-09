# Debug Skill
1. First, use a task agent to read ALL files in the affected execution path
2. Identify the exact error type and root cause before proposing any fix
3. Check that error handling distinguishes specific error types (not generic catches)
4. Make the fix, then run `npx tsc --noEmit` and relevant tests
5. Verify the fix handles edge cases (missing credentials, not found, permission denied)
