# Research Swarm

Spin up parallel research agents that independently investigate a topic from different angles, then synthesize their findings into a ranked recommendation. Use this for competitive analysis, feature planning, market research, architecture decisions, or any strategic question worth examining from multiple perspectives.

## Arguments

Pass the research question or topic after the command:
- `/research-swarm should we add inbound email processing?`
- `/research-swarm competitive analysis of email API providers`
- `/research-swarm best approach for adding a billing system`
- `/research-swarm evaluate moving from Pulumi to CDK`

## Phase 1: Frame the Question

Before launching agents, spend 30 seconds framing the research:

1. **Restate the question** in one clear sentence
2. **Identify the decision type**: new feature, build vs buy, market entry, architecture choice, pricing, positioning, or other
3. **Define success criteria**: What does a good answer look like? (e.g., "clear recommendation with tradeoffs", "ranked list of options with effort estimates", "go/no-go with evidence")
4. **Set scope boundaries**: What's explicitly OUT of scope?

Write this framing to `.claude/research/<topic-slug>.md` as the document header before launching agents.

## Phase 2: Parallel Research (3 agents simultaneously)

Launch ALL THREE agents in a single message using the Task tool. Each agent works independently with NO coordination — this is intentional. Independent perspectives surface insights that groupthink misses.

### Agent 1 — Market & Competitive Lens

**subagent_type**: `general-purpose`

Research the external landscape:

- **Competitive scan**: Use WebSearch to find 5-10 players in the space. For each:
  - What they offer (features, pricing, positioning)
  - What users complain about (search "[product] complaints", "[product] vs", "[product] alternative")
  - What they do well (search for praise, case studies, testimonials)
- **Market signals**: Search for trends, funding, acquisitions, developer sentiment
  - Look at HackerNews, Reddit, Twitter/X, dev.to discussions
  - Search for "best [category] 2025 2026" to find roundups and comparisons
- **Pricing & packaging patterns**: How do competitors package and price?
  - Free tiers, usage-based, seat-based, hybrid
  - What's the anchor price point in the market?
- **Gap analysis**: Where are users underserved? What do competitors NOT offer?

**Output format** — return a structured markdown report:
```
## Market & Competitive Analysis

### Competitive Landscape
| Player | Focus | Pricing | Strengths | Weaknesses |
|--------|-------|---------|-----------|------------|

### Market Signals
- [trend/signal with source link]

### Pricing Patterns
- Common models: ...
- Price anchors: ...

### Underserved Gaps
1. [gap] — evidence: [source]

### Key Insight
<one paragraph: the single most important market insight>
```

### Agent 2 — Product & User Lens

**subagent_type**: `general-purpose`

Research from the user's perspective:

- **User needs**: What jobs are users trying to do? Search for:
  - Forum discussions, Stack Overflow questions, GitHub issues about the problem
  - "How do I [do X]" queries — what are people struggling with?
  - Feature requests in competing products
- **User journeys**: Map the ideal happy path and the pain points
  - What's the current workflow? (manual steps, existing tools)
  - Where does friction exist?
  - What would "10x better" look like?
- **Feature requirements**: Based on user needs research, define:
  - Must-haves (table stakes — users won't consider without these)
  - Should-haves (competitive advantage — differentiation from alternatives)
  - Could-haves (delight — nice surprises that drive word-of-mouth)
  - Won't-haves (scope cuts — explicitly out for v1)
- **Differentiation angle**: How would this be positioned? What's the unique value prop?
- **If the research topic involves our codebase or product**: Read the relevant code and existing features to understand current capabilities

**Output format** — return a structured markdown report:
```
## Product & User Analysis

### User Jobs to Be Done
1. [job] — evidence: [source]

### Current Pain Points
1. [pain point] — severity: high/medium/low

### Feature Requirements
#### Must-Have (Table Stakes)
- [feature]: [why it's required]
#### Should-Have (Differentiation)
- [feature]: [competitive advantage]
#### Could-Have (Delight)
- [feature]: [why users would love it]
#### Won't-Have (v1 Scope Cut)
- [feature]: [why it's deferred]

### Positioning
- **For**: [target user]
- **Who**: [need/pain]
- **Our product is**: [category]
- **That**: [key benefit]
- **Unlike**: [alternative]
- **We**: [differentiator]

### Key Insight
<one paragraph: the single most important product insight>
```

### Agent 3 — Technical & Architecture Lens

**subagent_type**: `general-purpose`

Research feasibility and architecture:

- **Codebase readiness**: Explore the current codebase to understand:
  - What exists today that can be leveraged?
  - What patterns are established? (read 2-3 similar features for reference)
  - What would need to change or be added?
- **Architecture options**: Propose 2-3 distinct approaches:
  - For each: describe the approach, key technologies/libraries, and a rough file map
  - Use Context7 (`resolve-library-id` then `query-docs`) to verify API shapes for proposed libraries
  - Use WebSearch for any libraries not in Context7
- **Tradeoff matrix**: For each approach, evaluate:
  - Implementation effort (days/weeks, not hours — be honest)
  - Complexity & maintenance burden
  - Scalability characteristics
  - Reversibility (can we change course later?)
  - Risk factors (unknowns, dependencies on external services)
- **Incremental path**: Can this be shipped in phases? What's the smallest useful v1?
- **Prior art**: Search for how other open-source projects solved this (GitHub code search, blog posts)

**Output format** — return a structured markdown report:
```
## Technical & Architecture Analysis

### Current State
- Relevant existing code: [file:line references]
- Established patterns: [pattern descriptions]
- Reusable pieces: [what we can leverage]

### Architecture Options
#### Option A: [Name]
- Approach: ...
- Key tech: ...
- Effort: X days/weeks
- Pros: ...
- Cons: ...
- Risk: ...

#### Option B: [Name]
(same structure)

#### Option C: [Name]
(same structure)

### Tradeoff Matrix
| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| Effort    |          |          |          |
| Complexity|          |          |          |
| Scalability|         |          |          |
| Reversibility|       |          |          |
| Risk      |          |          |          |

### Recommended Phasing
- **v1 (MVP)**: [smallest useful thing]
- **v2**: [next increment]
- **v3**: [full vision]

### Key Insight
<one paragraph: the single most important technical insight>
```

## Phase 3: Synthesis & Comparison

After all 3 agents return, YOU (the orchestrator) synthesize their findings. Do NOT launch another agent for this — you need to hold all three perspectives simultaneously.

### Step 1: Identify Consensus

Read all three reports. Find where agents AGREE:
- Same gaps identified from different angles? High-confidence opportunity.
- Same risks flagged? High-confidence concern.
- Aligned on scope/approach? Strong signal to proceed.

### Step 2: Identify Divergence

Find where agents DISAGREE or surface tensions:
- Market says "users want X" but tech says "X is expensive/risky"
- Product says "must-have feature" but market says "nobody else does it"
- Tech says "easy to build" but product says "low priority"

These tensions are the most valuable output — they're the real decisions.

### Step 3: Write the Research Brief

Append to the same `.claude/research/<topic-slug>.md` file:

```markdown
## Synthesis

### Consensus (High Confidence)
1. [finding] — supported by: Market, Product, Tech
   - Evidence: [brief summary]

### Tensions (Decisions Needed)
1. [tension description]
   - Market view: ...
   - Product view: ...
   - Tech view: ...
   - **Recommendation**: [your take, with reasoning]

### Ranked Recommendations

#### Recommendation 1: [Primary recommendation]
- **What**: [one sentence]
- **Why**: [evidence from all three lenses]
- **Effort**: [from tech analysis]
- **Risk**: [key risks]
- **First step**: [concrete next action]

#### Recommendation 2: [Alternative]
- (same structure)

#### Recommendation 3: [Contrarian option]
- (same structure — the "what if we did something completely different" option)

### Go / No-Go Assessment
- **Confidence level**: High / Medium / Low
- **Biggest unknown**: [what would change the recommendation if we learned more]
- **Suggested next step**: [specific action — "build a prototype", "talk to 5 users", "run a pricing survey", etc.]

### Raw Research
<link or note that full agent reports are appended below>
```

### Step 4: Append Raw Reports

Append all three agent reports below the synthesis as "Appendix A", "Appendix B", "Appendix C" for reference.

## Phase 4: Present to User

1. Present a **concise summary** (NOT the full document):
   - The top recommendation in 2-3 sentences
   - The biggest tension/decision point
   - The suggested next step
2. Tell the user: "Full research brief is at `.claude/research/<topic-slug>.md`"
3. Ask if they want to:
   - Drill deeper into any specific area
   - Proceed to blueprint/implementation planning
   - Explore a different angle

## Rules

- NEVER skip the competitive/market research. Internal-only analysis leads to building in a vacuum.
- NEVER let agents coordinate. Independent research is the whole point — it surfaces blind spots.
- ALL THREE agents must use real sources (WebSearch, Context7, codebase). No hallucinated research.
- If an agent can't find good information on a topic, it should say so explicitly rather than fabricating insights.
- The synthesis must be HONEST about confidence levels. "We don't know" is a valid finding.
- If the topic is too broad for one session, say so and suggest breaking it into smaller research questions.
- The research brief must be self-contained. Someone reading it cold should understand the full picture.
- Tensions and disagreements are FEATURES, not bugs. Surface them prominently.
- Always include a contrarian option in recommendations. Challenge your own assumptions.
