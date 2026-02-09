# Explore Skill

Use this skill BEFORE implementing any non-trivial feature or fix. Do NOT write code until exploration is complete.

## Steps

1. **Identify the scope**: List every file that will be touched or is relevant to the change.
2. **Read all relevant files**: Use Task agents to read files in parallel if there are more than 3.
3. **Trace the execution path**: Map the flow from entry point through all function calls, error handlers, and state mutations.
4. **Document external API calls**: For each external service call (AWS SDK, Vercel API, etc.), list every possible error type and how the codebase currently handles them.
5. **Identify state persistence points**: Note where critical data (IDs, secrets, config) is saved and what happens if subsequent steps fail.
6. **Report findings**: Present a summary of the execution flow, error handling gaps, and state management concerns BEFORE proposing any code changes.

## Rules

- Do NOT propose code changes during exploration — only observations.
- If you find error handling that uses generic catches or misidentifies error types, flag it explicitly.
- If you find state that is used before being persisted, flag it as a save-order risk.
- Check auto-memory (`MEMORY.md`) for known SDK quirks before writing new API integration code.
