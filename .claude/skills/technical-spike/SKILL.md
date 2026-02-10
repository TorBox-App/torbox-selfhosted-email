# Technical Spike

Swarm parallel agents to evaluate the technical feasibility of a feature request. Produces a written recommendation with architecture options, effort estimates, risk assessment, and a concrete execution plan. Use this BEFORE committing to build — it answers "can we?", "how should we?", and "what could go wrong?"

## Arguments

Pass the feature request or technical question after the command:
- `/technical-spike add real-time webhooks to the event processor`
- `/technical-spike migrate from Pulumi to CDK for infrastructure`
- `/technical-spike add multi-tenant billing with Stripe`
- `/technical-spike support custom SMTP relay alongside SES`

## Phase 1: Frame the Spike

Before launching agents, define the spike in 60 seconds:

1. **Restate the feature** as a concrete capability (not vague aspirations)
2. **Identify constraints** known upfront: budget, timeline, compatibility requirements, must-not-break guarantees
3. **Define what "feasible" means**: Can we build it at all? Can we build it in X weeks? Can we build it without breaking Y?
4. **List known unknowns**: What specific technical questions does this spike need to answer?

Write this framing to `.claude/spikes/<feature-slug>.md` as the document header:

```markdown
# Technical Spike: <Feature Name>
**Created**: <timestamp>
**Status**: In Progress

## Framing
**Feature**: <one sentence description of the capability>
**Constraints**: <known constraints>
**Feasibility bar**: <what must be true to say "yes, build this">
**Key questions**:
1. <specific technical question>
2. <specific technical question>
3. <specific technical question>
```

## Phase 2: Parallel Investigation (3 agents simultaneously)

Launch ALL THREE agents in a single message using the Task tool. Each agent investigates independently — overlapping perspectives are intentional.

### Agent 1 — Codebase Feasibility Audit

**subagent_type**: `general-purpose`

Deep dive into the current codebase to assess readiness:

- **Extension points**: Where does this feature plug in? Read the relevant entry points, routers, handlers, and infrastructure code. Map the exact files and functions that would need to change.
- **Data model impact**: Does this require new database tables, new fields, new types? Read existing schemas and types to understand what exists.
- **Dependency graph**: What existing code depends on the areas that would change? Trace imports and call sites to estimate blast radius.
- **State & persistence**: Where is related state stored today? (metadata files, DynamoDB, environment variables, Pulumi state) What new state does this feature need?
- **Existing patterns**: Read 2-3 similar features in the codebase. How are they structured? What shared utilities do they use? The new feature should follow these patterns.
- **Complexity assessment**: Rate the implementation complexity — is this a weekend project or a multi-week effort? Be specific about why.

**Output format** — return a structured markdown report:
```
## Codebase Feasibility Audit

### Extension Points
- [file:line] — [what it does, how the feature plugs in]

### Data Model Impact
- New types/interfaces needed: ...
- Schema changes: ...
- Migration required: yes/no

### Blast Radius
- Files that must change: [list with brief reason]
- Files at risk of breaking: [list with brief reason]
- Shared utilities affected: [list]

### Current Patterns (Reference)
- **Pattern from [feature]**: [how it's structured, file references]
- **Pattern from [feature]**: [how it's structured, file references]

### Complexity Assessment
- **Rating**: Low / Medium / High / Very High
- **Reasoning**: [specific factors — number of files, external dependencies, data migrations, etc.]
- **Estimated effort**: [range in days/weeks]

### Key Finding
<one paragraph: the single most important codebase insight for feasibility>
```

### Agent 2 — External Research & Prior Art

**subagent_type**: `general-purpose`

Research how to build this and what tools/services are available:

- **Libraries & SDKs**: Identify candidate libraries. Use Context7 (`resolve-library-id` then `query-docs`) to fetch current API docs. Verify: Does the API actually support what we need? What are the method signatures, error types, rate limits?
- **AWS services** (if applicable): Which specific AWS APIs are needed? What are the pricing implications? Use WebSearch to find current pricing pages and limits.
- **Prior art**: Search for how other projects solved this:
  - GitHub code search for similar implementations
  - Blog posts and technical write-ups (search "[approach] implementation", "[feature] architecture")
  - Open-source projects that do something similar
- **Known pitfalls**: Search for "[library/service] gotchas", "[library/service] issues", "[library/service] problems" to surface landmines before we step on them.
- **Compatibility**: Will proposed libraries/services work with our stack? (Node.js 20+, ESM, TypeScript strict, Pulumi, AWS SDK v3)

**Output format** — return a structured markdown report:
```
## External Research & Prior Art

### Candidate Libraries/Services
| Name | Purpose | Maturity | License | Compatibility |
|------|---------|----------|---------|---------------|

### API Reference (Key Methods)
For each critical external API:
- **Service/Library**: name
- **Method**: signature
- **Required params**: with types
- **Response shape**: key fields
- **Error types**: what can go wrong
- **Rate limits**: if applicable
- **Pricing**: per-unit cost

### Prior Art
1. **[Project/Article]**: [approach taken, link]
   - What worked: ...
   - What didn't: ...
   - Relevance to us: ...

### Known Pitfalls
1. [pitfall] — source: [link]
   - Impact: ...
   - Mitigation: ...

### Compatibility Check
- Node.js 20+ ESM: pass/fail
- TypeScript strict: pass/fail
- AWS SDK v3 interop: pass/fail
- Pulumi compatibility: pass/fail

### Key Finding
<one paragraph: the single most important external research insight>
```

### Agent 3 — Architecture Options & Risk

**subagent_type**: `general-purpose`

Design 2-3 concrete architecture options and stress-test them:

- **Option design**: For each option, define:
  - The approach in plain language (one paragraph)
  - A file/component map showing where new code lives
  - Data flow diagram (text-based: A -> B -> C)
  - Which existing patterns it follows (or where it diverges)
  - Key technology choices and why
- **Tradeoff analysis**: For each option, evaluate:
  - **Effort**: implementation time (be honest — include testing, error handling, docs)
  - **Complexity**: how much new complexity does this add to the codebase?
  - **Performance**: latency, throughput, resource consumption implications
  - **Scalability**: what breaks at 10x, 100x current scale?
  - **Security**: new attack surface, credential handling, permission model
  - **Reversibility**: how hard is it to change course or rip this out?
  - **Operational cost**: ongoing AWS/infrastructure costs at different volume tiers
- **Risk register**: For each option, list the top 3 risks:
  - What's the risk?
  - How likely is it? (High/Medium/Low)
  - What's the impact if it happens?
  - What's the mitigation?
- **Incremental delivery**: Can each option be shipped in phases? Define the smallest useful v1.

**Output format** — return a structured markdown report:
```
## Architecture Options & Risk Analysis

### Option A: [Name]
**Approach**: [one paragraph]
**Data flow**: [A -> B -> C notation]
**File map**:
- [new/modified file] — [purpose]

**Tradeoffs**:
| Criterion | Rating | Notes |
|-----------|--------|-------|
| Effort | X days/weeks | ... |
| Complexity | Low/Med/High | ... |
| Performance | ... | ... |
| Scalability | ... | ... |
| Security | ... | ... |
| Reversibility | ... | ... |
| Operational cost | $X/mo at Y volume | ... |

**Risks**:
1. [risk] — likelihood: X, impact: X, mitigation: ...

**Phasing**:
- v1: [smallest useful increment]
- v2: [next increment]

### Option B: [Name]
(same structure)

### Option C: [Name]
(same structure — include a contrarian or unconventional option)

### Comparison Matrix
| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| Effort | | | |
| Complexity | | | |
| Performance | | | |
| Scalability | | | |
| Security | | | |
| Reversibility | | | |
| Cost | | | |
| Overall risk | | | |

### Key Finding
<one paragraph: the single most important architecture insight>
```

## Phase 3: Synthesis & Recommendation

After all 3 agents return, YOU (the orchestrator) synthesize their findings. Do NOT delegate this — you need to hold all three perspectives simultaneously.

### Step 1: Answer the Key Questions

Go back to the framing. For each key question listed, write a direct answer with evidence from the agent reports.

### Step 2: Assess Feasibility

Based on all three reports, make a clear feasibility call:

- **Green**: Feasible with known approach, manageable risk, reasonable effort
- **Yellow**: Feasible but with significant unknowns, non-trivial risk, or high effort
- **Red**: Not feasible within constraints, or risks outweigh benefits

### Step 3: Pick the Winner

Select the recommended architecture option and justify it:
- Why this option over the others?
- What are you accepting by choosing this? (tradeoffs you're consciously making)
- What are you betting on? (assumptions that must hold true)

### Step 4: Write the Execution Plan

For the recommended option, write a concrete execution plan:
- Ordered steps with estimated effort per step
- Dependencies between steps (what blocks what)
- Checkpoints where progress should be validated
- "Kill criteria" — signals that the approach isn't working and we should reconsider

### Step 5: Write the Spike Report

Append to the same `.claude/spikes/<feature-slug>.md` file:

```markdown
## Feasibility Assessment

### Key Questions — Answered
1. **Q**: <question from framing>
   **A**: <direct answer with evidence>

### Verdict: GREEN / YELLOW / RED
<one paragraph justification>

## Recommended Architecture

### Approach: [Option Name]
<summary of the approach>

### Why This Option
- [reason with evidence]

### Accepted Tradeoffs
- [tradeoff we're consciously accepting]

### Assumptions That Must Hold
- [assumption] — if wrong: [consequence]

## Execution Plan

### Phase 1: [Name] — [X days/weeks]
1. [step] — effort: [estimate]
2. [step] — effort: [estimate]
**Checkpoint**: [how to validate this phase worked]

### Phase 2: [Name] — [X days/weeks]
1. [step] — effort: [estimate]
**Checkpoint**: [validation]

### Phase 3: [Name] — [X days/weeks]
(continue as needed)

### Kill Criteria
- If [signal], reconsider [aspect]
- If [signal], fall back to [Option B/C]

## Risk Summary
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
(top 5 risks across all options)

## Alternative Options
Brief summary of rejected options and why, so the team can revisit if assumptions change.

### [Option B Name]
- Why rejected: ...
- Reconsider if: ...

### [Option C Name]
- Why rejected: ...
- Reconsider if: ...

## Raw Research
<appendix with full agent reports>
```

## Phase 4: Present to User

1. Present a **concise summary** (NOT the full document):
   - Feasibility verdict (Green/Yellow/Red) with one-sentence justification
   - The recommended architecture in 2-3 sentences
   - Top risk and its mitigation
   - Estimated total effort
   - Suggested first step
2. Tell the user: "Full spike report is at `.claude/spikes/<feature-slug>.md`"
3. Ask if they want to:
   - Drill deeper into a specific option or risk
   - Proceed to `/blueprint` for detailed implementation planning
   - Adjust constraints and re-evaluate
   - Spike a sub-problem that emerged from the research

## Rules

- NEVER skip external research. Building on assumptions about APIs leads to rework. Fetch the real docs.
- NEVER let agents coordinate. Independent investigation surfaces blind spots.
- ALL THREE agents must use real sources (codebase reads, Context7, WebSearch). No hallucinated research.
- If an agent can't find information, it must say so explicitly rather than guessing.
- The feasibility verdict must be HONEST. "Yellow" is not a cop-out — it means "feasible with caveats, here are the caveats."
- "Red" is a valid and valuable outcome. Killing a bad idea early saves weeks. Frame it as "here's what would need to change for this to become feasible."
- Include a contrarian architecture option. Challenge the obvious approach.
- Effort estimates must include testing, error handling, and documentation — not just the happy path.
- The spike report must be self-contained. Someone reading it after `/clear` should understand the full picture.
- The execution plan must have kill criteria. Every plan needs a "when to stop" signal.
- If the feature is too large for a single spike, say so and suggest breaking it into smaller spikes (one per major technical question).
