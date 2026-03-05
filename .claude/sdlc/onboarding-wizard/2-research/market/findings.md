# Market Research: Onboarding Wizard

**Date**: 2026-03-04
**Scope**: Competitive landscape, onboarding patterns, cloud-connect UX, conversion impact

---

## 1. Competitive Landscape: How Developer Tools Handle Onboarding

### Email/Communication APIs

**Resend** — The gold standard for developer email onboarding. Signup to first email in under 3 minutes. Key patterns:
- No domain verification required to start — users send from `onboarding@resend.dev` to their own email, giving an instant "aha moment" before any DNS setup.
- API key creation is the only gate before sending.
- Recently launched "AI Onboarding" — agent skills that auto-activate when AI coding tools encounter email tasks, letting agents produce working Resend code without manual config. This signals where DX is heading: zero-friction, AI-native onboarding.
- Dashboard is minimal by design. No checklist UI — the product is simple enough that the path is self-evident.

**Postmark** — Praised for the cleanest onboarding among legacy ESPs. Create account, verify domain, grab API key, send. Interactive API reference with copy-ready snippets in multiple languages. Video tutorials covering template creation and analytics. A junior developer can be trained entirely from their docs in under 3 hours. The simplicity is the onboarding.

**SendGrid** — Full guided setup wizard with explicit paths: API integration, SMTP relay, marketing templates, signup forms, automation. Step-by-step DNS instructions (SPF, DKIM), IP warmup guidance. More comprehensive but also more cluttered — the breadth of options creates decision fatigue. Demonstrates the tradeoff: more guidance vs. more overwhelm.

**Key takeaway for Wraps**: Resend and Postmark win because their products are simple enough that onboarding is lightweight. Wraps has inherently more complexity (AWS credentials, CLI install, infrastructure deployment, DNS verification) — so a guided wizard is not optional, it is essential. The complexity gap between "create account" and "send first email" is wider than any competitor.

### Platform/Infrastructure Tools

**Vercel** — Import-driven onboarding. After signup: connect Git provider, select repo, auto-detect framework, one-click deploy. The entire flow is 4 steps with sensible defaults at each. Preview URL generated immediately — instant gratification. No checklist needed because the happy path is a single linear flow.

**Supabase** — After signup, guides users through creating a Project (name, region, password). First project creation is the onboarding. Once created, the SQL Editor opens with placeholder commands to create a sample table — pushing users toward their first action. Production Checklist exists as a separate page for go-live readiness. Emphasizes "invisible infra" — you forget the database is there.

**Neon** — Minimal onboarding wizard during signup asks you to create a Project. Default branch "production" and database `neondb` are pre-created. SQL Editor includes placeholder commands on first open. Recently added one-command MCP setup for AI-assisted project onboarding (VS Code, Cursor, Claude Code). The trend is clear: reduce steps, pre-create defaults, let users interact immediately.

**Clerk** — After account creation, users land on an interactive authentication setup form. The dashboard creates the first application automatically. Quickstart guides are framework-specific (Next.js, React, Express) with copy-paste code blocks. Provides custom onboarding flow primitives (session tokens, metadata, middleware) so developers can build onboarding for their own users.

### Wraps-Relevant Insight

Every competitor above has one thing in common: **the product itself is hosted by the vendor**. Users never touch AWS, never install a CLI, never configure IAM. Wraps is unique in requiring users to deploy infrastructure to their own AWS account. This is the core value prop, but it is also the core onboarding challenge. No direct competitor has this exact problem — the closest analogues are infrastructure tools.

---

## 2. How "Connect Your Cloud Account" Products Handle Onboarding

This is the most relevant comparison for Wraps, since users must bridge the gap between the Wraps dashboard and their AWS account.

**SST Console** — Create a workspace, then connect AWS accounts. The connection mechanism: click a link that opens AWS Console to create a CloudFormation stack in `us-east-1`. The stack creates an IAM role and subscribes to SST apps across regions. After stack creation, apps/stages/functions appear in the console. Key pattern: **one-click CloudFormation launch** — the user does not manually create IAM roles or paste ARNs.

**Terraform Cloud** — Uses OIDC-based dynamic provider credentials. Setup: create a workspace, set `TFC_AWS_RUN_ROLE_ARN` as an environment variable. The OIDC flow (Terraform Cloud generates token, AWS STS verifies, returns temporary credentials) eliminates stored secrets. For initial setup, users either: (a) run a Terraform module that creates the IAM role, or (b) use the AWS Console to create the role with Terraform Cloud's account ID as trusted entity plus an external ID. More complex, targets experienced infrastructure engineers.

**Pulumi Cloud** — Recently added automated cloud setup in the onboarding flow: "Log in with your cloud credentials and let Pulumi Cloud handle the rest." Also supports CLI-based setup via `pulumi login`. The ESC (Environments, Secrets, Config) product has a dedicated OIDC provider onboarding wizard. Key insight: they offer both **automated (dashboard-driven)** and **manual (CLI-driven)** paths.

**Vantage (Cloud Cost)** — Offers four connection methods: CloudFormation (one-click), AWS CLI, Terraform module, and IAM Console (manual). Each is documented with exact steps. Giving users choice based on their comfort level reduces drop-off.

### Patterns for "Connect Your Cloud"

| Pattern | Used By | Friction Level |
|---|---|---|
| One-click CloudFormation stack | SST, Vantage | Low |
| OIDC trust + env var config | Terraform Cloud | Medium |
| Automated setup from dashboard | Pulumi ESC | Low |
| CLI-driven setup | Pulumi, Wraps (current) | Medium-High |
| Manual IAM role creation | Terraform Cloud (alt) | High |

**Recommendation for Wraps**: The current flow (install CLI, configure AWS, run `wraps email init`) is the highest-friction option. The wizard should at minimum: (1) detect when the CLI has completed each step by checking platform connection status, domain verification, etc., and (2) long-term, consider a one-click CloudFormation path as an alternative to the CLI for the infrastructure deployment step.

---

## 3. Patterns Shared by the Best Onboarding Experiences

### Universal Patterns

1. **Instant value before setup** — Resend lets you send before verifying a domain. Supabase pre-creates a database. Neon pre-creates a branch. Vercel deploys before custom domain. The pattern: let users experience the product before completing all configuration.

2. **3-5 steps maximum** — Research shows three-step onboarding flows achieve 72% completion; seven-step flows drop to 16%. The best products ruthlessly reduce steps. Wraps has ~7 steps (install Node, install CLI, AWS setup, deploy, DNS, sandbox, test send) — the wizard must group or hide steps to feel like fewer.

3. **Copy-paste code blocks** — Every successful developer onboarding includes exact commands to copy. Not "install the CLI" but `npm i -g @wraps.dev/cli` with a copy button.

4. **Auto-detection of completion** — The dashboard should know when a step is done without the user clicking "I did it." Vercel detects the deploy. Clerk detects the first auth. Wraps can detect: platform connection (DB record), domain verification (SES API), test email (event record).

5. **Progress persistence** — Users who leave and return should see their progress. Supabase and Clerk both maintain onboarding state. This is table stakes.

6. **Framework-specific quickstarts** — Clerk, Supabase, and Resend all offer quickstarts tailored to Next.js, React, Express, etc. rather than generic docs. Wraps should consider framework-specific "send your first email" examples.

7. **Dismissible for power users** — Advanced users who already know the product should be able to skip or dismiss the wizard. A "Skip setup guide" or "Mark as complete" option prevents annoyance.

### Emerging Patterns (2025-2026)

8. **AI-native onboarding** — Resend's agent skills, Neon's MCP setup, Pulumi's automated cloud connection. The trend is toward letting AI tools handle setup automatically. Wraps should consider: can `wraps email init` be triggered from an AI agent with appropriate guardrails?

9. **Interactive playgrounds** — Some tools (Postmark, SendGrid) offer in-dashboard API explorers. For Wraps, a "send test email" button in the dashboard (once infrastructure is deployed) would serve this role.

---

## 4. What Non-Technical Users Expect

Non-technical users encountering developer-oriented products expect:

1. **No assumed knowledge** — Terms like "IAM role," "SES sandbox," "DNS TXT record," and "CLI" are foreign. Each must be explained in plain language with visual aids. "Add this text to your domain settings" not "Create a TXT record in Route 53."

2. **Visual progress indicators** — Checklists with checkmarks, progress bars, step numbers. The psychological effect is significant: users feel momentum and are less likely to abandon.

3. **Estimated time per step** — "This step takes ~2 minutes" reduces anxiety. Research shows time estimates increase completion rates.

4. **Error recovery guidance** — When something fails, non-technical users need specific remediation ("Your AWS credentials expired. Run `aws sso login` to refresh them.") not generic errors ("Deployment failed").

5. **Video/GIF walkthroughs** — For complex steps like AWS account setup or DNS configuration, short screencasts outperform text instructions for non-technical audiences.

6. **Human fallback** — A "Need help?" link to support or community (Discord, Slack) at every step. Non-technical users will hit walls that technical users self-solve.

7. **No terminal required (ideally)** — The biggest friction point. Non-technical users dread the terminal. While Wraps cannot eliminate the CLI today (out of scope), the wizard should make terminal interactions as copy-paste-friendly as possible, with exact commands and expected output shown.

---

## 5. Pricing/Packaging Implications: Is Onboarding Quality a Differentiator?

### The Data

- **Activation is the #1 lever for PLG conversion.** Lifting activation from 40% to 60% can cut CAC by 33% without touching ad spend. (ProductLed)
- **40-60% of free trial users use the product once and never return.** For Wraps, this means users who create an org but never deploy are the majority — and they are recoverable with better onboarding. (Userpilot)
- **Users who complete onboarding are 5x more likely to convert** to paid. (Intercom)
- **Every extra minute in time-to-value lowers conversion by 3%.** Wraps' current time-to-first-email is measured in hours (install Node, install CLI, configure AWS, deploy, verify DNS, exit SES sandbox). Reducing perceived complexity — even if actual steps remain — directly impacts revenue. (Flowjam)
- **Interactive walkthroughs boost activation 30-75%** depending on complexity. (Various SaaS benchmarks)

### Strategic Implications for Wraps

1. **Onboarding IS the product for the first 30 minutes.** Users do not experience Wraps' value (cheap, owned infrastructure, great SDK) until after deployment. Everything before that is onboarding friction. The wizard is not a nice-to-have — it is the primary conversion mechanism.

2. **Wraps has higher onboarding friction than any competitor.** Resend: signup + API key + send (3 min). Wraps: signup + install Node + install CLI + AWS credentials + deploy + DNS + sandbox exit + send (30-60 min). The wizard must make this feel like 4-5 steps, not 7+.

3. **Onboarding quality justifies premium positioning.** Products with excellent onboarding (Vercel, Clerk, Resend) command higher prices and loyalty. Wraps' "deploy to your own AWS" model is powerful but complex — a polished wizard signals quality and trustworthiness.

4. **Reducing drop-off at the "connect AWS" step is the highest-ROI investment.** This is likely the single biggest abandonment point. Users who get past AWS setup and see their infrastructure deployed are highly likely to convert. The wizard should invest disproportionate effort here: pre-flight checks, clear error messages, and auto-detection of success.

5. **Consider onboarding as a segmentation signal.** Users who complete onboarding quickly are likely technical and self-serve. Users who stall are likely less technical and may need white-glove support, a CloudFormation alternative, or a managed offering. Tracking wizard progress per-user enables this segmentation.

---

## 6. Summary: Key Recommendations

| Finding | Implication for Wraps |
|---|---|
| Best onboarding flows are 3-5 steps | Group Wraps' ~7 steps into 3-4 logical phases (Prerequisites, Deploy, Configure, Verify) |
| Auto-detection beats manual confirmation | Use platform connection records, SES domain status, and event records to auto-check steps |
| "Connect your cloud" products use one-click CloudFormation | Consider CloudFormation as a future alternative to CLI-only deployment |
| Non-technical users need plain language + visuals | Write step instructions assuming zero AWS/CLI knowledge; add screencasts for complex steps |
| Activation is the #1 PLG conversion lever | Treat the wizard as the primary conversion mechanism, not a secondary feature |
| Copy-paste commands with expected output | Every CLI step should show the exact command and what success looks like |
| Progress must persist across sessions | Store onboarding state server-side (DB), not just client-side |
| Power users want to skip | Make wizard dismissible with a single click |
| AI-native onboarding is emerging | Prepare for AI agents completing setup steps (Resend skills, Neon MCP as precedent) |

---

## Sources

- [Resend - Email for developers](https://resend.com)
- [Resend AI Onboarding](https://resend.com/docs/ai-onboarding)
- [Resend - 1,000,000 users](https://resend.com/blog/1-million-users)
- [Postmark vs SendGrid Comparison](https://postmarkapp.com/compare/sendgrid-alternative)
- [SendGrid Email API Onboarding](https://sendgrid.com/en-us/blog/preparing-to-onboard-twilio-sendgrid-email-application)
- [Vercel - Getting Started](https://vercel.com/docs/getting-started-with-vercel)
- [Vercel - Improved Team Onboarding](https://vercel.com/changelog/improved-team-onboarding-experience)
- [Supabase - Getting Started](https://supabase.com/docs/guides/getting-started)
- [Supabase - Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Neon - DX Principles](https://neon.com/docs/get-started/dev-experience)
- [Neon - Learn the Basics](https://neon.com/docs/get-started/signing-up)
- [Clerk - Set Up Your Account](https://clerk.com/docs/getting-started/quickstart/setup-clerk)
- [SST Console](https://sst.dev/docs/console/)
- [Pulumi Cloud - Get Started](https://www.pulumi.com/docs/deployments/get-started/)
- [Pulumi Cloud - Onboarding Guide](https://www.pulumi.com/docs/pulumi-cloud/get-started/onboarding-guide/)
- [Pulumi ESC - New Onboarding and OIDC Experience](https://www.pulumi.com/blog/esc-new-onboarding/)
- [Terraform Cloud - Dynamic Provider Credentials on AWS](https://aws.amazon.com/blogs/apn/simplify-and-secure-terraform-workflows-on-aws-with-dynamic-provider-credentials/)
- [Vantage - Connect AWS](https://docs.vantage.sh/connecting_aws)
- [SaaS Onboarding Best Practices - ProductLed](https://productled.com/blog/5-best-practices-for-better-saas-user-onboarding)
- [SaaS Onboarding Best Practices - Flowjam](https://www.flowjam.com/blog/saas-onboarding-best-practices-2025-guide-checklist)
- [SaaS Onboarding Checklist - Omnius](https://www.omnius.so/blog/saas-onboarding-checklist)
- [SaaS Average Free Trial Conversion Rate - Userpilot](https://userpilot.com/blog/saas-average-conversion-rate/)
- [Product-Led Onboarding Tactics - Supademo](https://supademo.com/blog/customer-success/product-led-onboarding-tactics/)
- [Onboarding Wizard Examples - UserGuiding](https://userguiding.com/blog/what-is-an-onboarding-wizard-with-examples)
- [SaaS Onboarding Best Practices - Insaim Design](https://www.insaim.design/blog/saas-onboarding-best-practices-for-2025-examples)
