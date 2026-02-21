---
name: explore
description: Read-first codebase exploration before implementing features or fixes. Use before any non-trivial change.
---

# Explore Skill

Use this skill BEFORE implementing any non-trivial feature or fix. Do NOT write code until exploration is complete.

## Steps

1. **Identify the scope**: List every file that will be touched or is relevant to the change.
2. **Read all relevant files**: Use Task agents to read files in parallel if there are more than 3.
3. **Trace the execution path**: Map the flow from entry point through all function calls, error handlers, and state mutations.
4. **Find the pattern baseline**: Identify 1-2 existing features that do the same kind of thing well. These are the template for the new feature.
5. **Document external API calls**: For each external service call (AWS SDK, Vercel API, etc.), list every possible error type and how the codebase currently handles them.
6. **Identify state persistence points**: Note where critical data (IDs, secrets, config) is saved and what happens if subsequent steps fail.
7. **Report findings**: Present a summary of the execution flow, error handling gaps, and state management concerns BEFORE proposing any code changes.

## Where to Look by Domain

| Domain | Key Files |
|--------|-----------|
| API routes | `apps/api/src/routes/`, `apps/api/src/services/`, `apps/api/src/middleware/` |
| Dashboard | `apps/web/src/app/(dashboard)/`, `apps/web/src/actions/`, `apps/web/src/lib/` |
| CLI commands | `packages/cli/src/commands/`, `packages/cli/src/infrastructure/`, `packages/cli/src/utils/` |
| Database | `packages/db/src/schema/`, `packages/db/src/migrations/` |
| Workflows | `apps/web/src/components/(ee)/workflow-builder/`, `apps/web/src/lib/workflow-validation.ts` |
| Templates | `apps/web/src/components/template-editor/`, `apps/web/src/lib/serializers/tiptap-to-react-email.tsx` |
| Auth | `packages/auth/src/`, `apps/web/src/lib/organization.ts` |
| Lambda | `packages/cli/lambda/`, `apps/api/src/(ee)/workers/` |

## Rules

- Do NOT propose code changes during exploration — only observations.
- If you find error handling that uses generic catches or misidentifies error types, flag it explicitly.
- If you find state that is used before being persisted, flag it as a save-order risk.
- If you find unawaited async operations in Lambda/serverless code, flag as fire-and-forget risk.
