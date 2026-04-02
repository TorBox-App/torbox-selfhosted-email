# Wraps Pricing

> Last updated: March 2026

Wraps is a CLI, SDK, and dashboard that deploys email, SMS, and CDN infrastructure to your AWS account. You pay Wraps for the platform. You pay AWS directly for sending — at their published rates.

## How it works

Wraps charges a flat platform fee based on tracked events (sends, opens, clicks, deliveries, bounces). AWS sending costs are separate and go straight to your AWS bill at $0.10 per 1,000 emails.

You own the infrastructure. No vendor lock-in. Leave anytime and keep everything.

---

## Plans

| | Free | Starter | Growth | Scale |
|---|---|---|---|---|
| **Price** | $0/mo | $19/mo | $79/mo | $199/mo |
| **Annual** | — | $199/yr | $799/yr | $1,999/yr |
| **Tracked events** | 5,000/mo | 50,000/mo | 250,000/mo | 1,000,000/mo |
| **Overage** | Upgrade required | Upgrade required | $0.50/1K events | $0.15/1K events |
| **Contacts** | Unlimited | Unlimited | Unlimited | Unlimited |
| **Workflows** | 1 | Unlimited | Unlimited | Unlimited |
| **AI generations** | 10/mo | 50/mo | 250/mo | 1,000/mo |
| **AWS accounts** | 1 | 1 | 3 | Unlimited |
| **Team members** | 1 | Unlimited | Unlimited | Unlimited |
| **Support** | Community | Email | Priority (24hr) | Priority + SLA |

### Free

Get started with no credit card.

- Dashboard + AI template editor
- 5K tracked events/mo
- 1 workflow
- Unlimited contacts
- CLI + TypeScript SDK
- 10 AI template generations/mo

### Starter — $19/mo

For developers shipping their first integration.

- 50K tracked events/mo
- Unlimited workflows
- React templates + AI editor
- Topics, segments & broadcasts
- Unlimited team members
- Email support

### Growth — $79/mo

For teams where developers and marketers ship together.

- 250K tracked events/mo, then $0.50/1K
- AI workflow generation
- 3 AWS accounts
- Priority support (24hr)
- Everything in Starter

### Scale — $199/mo

For high-volume teams with multiple AWS accounts.

- 1M tracked events/mo, then $0.15/1K
- Behavioral segments
- 1K AI generations/mo
- Unlimited AWS accounts
- Priority support + SLA
- Everything in Growth

---

## AWS costs (paid directly to AWS)

| Service | Rate |
|---|---|
| SES email sending | $0.10 per 1,000 emails |
| SES dedicated IP | $24.95/mo per IP |
| SMS sending | Varies by country |
| S3 + CloudFront (CDN) | Standard AWS rates |

These costs appear on your AWS bill, not your Wraps bill. You get full AWS volume pricing and free tier benefits.

---

## Feature comparison

| Feature | Free | Starter | Growth | Scale |
|---|---|---|---|---|
| Dashboard + AI editor | Yes | Yes | Yes | Yes |
| CLI + TypeScript SDK | Yes | Yes | Yes | Yes |
| Batch sending | — | Yes | Yes | Yes |
| Topics & preferences | — | Yes | Yes | Yes |
| Segments & targeting | — | Yes | Yes | Yes |
| Campaigns | — | Yes | Yes | Yes |
| Cross-channel cascades | — | Yes | Yes | Yes |
| Event tracking | — | Yes | Yes | Yes |
| AI workflow generation | — | — | Yes | Yes |
| Behavioral segments | — | — | — | Yes |

---

## Annual billing

Save ~16% with annual billing (roughly 2 months free).

| Plan | Monthly | Annual | Monthly equiv. |
|---|---|---|---|
| Starter | $19/mo | $199/yr | ~$17/mo |
| Growth | $79/mo | $799/yr | ~$67/mo |
| Scale | $199/mo | $1,999/yr | ~$167/mo |

---

## Enterprise

Custom limits, on-prem deployment, dedicated support. [Contact us](https://wraps.dev/contact).

---

## Founding Member Program

First 50 customers get:

- Direct Slack access to the founder
- Input on roadmap priorities
- Your logo on our website
- Locked-in pricing for life

---

## Links

- Sign up: https://app.wraps.dev
- Docs: https://wraps.dev/docs
- CLI: `npx @wraps.dev/cli`
- Email SDK: `npm install @wraps.dev/email`
- SMS SDK: `npm install @wraps.dev/sms`
