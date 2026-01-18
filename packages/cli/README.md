# Wraps CLI

> Deploy email infrastructure (SES, DynamoDB, Lambda, EventBridge) to your AWS account.

## What It Creates

Running `wraps email init` deploys these AWS resources to your account:

- **IAM Role** with OIDC trust policy (for Vercel) or instance profile (for AWS-native)
- **SES Configuration Set** with event tracking rules
- **EventBridge Rule** to capture SES events
- **SQS Queue + Dead Letter Queue** for event buffering
- **Lambda Function** to process events and write to DynamoDB
- **DynamoDB Table** for email history storage

All resources are tagged with `ManagedBy: wraps-cli` and prefixed with `wraps-email-`.

## Features

- `--preview` flag shows what would be created without deploying
- OIDC federation for Vercel (no AWS credentials in your app)
- Never modifies existing AWS resources
- Stores deployment metadata locally in `~/.wraps/`

## Prerequisites

- **Node.js 20+**
- **AWS CLI** - Configured with valid credentials
  ```bash
  aws configure
  ```

**Note:** Pulumi CLI will be automatically installed on first run if not already present. You can also pre-install it manually:
```bash
# macOS
brew install pulumi/tap/pulumi

# Linux
curl -fsSL https://get.pulumi.com | sh

# Windows
choco install pulumi
```

## Installation

```bash
npm install -g @wraps.dev/cli
# or
pnpm add -g @wraps.dev/cli
# or use npx (no installation required)
npx @wraps.dev/cli init
```

## Quick Start

### 1. Deploy New Email Infrastructure

```bash
wraps email init
```

This will:
- ✅ Validate your AWS credentials
- ✅ Prompt for configuration preset (Starter, Production, Enterprise, or Custom)
- ✅ Show estimated monthly costs based on your volume
- ✅ Deploy infrastructure (IAM roles, SES, DynamoDB, Lambda, EventBridge, SQS)
- ✅ Display next steps with role ARN and DNS records

### 2. Install the SDK

After deploying, install the TypeScript SDK to send emails:

```bash
npm install @wraps.dev/email
# or
pnpm add @wraps.dev/email
```

**Send your first email:**

```typescript
import { Wraps } from '@wraps.dev/email';

const wraps = new Wraps();

await wraps.emails.send({
  from: 'hello@yourapp.com',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Hello from Wraps!</h1>',
});
```

Learn more: [SDK Documentation](https://github.com/wraps-team/wraps-js) | [npm](https://www.npmjs.com/package/@wraps.dev/email)

### 3. Check Status

```bash
wraps status
```

Shows:
- Active features and configuration across all services
- AWS region and account
- Verified domains
- Deployed resources
- Links to dashboard

## Global Options

These options work across all deployment commands:

| Option | Description |
|--------|-------------|
| `-p, --provider` | Hosting provider (vercel, aws, railway, other) |
| `-r, --region` | AWS region |
| `-d, --domain` | Domain name |
| `--preset` | Configuration preset |
| `-y, --yes` | Skip confirmation prompts |
| `-f, --force` | Force destructive operations |
| `--preview` | Preview changes without deploying |

### Preview Mode

Use `--preview` to see what infrastructure changes would be made without actually deploying. This is useful for:

- **Reviewing changes** before applying them
- **Cost estimation** - see estimated monthly costs
- **CI/CD pipelines** - validate deployments in dry-run mode

```bash
# Preview new deployment
wraps email init --preview

# Preview upgrade changes
wraps email upgrade --preview

# Preview what would be destroyed
wraps destroy --preview
```

**Example output:**

```
--- PREVIEW MODE (no changes will be made) ---

Resource Changes:
  + 8 to create

Estimated Monthly Cost:
  ~$2.50/mo (based on 10,000 emails/month)

--- END PREVIEW (no changes were made) ---

Preview complete. Run without --preview to deploy.
```

## Commands

### Email Commands

#### `wraps email init`

Deploy new email infrastructure to your AWS account.

**Options:**
- `-p, --provider <provider>` - Hosting provider (vercel, aws, railway, other)
- `-r, --region <region>` - AWS region (default: us-east-1)
- `-d, --domain <domain>` - Domain to verify (optional)
- `--preset <preset>` - Configuration preset (starter, production, enterprise, custom)
- `-y, --yes` - Skip confirmation prompts
- `--preview` - Preview changes without deploying

**Examples:**

```bash
# Interactive mode (recommended)
wraps email init

# Preview what would be deployed (no changes made)
wraps email init --preview

# With flags
wraps email init --provider vercel --region us-east-1 --domain myapp.com --preset production
```

#### `wraps email connect`

Connect to existing AWS SES infrastructure and add Wraps features.

**Example:**

```bash
wraps email connect
```

#### `wraps email domains`

Manage SES domains (add, list, verify, get DKIM tokens, remove).

##### `wraps email domains add`

Add a new domain to SES with DKIM signing.

**Options:**
- `-d, --domain <domain>` - Domain to add

**Example:**

```bash
wraps email domains add --domain myapp.com
```

##### `wraps email domains list`

List all SES domains with verification status.

**Example:**

```bash
wraps email domains list
```

##### `wraps email domains get-dkim`

Get DKIM tokens for a domain (for DNS configuration).

**Options:**
- `-d, --domain <domain>` - Domain to get DKIM tokens for

**Example:**

```bash
wraps email domains get-dkim --domain myapp.com
```

##### `wraps email domains verify`

Verify domain DNS records (DKIM, SPF, DMARC, MX).

**Options:**
- `-d, --domain <domain>` - Domain to verify

**Example:**

```bash
wraps email domains verify --domain myapp.com
```

##### `wraps email domains remove`

Remove a domain from SES.

**Options:**
- `-d, --domain <domain>` - Domain to remove
- `-f, --force` - Skip confirmation prompt

**Example:**

```bash
wraps email domains remove --domain myapp.com
wraps email domains remove --domain myapp.com --force  # Skip confirmation
```

#### `wraps email upgrade`

Add features to existing infrastructure incrementally without redeployment.

**Options:**
- `-r, --region <region>` - AWS region (uses saved connection if not specified)
- `-y, --yes` - Skip confirmation prompts
- `--preview` - Preview changes without deploying

**Example:**

```bash
wraps email upgrade

# Preview upgrade changes before applying
wraps email upgrade --preview
```

Interactive wizard allows you to add:

**Configuration Presets:**
- Upgrade to a higher preset (Starter → Production → Enterprise)
- Each preset includes additional features with transparent cost estimates

**Domain Configuration:**
- **MAIL FROM Domain** - Custom MAIL FROM domain for better DMARC alignment
  - Default: `mail.{yourdomain.com}`
  - Requires MX and SPF DNS records
  - Improves email deliverability and sender reputation

- **Custom Tracking Domain** - Branded tracking domain for opens/clicks
  - Use your own domain instead of AWS default (`r.{region}.awstrack.me`)
  - Requires single CNAME DNS record
  - Improves email appearance and trust
  - **Note:** Currently uses HTTP (not HTTPS). CloudFront + SSL support coming in v1.1.0

**Event Tracking:**
- Customize tracked SES event types (SEND, DELIVERY, OPEN, CLICK, BOUNCE, COMPLAINT, etc.)
- Select specific events to reduce processing costs
- Full control over what gets stored in DynamoDB

**Email History:**
- Change retention period (7 days, 30 days, 90 days, 1 year)
- Adjust based on compliance requirements
- Transparent DynamoDB storage cost updates

**Advanced Features:**
- **Dedicated IP Address** - Reserved IP for high-volume sending
  - Improves sender reputation control
  - Required for 50,000+ emails/day
  - Additional AWS charges apply (~$24.95/month)

- **SMTP Credentials** - Generate SMTP username/password for legacy systems
  - Works with PHP mail(), PHPMailer, WordPress, Nodemailer, and any SMTP client
  - Creates IAM user with `ses:SendRawEmail` permission (scoped to your config set)
  - Credentials shown once after creation - save them immediately!
  - Supports rotation (invalidates old credentials) and disabling
  - No additional AWS charges (uses existing SES pricing)

  **SMTP Connection Details:**
  ```
  Server:     email-smtp.{region}.amazonaws.com
  Port:       587 (STARTTLS) or 465 (TLS)
  Encryption: TLS/STARTTLS required
  ```

  **Example - WordPress (WP Mail SMTP plugin):**
  ```
  SMTP Host:     email-smtp.us-east-1.amazonaws.com
  SMTP Port:     587
  Encryption:    TLS
  SMTP Username: (from wraps email upgrade)
  SMTP Password: (from wraps email upgrade)
  ```

  **Example - Nodemailer:**
  ```javascript
  const transporter = nodemailer.createTransport({
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  ```

#### `wraps email restore`

Restore infrastructure from saved metadata.

**Options:**
- `-r, --region <region>` - AWS region to restore from
- `-f, --force` - Force restore without confirmation (destructive)
- `--preview` - Preview what would be removed without making changes

**Example:**

```bash
wraps email restore
wraps email restore --preview  # Preview what would be removed
wraps email restore --region us-west-2 --force  # Skip confirmation
```

### Global Commands

These commands work across all services (email, SMS when available):

#### `wraps status`

Show infrastructure status across all services.

**Options:**
- `--account <account>` - Filter by AWS account ID or alias

**Example:**

```bash
wraps status
```

Shows:
- Active services and their configurations
- AWS region and account
- Verified domains
- Deployed resources
- Links to dashboard

#### `wraps console`

Launch local web console for monitoring all services.

**Options:**
- `--port <port>` - Port to run console on (default: 5555)
- `--no-open` - Don't automatically open browser

**Example:**

```bash
wraps console
wraps console --port 3000 --no-open
```

Opens at `http://localhost:5555` with real-time tracking for email activity, delivery rates, bounces, complaints, and more.

**Note:** The `wraps dashboard` command is deprecated. Use `wraps console` instead.

#### `wraps destroy`

Remove all deployed infrastructure across all services.

**Options:**
- `-f, --force` - Force destroy without confirmation (destructive)
- `--preview` - Preview what would be destroyed without making changes

**Example:**

```bash
wraps destroy
wraps destroy --preview  # Preview what would be destroyed
wraps destroy --force  # Skip confirmation
```

#### `wraps completion`

Generate shell completion script.

**Example:**

```bash
wraps completion
```

### Legacy Commands (Deprecated)

For backwards compatibility, these commands still work but show deprecation warnings:

```bash
wraps init      # → Use 'wraps email init'
wraps connect   # → Use 'wraps email connect'
wraps verify    # → Use 'wraps email domains verify'
wraps upgrade   # → Use 'wraps email upgrade'
```

**Note:** `status`, `dashboard`, and `destroy` are now global commands that work across all services.

## Configuration Presets

The CLI offers four presets that control which AWS resources are created:

### Starter (~$0.05/mo)
- SES configuration set with open/click tracking
- Suppression list for bounces/complaints
- No event storage (events are tracked but not persisted)

### Production (~$2-5/mo)
- Everything in Starter
- EventBridge → SQS → Lambda pipeline
- DynamoDB table with 90-day TTL
- Tracks: SEND, DELIVERY, OPEN, CLICK, BOUNCE, COMPLAINT

### Enterprise (~$50-100/mo)
- Everything in Production
- Dedicated IP address ($24.95/mo from AWS)
- 1-year DynamoDB TTL
- All 10 SES event types (adds REJECT, RENDERING_FAILURE, DELIVERY_DELAY, SUBSCRIPTION)

### Custom
Select individual features. Useful if you want event storage without a dedicated IP, or specific event types only.

## Hosting Provider Integration

### Vercel

Uses OIDC federation - your Vercel deployment assumes an IAM role directly, no AWS credentials stored:

```bash
wraps init --provider vercel
```

You'll be prompted for:
- Vercel team slug
- Vercel project name

### AWS Native

For Lambda, ECS, or EC2 deployments - uses IAM roles automatically:

```bash
wraps init --provider aws
```

### Other Providers

For Railway, Render, or other platforms:

```bash
wraps init --provider other
```

Note: Will require AWS access keys as environment variables.

## Development

### Prerequisites

- Node.js 20+
- pnpm
- AWS CLI configured with valid credentials

### Local Development

```bash
# Install dependencies
pnpm install

# Build CLI
pnpm build

# Test locally
node dist/cli.js init

# Watch mode (for development)
pnpm dev
```

### Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Type checking
pnpm typecheck
```

## Project Structure

```
packages/cli/
├── src/
│   ├── cli.ts                    # Entry point (multi-service router)
│   ├── commands/                 # CLI commands
│   │   ├── email/                # Email service commands
│   │   │   ├── init.ts          # Deploy email infrastructure
│   │   │   ├── connect.ts       # Connect existing SES
│   │   │   ├── console.ts       # Email dashboard
│   │   │   ├── status.ts        # Show email setup
│   │   │   ├── verify.ts        # DNS verification
│   │   │   ├── upgrade.ts       # Add email features
│   │   │   ├── restore.ts       # Restore from metadata
│   │   │   └── destroy.ts       # Remove email infrastructure
│   │   ├── sms/                  # SMS service commands (coming soon)
│   │   ├── init.ts              # Legacy command (deprecated)
│   │   ├── status.ts            # Legacy command (deprecated)
│   │   └── ...                   # Other legacy commands
│   ├── infrastructure/           # Pulumi stacks
│   │   ├── email-stack.ts       # Email infrastructure stack
│   │   ├── vercel-oidc.ts       # Vercel OIDC provider setup
│   │   └── resources/           # Resource definitions
│   │       ├── iam.ts           # IAM roles and policies
│   │       ├── ses.ts           # SES configuration
│   │       ├── dynamodb.ts      # Email history storage
│   │       ├── lambda.ts        # Event processing
│   │       ├── sqs.ts           # Event queues + DLQ
│   │       └── eventbridge.ts   # SES event routing
│   ├── console/                  # Web dashboard (React)
│   ├── lambda/                   # Lambda function source
│   │   └── event-processor/     # SQS → DynamoDB processor
│   ├── utils/                    # Utilities
│   │   ├── shared/              # Shared utilities
│   │   │   ├── aws.ts           # AWS SDK helpers
│   │   │   ├── prompts.ts       # Interactive prompts
│   │   │   ├── metadata.ts      # Multi-service metadata
│   │   │   ├── errors.ts        # Error handling
│   │   │   ├── output.ts        # Console formatting
│   │   │   ├── fs.ts            # File system helpers
│   │   │   └── pulumi.ts        # Pulumi utilities
│   │   └── email/               # Email-specific utilities
│   │       ├── costs.ts         # Cost calculations
│   │       ├── presets.ts       # Config presets
│   │       └── route53.ts       # DNS helpers
│   └── types/
│       ├── index.ts             # Type exports with backwards compat
│       ├── shared.ts            # Shared types
│       ├── email.ts             # Email-specific types
│       └── sms.ts               # SMS-specific types
├── lambda/                       # Lambda source (bundled to dist)
└── dist/                         # Build output
    ├── console/                  # Built dashboard
    └── lambda/                   # Lambda source for deployment
```

## Troubleshooting

### AWS Credentials Not Found

```bash
# Configure AWS CLI
aws configure

# Or set environment variables
export AWS_PROFILE=your-profile
```

### Invalid Region

Make sure you're using a valid AWS region:
- `us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`
- `eu-west-1`, `eu-west-2`, `eu-central-1`
- `ap-southeast-1`, `ap-southeast-2`, `ap-northeast-1`

### Stack Already Exists

If you've already deployed infrastructure:

```bash
# Check status
wraps status

# To redeploy, destroy the existing stack first
wraps destroy
wraps init
```

## What's Included

### Global Commands ✅
- [x] `wraps status` - Show infrastructure status (all services)
- [x] `wraps console` - Local web console (all services)
- [x] `wraps destroy` - Remove all infrastructure (all services)
- [x] `wraps completion` - Shell completion

### Dashboard Commands ✅
- [x] `wraps dashboard update-role` - Update platform IAM permissions

### Email Commands ✅
- [x] `wraps email init` - Deploy new infrastructure
- [x] `wraps email connect` - Connect existing SES
- [x] `wraps email domains` - Domain management
  - [x] `wraps email domains add` - Add domain to SES
  - [x] `wraps email domains list` - List all domains
  - [x] `wraps email domains get-dkim` - Get DKIM tokens
  - [x] `wraps email domains verify` - Verify DNS records
  - [x] `wraps email domains remove` - Remove domain
- [x] `wraps email upgrade` - Incrementally add features:
  - Configuration preset upgrades (Starter → Production → Enterprise)
  - MAIL FROM domain for DMARC alignment
  - Custom tracking domain for branded links
  - Event type customization
  - Email history retention periods
  - Dedicated IP addresses
- [x] `wraps email restore` - Restore from metadata

### SMS Commands 🚧 (Coming Soon)
- [ ] `wraps sms init` - Deploy SMS infrastructure

### Features ✅
- [x] Preview mode (`--preview`) for all deployment commands
- [x] Configuration presets (Starter, Production, Enterprise, Custom)
- [x] Cost estimation based on AWS pricing
- [x] MAIL FROM domain configuration for DMARC alignment
- [x] Custom tracking domain (HTTP, HTTPS coming in v1.1.0)
- [x] Configurable event types (10 SES event types available)
- [x] Configurable email history retention (7 days to 1 year TTL)
- [x] Dedicated IP address provisioning
- [x] Lambda bundling with esbuild
- [x] Vercel OIDC integration
- [x] Event pipeline: EventBridge → SQS → Lambda → DynamoDB
- [x] Domain management (add, list, verify, remove)
- [x] Suppression list for bounces/complaints
- [x] Non-destructive (never modifies existing resources)
- [x] Built with @clack/prompts

### Coming Soon

#### v1.1.0 - Q1 2025
- [ ] **HTTPS Custom Tracking Domains**
  - [ ] Automatic CloudFront distribution creation
  - [ ] ACM certificate provisioning and validation
  - [ ] HTTPS enforcement for tracking links
  - [ ] Seamless upgrade path from HTTP tracking domains

#### Future Releases
- [ ] **SMS Service** (`wraps sms`)
  - [ ] AWS End User Messaging integration
  - [ ] Multi-channel communication support

- [ ] **Hosted App**
  - [ ] Advanced analytics dashboard
  - [ ] Email templates
  - [ ] Bulk sending tools
  - [ ] Tenant management

## License

AGPLv3

## Support

- Documentation: https://wraps.dev/docs
- Issues: https://github.com/wraps-team/wraps/issues
- Dashboard: https://app.wraps.dev
