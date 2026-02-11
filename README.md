<p align="center">
  <a href="https://wraps.dev">
    <img src="https://wraps.dev/wraps-dark-logo.png" alt="Wraps" width="200" />
  </a>
</p>

<p align="center">
  <strong>Deploy email infrastructure to your AWS account in under 2 minutes.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@wraps.dev/cli"><img src="https://img.shields.io/npm/v/@wraps.dev/cli?label=CLI&color=blue" alt="CLI version" /></a>
  <a href="https://www.npmjs.com/package/@wraps.dev/email"><img src="https://img.shields.io/npm/v/@wraps.dev/email?label=SDK&color=blue" alt="SDK version" /></a>
  <a href="https://github.com/wraps-team/wraps/actions/workflows/test.yml"><img src="https://github.com/wraps-team/wraps/actions/workflows/test.yml/badge.svg" alt="Tests" /></a>
  <a href="https://github.com/wraps-team/wraps/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-green" alt="License" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
</p>

<!--<p align="center">
  <img src="https://wraps.dev/cli/wraps-cli.gif" alt="Wraps CLI" width="600" />
</p>-->

---

## Quick Start

**Prerequisites:** Node.js 20+, AWS credentials configured

```bash
# Deploy email infrastructure to your AWS account
npx @wraps.dev/cli email init
```

```bash
# Install the SDK
pnpm add @wraps.dev/email
```

```typescript
import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail();

const { messageId } = await email.send({
  from: 'hello@yourapp.com',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Hello from Wraps!</h1>',
});

console.log('Sent:', messageId);
```

## Why Wraps?

- **You own it** — Infrastructure deploys to your AWS account. Data never leaves your cloud. If we disappeared tomorrow, your email keeps working.
- **2-minute setup** — One CLI command. No AWS console spelunking. No 1000-word sandbox approval essays.
- **AWS pricing** — Pay AWS directly for sending. No middleman markup. Scale affordably.
- **Real DX** — TypeScript SDK, visual templates, real-time analytics, interactive dashboard.

## What Gets Deployed

One command creates all of this in your AWS account:

- **SES** — Domain verification, DKIM, SPF, DMARC
- **EventBridge + SQS** — Real-time event tracking (bounces, opens, clicks, deliveries)
- **DynamoDB** — Email event history with configurable retention
- **Lambda** — Event processing and webhook handling
- **IAM** — Least-privilege roles with OIDC support (Vercel, AWS native)

All resources are namespaced with `wraps-email-*` and tagged `ManagedBy: wraps-cli`.

## Also Available

| Service | CLI | SDK |
|---------|-----|-----|
| **SMS** | `wraps sms init` | [`@wraps.dev/sms`](https://www.npmjs.com/package/@wraps.dev/sms) |
| **CDK** | — | [`@wraps.dev/cdk`](https://www.npmjs.com/package/@wraps.dev/cdk) |
| **Pulumi** | — | [`@wraps.dev/pulumi`](https://www.npmjs.com/package/@wraps.dev/pulumi) |

## Documentation

| Resource | Link |
|----------|------|
| Quickstart | [wraps.dev/docs/quickstart](https://wraps.dev/docs/quickstart) |
| CLI Reference | [wraps.dev/docs/cli-reference](https://wraps.dev/docs/cli-reference) |
| SDK Reference | [wraps.dev/docs/sdk-reference](https://wraps.dev/docs/sdk-reference) |
| Guides | [wraps.dev/docs/guides](https://wraps.dev/docs/guides) |
| Infrastructure | [wraps.dev/docs/infrastructure](https://wraps.dev/docs/infrastructure) |

## Community

- [GitHub Issues](https://github.com/wraps-team/wraps/issues) — Bug reports and feature requests
- [GitHub Discussions](https://github.com/wraps-team/wraps/discussions) — Questions and ideas
- [Contributing](CONTRIBUTING.md) — Development setup and guidelines

## License

AGPL-3.0 — see [LICENSE](LICENSE) for details. Enterprise features under commercial license. See [wraps.dev](https://wraps.dev) for more information.
