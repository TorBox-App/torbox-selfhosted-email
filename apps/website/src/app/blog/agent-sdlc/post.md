# We Replaced Our SDLC with Agent Swarms

**How we build features with 4 parallel research agents, TDD-driven implementation, and adversarial code review — all orchestrated by a single skill.**

---

Most teams using AI coding assistants are doing it wrong. They open a chat, paste some context, say "build me X," and hope for the best. The output is inconsistent. The code doesn't follow existing patterns. Tests are an afterthought. Every feature feels like a coin flip.

We had the same problem. So we built an entire software development lifecycle that runs on agents — not as a novelty, but because we were tired of rework. The system is called `/sdlc`, and it's a Claude Code skill that orchestrates our entire feature development process: from fuzzy idea to shipped code with an audit trail.

Here's how it works.

---

## The Problem with "Vibe Coding"

When you ask an AI agent to "build feature X," it does what any eager junior developer would: it starts coding immediately. No research. No pattern discovery. No test strategy. The result usually works, but it doesn't fit. It invents new patterns instead of following existing ones. It adds error handling you don't need and skips error handling you do. It doesn't know about the architectural decisions baked into adjacent features.

The output looks like code written by someone who joined the team today and skipped onboarding.

We realized the problem wasn't the agent's coding ability — it was the process. Agents are incredibly capable coders when given precise instructions. The bottleneck is context, not capability. So we built a system that front-loads context before any code is written.

---

## Six Phases, One Command

Our SDLC runs through six phases, each producing a numbered artifact:

```
/sdlc idea                    → 1-idea.md
/sdlc research <feature>      → 2-research.md
/sdlc plan <feature>          → 3-plan.md
/sdlc build <feature>         → 4-build.md
/sdlc review <feature>        → 5-review.md
/sdlc context <feature>       → 6-context.md
```

Every artifact lives in `.claude/sdlc/{feature}/`. Phases validate that their prerequisites exist before starting. You can't build without a plan. You can't plan without research. The system enforces the discipline that humans tend to skip.

There's also a fast track — `/sdlc quick` — that collapses idea + plan + build into one flow for small features. But the full lifecycle is where the real value lives.

---

## Phase 1: Idea — The Conversation

The idea phase is the only one with no agents. It's an interactive conversation to firm up what we're building: problem, solution, user stories, scope boundaries, and open questions. The output is a structured `1-idea.md` that becomes the brief for everything downstream.

This sounds simple, but it's critical. A vague idea produces a vague plan, which produces code that misses the mark. Spending 5 minutes here saves hours later.

```markdown
# Feature: Contact Import

## Problem
Users manually enter contacts one by one. Bulk operations require CSV files
and a custom script.

## Solution
Drag-and-drop CSV import with field mapping, duplicate detection,
and validation preview.

## Scope
### In Scope
- CSV upload with drag-and-drop
- Interactive field mapping UI
- Duplicate detection (email match)
- Validation preview before import

### Out of Scope
- Excel/Google Sheets import
- API-based import
- Contact enrichment
```

---

## Phase 2: Research — The Swarm

This is where it gets interesting. The research phase launches **four independent agents in parallel**, each investigating the feature from a different angle:

| Agent | Lens | Focus |
|-------|------|-------|
| **Codebase** (mandatory) | Inside-out | Trace execution flows, map files that change, find pattern baselines, assess blast radius |
| **Library Docs** (mandatory) | API surface | Fetch real docs (not memory), method signatures, error types, rate limits, gotchas |
| **Market/Product** (optional) | Outside-in | Competitive scan, user workflows, feature requirements, pricing implications |
| **Contrarian** (optional) | Devil's advocate | Pre-mortem, hidden costs, alternative approaches, timing risks |

The agents don't coordinate. That's intentional. Independent perspectives surface blind spots that groupthink misses. The codebase agent might find that a "simple" feature touches 12 files. The contrarian agent might find that three competitors tried this approach and all abandoned it.

### The Coordinator Pattern

The agents write their findings to deterministic file paths and signal completion via status files:

```
.claude/research/swarm/{topic}/
├── meta.json                  # Coordinator state
├── codebase/
│   ├── findings.md            # Deep code analysis
│   └── status.json            # {"status":"complete","completedAt":"..."}
├── library-docs/
│   ├── findings.md            # Real API documentation
│   └── status.json
├── market-product/
│   ├── findings.md            # Competitive & user research
│   └── status.json
└── contrarian/
    ├── findings.md            # Risk & alternative analysis
    └── status.json
```

The coordinator polls status files every 15 seconds. If an agent fails, it retries with a modified prompt based on the failure type — network errors get alternative search strategies, timeouts get focus instructions, corrupt outputs get explicit file-write-then-verify instructions. Each agent gets 2 retry attempts before being marked exhausted.

After all agents resolve, the coordinator reads all findings and synthesizes them into a single `2-research.md` document. The synthesis highlights consensus (high-confidence findings), tensions (where agents disagree), and ranked recommendations.

**Tensions are the most valuable output.** When the codebase agent says "this is straightforward" but the contrarian says "this creates a maintenance burden," that's a real decision point — not something to paper over.

---

## Phase 3: Plan — The Kingmaker

The plan phase is the most important phase in the entire system. A good plan enables one-shot implementation. A bad plan causes iteration loops and wasted context.

Plans fail for three reasons:

1. **They don't read the code first.** The plan says "add a new API route" but doesn't look at how existing routes are structured. The build phase invents a pattern instead of following the existing one.
2. **They're too abstract.** "Update the database schema" vs "Add `batchSize` integer column to `workflows` table in `packages/db/src/schema/workflows.ts`, default 100, not null."
3. **They're too big.** If a plan touches 15+ files, it won't one-shot. Break it into chunks.

### Pattern Baseline: The Key Innovation

Before writing a single line of the plan, the agent finds **pattern baselines** — existing implementations that do the same kind of thing. Adding an API route? Read an existing route. Adding a CLI command? Read an existing command. Adding a dashboard page? Read a similar page.

These become the template. The plan specifies, for every file change, exactly which existing code to follow:

```markdown
## Change List

### Chunk 1: Schema + Migration

| # | File | Change | Pattern From |
|---|------|--------|-------------|
| 1 | `packages/db/src/schema/contacts.ts` | Add import table with columns: id, orgId, fileName, status, rowCount, createdAt | `packages/db/src/schema/workflows.ts:23` |
| 2 | `packages/db/src/schema/index.ts` | Export new table | Existing exports in same file |

**Verify**: `pnpm --filter @wraps/db db:generate && pnpm --filter @wraps/db typecheck`
```

Every change has a "Pattern From" column pointing to a specific file and line. The build agent doesn't need to invent anything — it follows the template.

### TDD Units

The plan also pre-defines every test that will drive the build:

```markdown
## TDD Units

| # | Test File | Unit (one behavior) | Pattern From |
|---|-----------|---------------------|-------------|
| 1 | `apps/api/src/__tests__/imports.test.ts` | POST /imports creates import job | `apps/api/src/__tests__/contacts.test.ts` |
| 2 | `apps/api/src/__tests__/imports.test.ts` | POST /imports rejects invalid CSV | `apps/api/src/__tests__/contacts.test.ts` |
| 3 | `apps/api/src/__tests__/imports.test.ts` | GET /imports/:id returns import with org scoping | `apps/api/src/__tests__/contacts.test.ts` |
```

Each unit is one testable behavior. These become the red-green-refactor loop in the build phase.

The plan requires **explicit user approval** before proceeding. This is the gate. If the plan looks wrong, we iterate here — not during implementation.

---

## Phase 4: Build — Red, Green, Refactor

The build phase is TDD-driven. For every unit in the plan:

**Red** — Write a failing test that captures the expected behavior. Place it in the file specified by the plan, following the test pattern from the baseline. Run it. It must fail. If it passes, the behavior already exists — investigate.

**Green** — Write the minimum code to make the failing test pass. Nothing more. Follow the patterns from the plan's "Pattern From" column. Don't add error handling for cases not tested. Don't add features not covered by the current test.

**Regression Gate** — After each unit goes green, run the full validation: all tests, lint, and typecheck. If anything fails, fix it before moving to the next unit. This catches cascading issues early instead of letting them compound.

```markdown
## TDD Progress

| # | Chunk | Unit | Red | Green | Regression | Notes |
|---|-------|------|-----|-------|------------|-------|
| 1 | Schema | add import table | 🔴 | 🟢 | ✅ | |
| 2 | API | POST /imports creates job | 🔴 | 🟢 | ✅ | |
| 3 | API | POST /imports rejects invalid CSV | 🔴 | 🟢 | ⚠️ fixed | Mock needed update |
| 4 | API | GET /imports/:id with org scoping | 🔴 | 🟢 | ✅ | |
```

### Multi-Agent Build

When the plan has 3+ independent chunks, we parallelize. One agent per chunk, each running the full TDD loop independently. Schema changes go in one agent, API routes in another, UI in a third. After all agents complete, their reports merge into `4-build.md`.

### The Rules Are Non-Negotiable

These rules exist because we learned the hard way what happens without them:

- **Never write production code before a failing test.** Red comes first, always.
- **Never skip the regression gate.** Full suite + lint + typecheck after every unit.
- **Never delete a failing test to make the suite pass.** Fix the code, not the test.
- **Mock at boundaries** (AWS SDK, databases, external APIs). Never mock internal functions.
- **If a regression gate fails 3 times on the same issue**, stop and report to the user. Don't thrash.

---

## Phase 5: Review — The Adversary

The review phase isn't a friendly once-over. It's an adversarial review across five dimensions:

1. **Plan Compliance** — For every change in the plan, is it Done / Partially Done / Not Done?
2. **Pattern Compliance** — Did the implementation follow the baselines, or did it invent new patterns?
3. **Security** — OWASP top 10, auth bypasses, injection risks, IDOR, missing org scoping.
4. **Correctness** — Edge cases, error handling, race conditions, data integrity.
5. **Performance** — N+1 queries, missing indexes, unnecessary re-renders, bundle size.

The verdict is one of three: **SHIP**, **FIX AND SHIP**, or **BLOCK**.

### Lint Rule Extraction

The most forward-looking part of the review: for every finding, the reviewer assesses whether it could be caught automatically. If a pattern violation could be a GritQL rule or a baseline architecture test, the reviewer describes it. We then ask the user if they want to implement the rule immediately.

This means our codebase gets more self-enforcing over time. Every review that finds a pattern violation is an opportunity to make that violation impossible in the future.

```markdown
## Lint Rule Candidates

| Finding | Automatable? | Rule Description |
|---------|-------------|-----------------|
| API route missing org scoping | Yes - baseline test | Assert all DB queries in routes include organizationId |
| Inconsistent error response shape | Yes - GritQL | Match response objects missing `error.code` field |
| No rate limit on import endpoint | No | Requires architectural decision on limits |
```

---

## Phase 6: Context — The Memory

The final phase synthesizes everything into a compact context document optimized for future agent consumption. What was built, key files, architecture decisions, patterns introduced, gotchas, and testing approach.

This document becomes part of the project's institutional memory. The next time an agent works on related code, it has the full context of why things were built the way they were.

---

## The Philosophy

Three principles drive the entire system:

### 1. Plan is King

The plan phase is the highest-leverage activity in the entire lifecycle. A 30-minute planning session with real code reading and pattern discovery produces better output than 3 hours of iterative coding. We spend our human attention on reviewing plans, not reviewing code.

### 2. Patterns Over Invention

Agents are creative — sometimes too creative. Left unconstrained, they'll invent a new pattern for every feature. The pattern baseline system constrains this creativity. Every change references an existing implementation. The agent follows the template. The codebase stays consistent.

### 3. Tensions Are Features

When research agents disagree, that's not a failure — it's the most valuable output. The codebase agent sees implementation cost. The market agent sees user demand. The contrarian sees hidden risks. The tension between these perspectives is where real engineering judgment happens. We surface tensions prominently and make them into explicit decisions.

---

## What This Looks Like in Practice

For a medium-sized feature — say, adding CSV contact import — the full lifecycle takes about 45 minutes of human time spread across a few hours:

| Phase | Human Time | Agent Time | Output |
|-------|-----------|------------|--------|
| Idea | 5 min (conversation) | - | Feature brief |
| Research | 1 min (launch) + 3 min (review synthesis) | 5-10 min (4 parallel agents) | Research brief with consensus & tensions |
| Plan | 10 min (review + iterate) | 5 min (code reading + plan writing) | Concrete change list with TDD units |
| Build | 2 min (approve units) + 5 min (monitor) | 15-30 min (TDD loop) | Tested, working code |
| Review | 3 min (read verdict) | 5 min (adversarial review) | Ship/Fix/Block verdict |
| Context | 1 min (review) | 2 min (synthesis) | Context doc for future agents |

The human is a reviewer and decision-maker, not a typist. The agents do the reading, the coding, and the testing. The human approves the plan and the ship decision.

---

## Receipt Tracking: The Audit Trail

Every phase is wrapped with receipt tracking — intent at the start, outcome at the end, a self-scored assessment, and cost/token/duration metrics. This creates a complete audit trail of the feature lifecycle:

```
## Receipt rec_a1b2c3d4
Intent: TDD implement contact-import per plan
Outcome: TDD build complete: 8 units, 12 tests added, all green
Score: 0.9/1.0 — All units implemented per plan, one minor deviation in error shape
Cost: $2.14 · 89k tokens · 18m
Side Effects: 6 files changed, 2 files created
```

Over time, these receipts tell us which features went smoothly and which were painful. We can see which phases consume the most tokens, which features needed the most retries, and where the system produces the highest-quality output.

---

## The Enforcement Layer: Baseline

The SDLC produces code. The review phase catches problems. But what prevents those same problems from recurring in the next feature? That's where **baseline** comes in — a rule engine that runs in CI and makes the codebase self-enforcing.

Baseline is a `baseline.toml` file at the repo root plus an `architecture.test.ts` test suite. Together, they encode every hard-won lesson into automated enforcement. The review phase's lint rule extraction feeds directly into baseline — creating a flywheel where each feature makes the next one harder to ship with bugs.

### Banned Dependencies

Some libraries are banned outright. If an agent (or a human) tries to add `axios`, `moment`, `react-hook-form`, or `next/router`, CI fails with a clear message and suggestion:

```toml
[[rule]]
id = "no-axios"
type = "banned-import"
severity = "error"
packages = ["axios"]
message = "Use the native fetch API instead of axios."
suggest = "Replace with fetch() or a lightweight wrapper"
```

This matters especially with agents. An AI assistant trained on millions of codebases will default to `axios` for HTTP requests because that's what most code uses. Baseline catches it instantly and tells the agent exactly what to use instead.

### Architecture Rules

Beyond imports, baseline enforces architectural patterns:

- **No arbitrary hex colors** in Tailwind — use semantic theme tokens (`bg-background`, not `bg-[#1a1a2e]`)
- **No fire-and-forget** promises in API routes — Lambda terminates when the handler returns, so every async operation must be awaited
- **Server action form errors** must handle `formState` — a pattern that's easy to forget and causes silent failures
- **Infrastructure resources** must include `ManagedBy: 'wraps-cli'` tags and use the `wraps-` prefix
- **ESM only** — no `require()` or `module.exports` anywhere
- **`@ts-expect-error`** over `@ts-ignore` — so suppressed errors fail when the underlying issue is fixed

### Architecture Tests

Some rules are too complex for pattern matching. The `architecture.test.ts` suite handles these with actual code analysis:

**Org-scoped queries** — Every SELECT, UPDATE, and DELETE on the 49 tables that have an `organizationId` column must include `organizationId` in the query. The test scans all API routes and server actions with an 80-line window around each query to find the scoping. This prevents cross-organization data leaks — the #1 security risk in multi-tenant SaaS.

**No `redirect()` inside try/catch** — Next.js `redirect()` throws internally. If called inside a try block, the catch swallows it and the redirect silently fails. The test tracks brace depth to identify this pattern.

**No `console.log` in the dashboard** — With template-literal awareness so it doesn't flag code examples. Production code uses structured logging via Pino.

**No client-only imports in server components** — `@tanstack/react-form` in a server component crashes at runtime with a cryptic error. The test catches it at CI time.

**File size limits** — Action files max at 1,000 lines, API routes at 1,500. Forces decomposition before files become unmaintainable.

### Ratchets: One-Way Progress

Some patterns can't be fixed all at once — the codebase has 1,270 raw Tailwind color utilities that should be semantic tokens. Banning them would break everything. Instead, baseline uses **ratchets**:

```toml
[[rule]]
id = "ratchet-theme-tokens-web"
type = "ratchet"
severity = "error"
pattern = "(?:bg|text|border)-(?:white|black|(?:gray|slate)-(?:50|100|...))"
max_count = 256
message = "Use semantic tokens instead of raw colors (256 remaining, ratchet down)"
```

The count can only go **down**. Every PR that migrates a few colors reduces the max. No PR can add new violations. Over time, the legacy patterns disappear without requiring a big-bang migration.

We ratchet `as any` assertions (92 remaining), `dangerouslySetInnerHTML` usage (76 remaining), hardcoded white/black colors (77 remaining), and raw hex colors in the website (16 remaining).

### The Flywheel

Here's how it all connects:

1. The **review phase** finds a pattern violation — say, an API route that queries an org-scoped table without `organizationId`
2. The reviewer marks it as automatable and describes the rule
3. We add it to `architecture.test.ts` or `baseline.toml`
4. **Every future feature** — whether built by an agent or a human — is automatically checked against that rule
5. The next review has one fewer thing to catch manually

After a few months of this, the baseline suite catches issues that previously required senior engineer review. The codebase doesn't just have conventions — it _enforces_ them. And agents, which are notoriously bad at remembering project-specific conventions across sessions, get immediate feedback when they deviate.

---

## What We Learned

**Front-loading context is everything.** The research swarm adds 5-10 minutes to the process, but it eliminates the "oh, I didn't know about that existing pattern" rework that used to cost us hours.

**Plans need to be concrete, not conceptual.** "Add an API route" is useless. "Add GET /imports/:id to `apps/api/src/routes/imports.ts`, following the pattern at `contacts.ts:89`, with org-scoped query" is useful. Specificity is the difference between one-shot and five iterations.

**Independent research beats coordinated research.** When agents work independently, they surface insights that a single agent would miss. The contrarian agent alone has saved us from building features that would have been wasted effort.

**Self-enforcing codebases compound.** Baseline is our secret weapon. Every rule extracted from a review means that class of bug can never recur — not just for humans, but for agents. After a few months, the architecture tests and ratchets catch issues that previously required senior engineer review. The codebase gets stricter over time, automatically.

**The fast track exists for a reason.** Not every feature needs four parallel research agents and an adversarial review. `/sdlc quick` handles the 2-file bug fixes and small additions. Use the full lifecycle for anything that touches more than a handful of files.

---

## The Stack

The entire system is built on [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills — markdown files that define prompts, agent configurations, and orchestration logic. No custom infrastructure. No hosted service. Just text files that tell agents what to do.

- **Skills**: Markdown-defined prompts with phase logic and agent coordination
- **Agents**: Claude Code sub-agents with specialized roles (researcher, builder, reviewer)
- **Receipt tracking**: MCP-based audit trail for cost and quality metrics
- **Research swarm**: 4 parallel agents with coordinator pattern and auto-recovery
- **TDD engine**: Red-green-refactor loop with regression gates

Everything runs locally. The skills live in the repo. Any team member can modify the process by editing a markdown file.

---

*We're building [Wraps](https://wraps.dev) — email, SMS, and CDN infrastructure that deploys to your AWS account. The SDLC described here is how every feature gets built. If you're interested in agent-driven development, the skills are open to explore at our [GitHub](https://github.com/wraps-team).*
