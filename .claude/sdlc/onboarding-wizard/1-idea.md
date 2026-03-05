# Feature: Onboarding Wizard

## Problem
Users create an organization then drop off because the path from "org created" to "first email sent" is unclear and intimidating — especially for non-technical users. The CLI is powerful but requires Node.js and AWS familiarity, creating a knowledge gap that prevents activation.

## Solution
A step-by-step guided wizard in the dashboard that breaks the activation journey into small, trackable steps with clear instructions, status detection, and progress persistence. Supplements the CLI — doesn't replace it.

## User Stories
- As a new user, I want to see exactly what steps remain after creating my org so I don't feel lost
- As a non-technical user, I want clear instructions for each step (install Node, install CLI, configure AWS, deploy, verify DNS) so I can follow along without prior knowledge
- As a user, I want the dashboard to detect when I've completed a step so I don't have to figure out if it worked
- As a returning user, I want to pick up where I left off so I don't lose progress

## Scope
### In Scope
- Dashboard onboarding wizard UI (multi-step, persistent progress)
- Step-by-step guidance for: install prerequisites, install CLI, AWS setup, `wraps email init`, DNS verification, SES sandbox, send test email
- Auto-detection of completed steps (e.g., platform connected, domain verified, test email sent)
- Links to relevant docs at each step

### Out of Scope
- Replacing the CLI flow
- Server-side infrastructure deployment (still done via CLI)
- Onboarding emails / notifications
- Full CloudFormation parity
- Non-email services (SMS, CDN onboarding)

## Open Questions
- How do we detect step completion from the dashboard? (e.g., platform connect creates a connection record we can check, DNS/domain verification status from SES)
- Should we track onboarding progress in the DB or use a simpler approach (local state, feature flags)?
- Do we want an "estimated time remaining" or keep it simple?
- Should the wizard be dismissible/skippable for power users who already know what they're doing?

## Status
- Created: 2026-03-04
- Phase: idea
