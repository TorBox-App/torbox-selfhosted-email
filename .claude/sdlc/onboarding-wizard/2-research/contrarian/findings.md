# Contrarian Analysis: Onboarding Wizard

## 1. Why This Feature Might Fail or Be Wasted Effort

**The wizard solves a symptom, not the disease.** The stated problem is that users drop off after org creation because the path to "first email sent" is unclear and intimidating. But a wizard that walks users through installing Node.js, configuring AWS credentials, running CLI commands, and managing DNS records does not make those steps less intimidating — it just narrates them. The complexity is inherent in the "deploy to your own AWS account" model. A step-by-step guide through a minefield is still a walk through a minefield.

**Non-technical users do not want to manage AWS infrastructure.** The idea explicitly targets "non-technical users" but the entire value proposition requires them to have an AWS account, configure IAM credentials, understand DNS propagation, and run terminal commands. No wizard changes the fact that these are fundamentally technical tasks. The target audience for "I want to own my own infrastructure" and the target audience for "I need a wizard to install Node.js" are nearly disjoint sets.

**The real drop-off cause may not be confusion.** Users who create an org and then leave might be:
- Evaluating the product and deciding the self-hosted model is not for them
- Hitting the AWS credential/account barrier and deciding it is not worth the effort
- Comparing against SendGrid/Resend/Postmark and choosing a hosted alternative
- Creating an account out of curiosity with no real intent to deploy

A wizard addresses none of these. If the problem is "this is too much work for what I get," making the work more visible does not help.

## 2. Assumptions That Could Be Wrong

**"Users drop off after org creation" — is this validated?** The idea presents this as fact but does not cite data. Key questions:
- What percentage of users who create an org never run `wraps email init`?
- Of those, how many never even install the CLI?
- Have any been surveyed about why they stopped?
- Is the sample size large enough to draw conclusions?

Without this data, the wizard is a guess. It could be that 90% of drop-offs happen before org creation (landing page or pricing objections), making post-org-creation improvements low-leverage.

**"A wizard will help non-technical users with AWS setup" — has this ever worked?** AWS's own console is essentially one giant wizard, and it is notoriously confusing. Heroku succeeded not by adding a wizard to AWS but by removing AWS entirely. The history of developer tools strongly suggests that wizards for infrastructure configuration have a poor track record. Users either know what they are doing (and find wizards patronizing) or do not (and get stuck anyway, just inside the wizard instead of outside it).

**"Step-by-step guidance is enough" — or do users need someone to do it for them?** The idea assumes the gap is informational ("users don't know the steps"). But the gap might be motivational ("this is too many steps") or capability-based ("I cannot do these steps"). Guidance only closes informational gaps.

**"Supplements the CLI — doesn't replace it."** If the wizard cannot actually perform actions and only tells users what to type in a terminal, it is a glorified documentation page embedded in the dashboard. The question is whether this is meaningfully better than a well-written getting-started guide, and whether the engineering investment is justified over improving the existing docs.

## 3. Hidden Risks

**Maintenance burden is severe.** The wizard must stay synchronized with:
- CLI command syntax and flags (which change with releases)
- AWS console UI (which changes without notice)
- DNS provider interfaces (dozens of providers, each with different UIs)
- Node.js installation methods (nvm, fnm, mise, Homebrew, direct download)
- SES sandbox exit process (which AWS has changed multiple times)
- The platform connect flow and its error states

Every CLI change potentially breaks wizard instructions. This creates a coupling that slows down CLI development or causes the wizard to give wrong instructions — both bad outcomes.

**Stale instructions are worse than no instructions.** A user following an outdated wizard step that tells them to click a button that no longer exists in the AWS console will lose more trust than a user reading generic docs. The wizard creates an implicit promise of accuracy that is expensive to maintain.

**False completion detection.** The idea mentions "auto-detection of completed steps." This is fragile:
- A platform connection record exists but the IAM role has been deleted
- DNS records are set but propagation is incomplete
- SES domain is verified but still in sandbox
- CLI is installed but an outdated version

Showing a green checkmark when something is actually broken creates false confidence, and debugging "the wizard said it was done" is harder than debugging "I don't know if it's done."

**Detection requires API surface area.** Checking step completion from the dashboard means the API needs endpoints to verify CLI installation status, AWS resource state, DNS propagation, and SES configuration — all things that currently live in the CLI's local context. This either requires new API infrastructure or requires the CLI to report status back to the platform, adding complexity to both sides.

## 4. Alternative Approaches That Might Be Simpler or Better

**Concierge onboarding.** For the first 50-100 users, offer a 15-minute screenshare where a team member walks them through setup. This:
- Costs almost nothing at current scale
- Provides direct customer feedback on where they actually get stuck
- Builds relationships that drive retention and referrals
- Gives you real data on whether a wizard would even help
- Can start tomorrow with zero engineering effort

This is the "Demo -> Sell -> Build" principle applied to onboarding.

**CloudFormation / one-click deploy.** A single "Deploy to AWS" button that creates the IAM role, SES configuration, and event pipeline via CloudFormation eliminates 80% of the wizard's steps. The user clicks a link, logs into AWS, clicks "Create Stack," and the infrastructure exists. This directly reduces complexity instead of narrating it. (Note: the idea explicitly marks "Full CloudFormation parity" as out of scope, but this is arguably the highest-impact thing to build.)

**Better CLI error messages and recovery.** If users are getting stuck during CLI setup, improving the CLI's error handling, suggestions, and self-diagnosis (`wraps doctor`) might solve the problem at the source. The CLI already knows the user's state — it can guide them through what is wrong and how to fix it without a separate dashboard wizard.

**A single getting-started video.** A 5-minute Loom showing the entire flow from org creation to first email sent. Costs one afternoon to produce, requires zero engineering, and can be updated in 30 minutes when the flow changes. Embed it on the post-org-creation page.

**Hosted sandbox environment.** Let users send their first 100 emails through Wraps-hosted infrastructure with zero setup. Once they see the value, they are motivated to do the AWS setup to get full ownership and lower pricing. This solves the "too much work before I see any value" problem directly.

## 5. What Could Go Wrong During Implementation

**Scope creep is nearly guaranteed.** The wizard touches org creation, CLI installation, AWS setup, infrastructure deployment, DNS configuration, SES sandbox, and test emails. Each step has edge cases:
- What if they are on Windows? Linux? What shell?
- What if they use AWS SSO instead of IAM credentials?
- What if they have multiple AWS accounts?
- What if their domain is on Route 53 vs Cloudflare vs GoDaddy vs Namecheap?
- What if SES is not available in their region?

Handling these properly turns a "simple wizard" into a matrix of conditional paths.

**Detection reliability will consume engineering time.** Getting step detection right — especially across the dashboard/CLI boundary — requires building and maintaining a status synchronization system. False negatives ("step shows incomplete but I already did it") will generate support tickets. False positives ("step shows complete but it's broken") will generate harder-to-debug support tickets.

**The wizard becomes the bottleneck for CLI changes.** Every time you add a flag, change a command name, or modify the deployment flow, someone has to update the wizard. If the wizard is not updated, users get wrong instructions. If the wizard blocks CLI releases, development velocity drops. This coupling is insidious because it is not visible until it causes pain.

**Design and copy quality matters enormously.** A poorly written wizard with vague instructions or confusing UI is worse than no wizard. Getting the copy right for each step, for each edge case, for each user skill level, is a significant design and writing effort that is easy to underestimate.

## 6. Is This the Highest-Leverage Thing to Build Right Now?

**Acquisition vs. activation.** Before optimizing the post-signup funnel, the question is whether enough people are signing up in the first place. If the problem is that 100 people visit the site and 5 sign up, improving the experience for those 5 is less impactful than improving the landing page to get 15 signups. Where is the bottleneck?

**Value proposition clarity.** "Deploy email infrastructure to your own AWS account" requires the user to already understand why that matters. If they do not — and most non-technical users will not — no wizard helps. The landing page, pricing comparison, and positioning might be higher-leverage investments.

**The CloudFormation path is higher leverage.** The idea scopes out CloudFormation parity, but this is arguably the single change that would most reduce onboarding friction. One-click infrastructure deployment eliminates the need for Node.js, CLI installation, and manual AWS configuration. The wizard is a band-aid; CloudFormation (or a hosted deploy button) is the fix.

**The concierge approach generates data the wizard needs.** Building a wizard without deeply understanding where users actually get stuck is building blind. Doing 20 concierge onboardings first would reveal whether users need a wizard, a simpler deployment method, better docs, or something else entirely. Build the wizard after you have this data, not before.

**Revenue impact is unclear.** How many users are stuck at the post-org-creation stage? Of those, how many would convert to paying if they completed setup? If the answer is "a handful," the engineering time is better spent on features that retain and expand existing paying users.

## Summary

The onboarding wizard addresses a real pain point — the gap between org creation and first email — but does so in a way that narrates complexity rather than removing it. The highest-risk assumptions are: (1) that the drop-off is caused by confusion rather than inherent complexity or weak motivation, (2) that non-technical users are the right audience for a self-hosted infrastructure product, and (3) that a wizard is the right format rather than concierge support, one-click deployment, or a hosted sandbox.

Before building this, validate with data:
1. How many users actually get stuck at each step? (Instrument the funnel.)
2. Why do they stop? (Ask them — email survey, exit interview, concierge calls.)
3. Would they complete setup if guided by a human? (Concierge test.)

If the answer to #3 is yes, build the wizard. If the answer is "no, they just don't want to deal with AWS," build CloudFormation one-click or a hosted option instead.
