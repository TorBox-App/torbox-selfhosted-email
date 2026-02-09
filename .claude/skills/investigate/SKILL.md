# Investigate Skill

Use this skill when you need to investigate an issue, error, or unexpected behavior. Unlike `/debug` (which aims to fix), this skill guarantees written output even if the root cause isn't found.

## Arguments

Pass a description of the issue after the command:
- `/investigate why email delivery rates dropped 20% this week`
- `/investigate Vercel DNS error when adding custom tracking domain`
- `/investigate why wraps email upgrade fails silently for dedicated IP`

## Setup

1. Create a notes file: `.claude/investigations/<issue-slug>.md`
2. Write the initial header:
   ```markdown
   # Investigation: <issue description>
   **Started**: <timestamp>
   **Status**: In Progress
   ```
3. All findings are written to this file as you go — it is the minimum deliverable.

## Checkpoint 1: Hypotheses (first pass)

1. Read the relevant code, logs, and error messages
2. Form 3 ranked hypotheses for the root cause
3. Write them to the notes file with reasoning:
   ```markdown
   ## Hypotheses
   1. **Most likely**: <hypothesis> — because <evidence>
   2. **Possible**: <hypothesis> — because <evidence>
   3. **Less likely**: <hypothesis> — because <evidence>
   ```
4. Present hypotheses to user

## Checkpoint 2: Test Hypothesis #1

1. Find or write a minimal test/reproduction that would confirm or rule out hypothesis #1
2. Run it
3. Write results to notes file:
   ```markdown
   ## Hypothesis 1: <name>
   **Test**: <what you did>
   **Result**: Confirmed / Ruled out
   **Evidence**: <output, error, behavior>
   ```
4. If confirmed → proceed to Checkpoint 3
5. If ruled out → test hypothesis #2, then #3

## Checkpoint 3: Resolution or Handoff

**If root cause found:**
1. Document it in the notes file
2. Propose a fix with rationale
3. Ask user if they want you to implement it (switch to `/debug` or `/tdd-debug`)

**If no root cause after all 3 hypotheses:**
1. Update notes file with:
   ```markdown
   ## Status: Needs More Information

   ### Confirmed
   - <what we know>

   ### Ruled Out
   - <what it's NOT>

   ### Next Steps
   - <specific things to try>
   - <data needed>
   - <people to ask>
   ```
2. Present the notes file to user as the deliverable

## Rules

- ALWAYS write findings to the notes file as you go. The file is the deliverable, not the chat.
- NEVER end without updating the Status field in the notes file.
- If you're stuck, write what you know and what you don't. Partial findings are valuable.
- Keep hypotheses specific and testable. "Something is wrong with SES" is not a hypothesis. "SES configuration set event destination is pointing to a deleted SNS topic" is.
- Time-box each hypothesis test. If a single test takes more than 5 minutes of exploration, write partial findings and move to the next hypothesis.
