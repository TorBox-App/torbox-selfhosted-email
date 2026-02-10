---
name: code-review
description: Review code for quality, architecture, and pattern consistency. Use when reviewing PRs, files, or after implementing features.
---

# Code Review Skill

Review code for quality issues, architecture problems, and pattern drift. Surface what matters, skip the noise.

## Arguments

Pass files, directories, or a description of what to review:

- `/code-review packages/cli/src/commands/email/test.ts`
- `/code-review apps/api/src/routes/contacts.ts apps/api/src/routes/topics.ts`
- `/code-review the new SMS command files`
- `/code-review` (no args = review all uncommitted changes)

## Phase 1: Gather Context

### If no files specified
Run `git diff --name-only HEAD` and `git diff --cached --name-only` to find all changed files. Read them all.

### If files specified
Read all specified files. Also read 1-2 neighboring files that share interfaces, types, or are called by the reviewed code — reviewers need context.

### Always
- Identify which **skill applies** to the code being reviewed (API routes, forms, CLI commands, dashboard components, etc.)
- Read the relevant skill file to get the current canonical patterns
- Find 1-2 existing files in the codebase that do the same thing well — these are the pattern baseline

## Phase 2: Review

Evaluate the code across these dimensions. Only report **actual problems** — skip anything that's fine.

### 1. Pattern Consistency

The codebase evolves. New patterns replace old ones. Code should match our **latest** patterns, not legacy ones.

Check against:
- The relevant skill's canonical patterns (forms, API routes, CLI commands, etc.)
- The 1-2 baseline files identified in Phase 1
- CLAUDE.md project conventions

Flag:
- Using `react-hook-form` instead of `@tanstack/react-form`
- Using old import paths or deprecated APIs
- Inconsistent naming (`handleX` vs `onX`, different casing conventions)
- Not following the established file/directory structure
- Missing patterns that sibling files implement (e.g., org scoping, auth checks, revalidation)

### 2. Error Handling

Flag:
- Generic `catch(e) { throw e }` or `catch(err) { console.error(err) }` without distinguishing error types
- Missing error handling on external API calls (AWS SDK, fetch, database)
- Error messages that don't help the user fix the problem
- Swallowed errors (catch blocks that silently continue)
- Missing error boundaries in React components that fetch data

Don't flag:
- `.catch(console.error)` on fire-and-forget operations that are properly awaited (this is fine for non-critical side effects)

### 3. State & Data Flow

Flag:
- State used before being persisted (save-order risks)
- Fire-and-forget promises in Lambda/serverless contexts (must await)
- Missing `revalidatePath` after server action mutations
- Race conditions in concurrent operations
- Stale closures in event handlers or effects

### 4. Security

Flag:
- Missing org scoping on database queries (multi-tenant data leaks)
- Missing auth checks in server actions or API routes
- User input passed directly to SQL/queries without parameterization
- Secrets or API keys in client-side code
- Missing CSRF protection on mutation endpoints

Don't flag:
- Theoretical attacks that require compromising the server itself

### 5. Types & Contracts

Flag:
- `any` types (use `unknown` and narrow)
- Type assertions (`as`) that bypass actual checks
- Missing return types on exported functions
- Zod schemas that don't match the actual data shape
- `// @ts-ignore` or `// @ts-expect-error` without explanation

Don't flag:
- Inferred return types on internal helper functions
- Type assertions in test files for mocking

### 6. Complexity & Readability

Flag:
- Functions longer than ~50 lines that do multiple things
- Deeply nested conditionals (3+ levels)
- Boolean parameters that control behavior (use separate functions or options object)
- Premature abstractions (helper extracted for a single use)
- Dead code or commented-out code left behind
- Copy-pasted logic that should be shared

Don't flag:
- Long files that are inherently sequential (CLI command with multiple steps)
- Simple repetitive JSX (tables, form fields)

### 7. Performance (only for hot paths)

Flag:
- N+1 queries (loop of individual DB calls instead of batch)
- Missing `Promise.all` for independent async operations
- Unbounded queries (no LIMIT on potentially large tables)
- React components re-rendering unnecessarily (missing memo, unstable references in deps)

Don't flag:
- Micro-optimizations in code that runs once (CLI commands, migration scripts)
- Missing `useMemo`/`useCallback` on simple values

## Phase 3: Report

Structure the output as:

```
## Code Review: [file or feature name]

**Pattern baseline**: [which files/skills you compared against]

### Issues

#### [severity] [category]: [one-line description]
**File**: `path/to/file.ts:42`
**Current**:
\`\`\`typescript
// the problematic code
\`\`\`
**Should be**:
\`\`\`typescript
// the correct pattern
\`\`\`
**Why**: [one sentence explaining the impact, not just "best practice"]

---

### Pattern Drift

[List any patterns in this code that are outdated compared to our latest conventions. Reference the canonical pattern and where it's established.]

### Looks Good

[1-2 sentences on what the code does well — reinforce good patterns]
```

### Severity Levels

- **must-fix**: Will cause bugs, data leaks, or crashes in production
- **should-fix**: Pattern violation, maintainability concern, or missing guardrail that will bite us later
- **nit**: Style preference or minor inconsistency — fix if you're already touching the file

## Rules

- NEVER suggest adding comments, docstrings, or type annotations to code you didn't flag for other reasons. These are not improvements by themselves.
- NEVER suggest renaming variables or reformatting code that's already clear. Readability is about structure, not naming bikesheds.
- NEVER flag something as an issue if you can't explain a concrete consequence. "Best practice" is not a reason.
- ALWAYS compare against the codebase's own patterns, not generic internet advice. Our patterns are our standard.
- ALWAYS provide the fix, not just the problem. A review that says "this is wrong" without showing the right pattern is useless.
- If the code is genuinely good, say so and move on. Not every review needs to find problems.
- Focus on issues that matter at the **current stage of the project**. Perfect is the enemy of shipped.
