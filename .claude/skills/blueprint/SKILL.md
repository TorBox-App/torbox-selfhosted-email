# Blueprint Skill

Use this skill to plan a new feature or expand an existing one. This skill produces a written plan — it does NOT write implementation code.

## Arguments

Pass a description of the feature after the command:
- `/blueprint add inbound email processing with S3 storage`
- `/blueprint expand SMS service with delivery receipts`
- `/blueprint add webhook retry with exponential backoff to event processor`

## Phase 1: Parallel Research (3 agents simultaneously)

Launch ALL THREE of these Task agents in a single message:

### Agent A — Code Exploration
- Identify the area of the codebase this feature touches
- Read every relevant file end-to-end (entry points, utilities, types, tests, infrastructure)
- Map the complete execution flow with file:line references
- Document the current types/interfaces that will be extended
- List every file that will need to be created or modified
- Output: file map with descriptions and current execution flow

### Agent B — Doc Collection
- Identify every third-party library, SDK, or service the feature will use
- Use Context7 (`resolve-library-id` then `query-docs`) to fetch current API docs for each
- For AWS services: fetch the specific API actions needed (e.g., `PutObject`, `CreateReceiptRule`)
- Document: method signatures, required parameters, response shapes, error types, rate limits
- If Context7 doesn't have the library, use WebSearch + WebFetch to get the relevant docs
- Output: third-party API reference with all needed methods, params, errors, and gotchas

### Agent C — Pattern Mining
- Find 2-3 existing features in the codebase that are architecturally similar
- Document the patterns they use: file structure, error handling, state management, testing approach
- Note the naming conventions, resource prefixes, and tag patterns used
- Identify any shared utilities or abstractions the new feature should reuse
- Output: pattern reference with concrete examples from the codebase

## Phase 2: Write the Blueprint

After all 3 agents complete, synthesize their findings into a plan file.

**Create**: `.claude/blueprints/<feature-slug>.md`

The blueprint MUST include these sections:

```markdown
# Blueprint: <Feature Name>
**Created**: <timestamp>
**Status**: Draft

## Overview
<1-2 paragraph description of what this feature does and why>

## Scope
- **New files**: list with purpose
- **Modified files**: list with what changes and why
- **Not touching**: explicitly list related files that should NOT change

## Third-Party APIs
For each external API call:
- **Service**: name + method
- **Required params**: with types
- **Response shape**: key fields
- **Error types**: every possible error and how to handle it
- **Rate limits / gotchas**: from docs

## Implementation Steps
Ordered list of steps. Each step includes:
1. What to do (specific, not vague)
2. Which file(s) to touch
3. Which pattern to follow (reference Agent C findings)
4. Which tests to write for this step

## Types
TypeScript interfaces/types the feature needs — both new and extensions to existing.

## Error Handling
For each error scenario:
- What can go wrong
- How to detect it (error.name, error.code, status code)
- How to handle it (retry, fail with message, fallback)

## Testing Strategy
- Unit tests: what to mock, what to assert
- Integration tests: which flows to test end-to-end
- Edge cases: list explicitly

## Patterns to Follow
<Paste the most relevant pattern examples from Agent C>

## Open Questions
<Anything that needs user input before implementation can start>
```

## Phase 3: Present for Approval

1. Present a summary of the blueprint to the user (do NOT paste the entire file)
2. Highlight any open questions or decision points
3. Tell the user: "The full blueprint is at `.claude/blueprints/<feature-slug>.md`. You can `/clear` and reference this file when you're ready to implement."
4. Do NOT proceed to implementation. The blueprint is the deliverable.

## Rules

- NEVER write implementation code. This skill produces a plan, not code.
- NEVER skip doc collection. Guessing at API shapes causes bugs. Fetch the real docs.
- If a third-party API has known quirks (e.g., AWS SDK v3 error handling), document them explicitly in the blueprint.
- If the feature scope is larger than expected, say so and suggest breaking it into smaller blueprints.
- The blueprint file must be self-contained — someone reading it after `/clear` should have everything they need to implement.
- Write the blueprint in enough detail that implementation is mechanical, not creative.
