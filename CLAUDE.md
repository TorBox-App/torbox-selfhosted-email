# CLAUDE.md - Wraps Project Context

## Workflow

Before modifying any code, read all relevant files and understand the full execution flow first. Do not start making changes while still exploring the codebase. If the task is complex, use a Task agent to explore the codebase before writing any code.

## Error Handling

When implementing new features that involve external API calls (e.g., AWS SDK, Vercel API), always wrap each API call with specific error handling that distinguishes between different error types (e.g., NotFound vs CredentialsError vs PermissionDenied). Never use generic catch-all error messages.

When implementing multi-step features (e.g., create resource → save state → use resource), ensure each step's side effects are persisted before proceeding to the next step. Specifically: save all critical state (IDs, external references) immediately after creation, before any subsequent operations that might fail.

## Project Overview

**Wraps** is a CLI tool, web platform, and TypeScript SDK that deploys communication infrastructure (email via AWS SES, SMS via AWS End User Messaging, CDN via S3+CloudFront) to users' AWS accounts with zero stored credentials, beautiful developer experience, and AWS pricing.

**Core Value Proposition**: One command deploys production-ready infrastructure to the user's AWS account with zero credentials stored, intuitive SDK, beautiful DX, and transparent AWS pricing.

**TypeScript SDKs**:
- [`@wraps.dev/email`](https://github.com/wraps-team/wraps-js) - Send emails through deployed SES infrastructure
- `@wraps.dev/sms` - Send SMS through deployed AWS End User Messaging infrastructure

## Key Concepts

### The Wraps Model
- Deploy infrastructure **to the user's AWS account** (not ours)
- Users own their infrastructure and data
- They pay AWS directly at transparent pricing ($0.10 per 1,000 emails)
- We provide tooling, dashboard, and great DX
- No vendor lock-in (infrastructure stays if they churn)

## Architecture

### Tech Stack
```json
{
  "monorepo": "turborepo",
  "cli": {
    "args": "args",
    "prompts": "@clack/prompts",
    "colors": "picocolors",
    "completion": "tabtab",
    "bundler": "tsup"
  },
  "infrastructure": "@pulumi/pulumi + @pulumi/aws",
  "deployment": "sst (Serverless Stack)",
  "aws": "@aws-sdk/client-*",
  "web": {
    "framework": "Next.js 16 (App Router, Turbopack)",
    "react": "React 19",
    "styling": "tailwindcss 4.x + shadcn/ui",
    "components": "radix-ui",
    "forms": "@tanstack/react-form + zod",
    "state": "zustand",
    "data": "@tanstack/react-query",
    "editor": "TipTap (email templates)",
    "workflow": "@xyflow/react (workflow builder)"
  },
  "api": {
    "framework": "Elysia.js",
    "runtime": "AWS Lambda (via SST)",
    "auth": "better-auth (passkey + Stripe)"
  },
  "database": {
    "orm": "drizzle-orm",
    "provider": "@neondatabase/serverless (PostgreSQL)",
    "migrations": "drizzle-kit"
  },
  "runtime": "Node.js 20+",
  "language": "TypeScript (strict mode)",
  "packageManager": "pnpm 10",
  "linting": "ultracite + biome",
  "testing": "vitest"
}
```

### Project Structure
```
wraps/                            # Monorepo root
├── apps/
│   ├── api/                     # API server (Elysia.js on Lambda)
│   │   └── src/
│   │       ├── index.ts         # Elysia app entry point
│   │       ├── lambda.ts        # Lambda handler
│   │       ├── routes/          # API route handlers
│   │       ├── middleware/       # Auth middleware
│   │       ├── services/        # Business logic (workflow events, etc.)
│   │       └── (ee)/            # Enterprise edition features
│   ├── web/                     # Dashboard app (Next.js 16)
│   │   └── src/
│   │       ├── app/             # Next.js App Router
│   │       │   ├── (auth)/      # Auth pages
│   │       │   ├── (dashboard)/ # Dashboard pages
│   │       │   ├── (onboarding)/ # Onboarding flow
│   │       │   ├── (public)/    # Public pages (preferences, unsubscribe)
│   │       │   ├── (subscription)/ # Billing pages
│   │       │   └── api/         # Next.js API routes
│   │       ├── actions/         # Server actions
│   │       ├── components/
│   │       │   ├── (ee)/        # Enterprise components
│   │       │   │   └── workflow-builder/ # React Flow workflow canvas
│   │       │   ├── template-editor/     # TipTap email template editor
│   │       │   └── ui/          # shadcn/ui components
│   │       ├── hooks/           # Custom hooks
│   │       └── lib/             # Utilities
│   └── website/                 # Marketing website (Next.js 16)
│       └── src/
│           ├── app/             # Pages + docs
│           └── components/      # Marketing components
├── packages/
│   ├── auth/                    # Auth config (better-auth + Stripe webhooks)
│   ├── cli/                     # CLI package (@wraps.dev/cli)
│   │   ├── src/
│   │   │   ├── cli.ts           # Entry point (multi-service router)
│   │   │   ├── commands/        # CLI commands
│   │   │   │   ├── auth/        # Auth commands (login, logout, status)
│   │   │   │   ├── aws/         # AWS commands (doctor, setup)
│   │   │   │   ├── cdn/         # CDN commands (init, status, sync, etc.)
│   │   │   │   ├── email/       # Email commands (init, connect, status, etc.)
│   │   │   │   │   ├── inbound.ts  # Inbound email receiving
│   │   │   │   │   ├── templates/  # Templates-as-code (init, push, preview)
│   │   │   │   │   └── workflows/  # Workflow management (push, validate)
│   │   │   │   ├── platform/    # Platform commands (connect, update-role)
│   │   │   │   ├── sms/         # SMS commands (init, status, test, etc.)
│   │   │   │   └── workflow/    # Workflow commands
│   │   │   ├── infrastructure/  # Pulumi stacks
│   │   │   │   ├── email-stack.ts    # Email infrastructure
│   │   │   │   ├── sms-stack.ts      # SMS infrastructure
│   │   │   │   ├── cdn-stack.ts      # CDN infrastructure (S3 + CloudFront)
│   │   │   │   ├── vercel-oidc.ts    # Vercel OIDC setup
│   │   │   │   └── resources/        # Pulumi resource definitions
│   │   │   ├── utils/           # Utilities
│   │   │   │   ├── shared/      # Shared utilities
│   │   │   │   ├── email/       # Email-specific utilities
│   │   │   │   └── sms/         # SMS-specific utilities
│   │   │   └── types/           # TypeScript types
│   │   └── lambda/              # Lambda function source (bundled by esbuild)
│   ├── console/                 # Embedded dashboard (Vite + React, bundled into CLI)
│   ├── core/                    # Shared types, utilities, and Lambda code
│   ├── db/                      # Database (Drizzle ORM + Neon PostgreSQL)
│   │   └── src/
│   │       ├── schema/          # Table definitions
│   │       │   ├── app.ts       # Organizations, memberships
│   │       │   ├── auth.ts      # Auth tables (better-auth)
│   │       │   ├── batch.ts     # Email batch tracking
│   │       │   ├── contacts.ts  # Contact management
│   │       │   ├── events.ts    # Email/SMS events
│   │       │   ├── segments.ts  # Audience segments
│   │       │   ├── templates.ts # Email/SMS templates
│   │       │   ├── usage.ts     # Usage tracking
│   │       │   ├── workflows.ts # Workflow definitions
│   │       │   └── waitlist.ts  # Waitlist
│   │       └── migrations/      # Drizzle migrations
│   ├── email/                   # Internal email utilities (React Email templates)
│   ├── email-check/             # Email deliverability checker
│   ├── cdk/                     # AWS CDK construct (alternative to CLI)
│   ├── pulumi/                  # Pulumi component (npm package)
│   ├── tui/                     # Terminal UI (Bun + @opentui)
│   └── ui/                      # Shared UI components (shadcn)
├── .github/workflows/           # GitHub Actions CI/CD
├── .claude/                     # Claude agent configs and skills
├── sst.config.ts                # SST configuration
└── turbo.json                   # Turborepo configuration
```

## Configuration System

**Presets**: Starter, Production, Enterprise, Custom — each enables progressively more SES event types and infrastructure.

**Event Processing Pipeline**: `SES → EventBridge → SQS + DLQ → Lambda → DynamoDB`

**SES Event Types**: SEND, DELIVERY, OPEN, CLICK, BOUNCE, COMPLAINT, REJECT, RENDERING_FAILURE, DELIVERY_DELAY, SUBSCRIPTION

**Multi-Channel**: The system supports email (SES) and SMS (AWS End User Messaging) channels. Templates, workflows, and contacts are multi-channel — workflow steps can send via either channel. The DB schema supports cascade nodes for multi-step, multi-channel sequences.

## Workflow Engine Architecture

The workflow engine executes multi-step automations (email sequences, delays, conditions, webhooks, SMS) triggered by contact events or cron schedules.

**Execution Flow**: Event → Match workflows (org + status=enabled) → Batch enqueue SQS jobs → Processor executes steps → Route via transitions

**Key Architectural Patterns**:
- **Definition Snapshots**: At execution creation, freeze `definitionSnapshot` (steps + transitions + version) into JSONB. In-flight executions are immune to live dashboard edits. Access via `snapshot?.steps ?? wf.steps` fallback for pre-snapshot executions.
- **Atomic Idempotency**: Use `ON CONFLICT DO UPDATE` with idempotency keys on step execution inserts to prevent duplicate sends.
- **EventBridge One-Time Schedules**: Delays and cron chaining use `at(yyyy-MM-ddTHH:mm:ss)` schedules with `ActionAfterCompletion: "DELETE"`. Schedule names must fit 64 chars: `wraps-wf-{execId8}-{stepId8}`.
- **Cron Schedule Chaining**: One pending schedule per workflow at a time. After `schedule-trigger` fires, `createNextWorkflowSchedule()` chains the next. Use `croner` for timezone-aware cron evaluation.
- **DLQ Consumer**: Failed SQS messages (3 retries) go to DLQ → Lambda marks executions as failed. **Must never throw** (no DLQ-of-DLQ). Repairs broken cron chains via `createNextWorkflowSchedule()`.
- **Reconciliation**: `reconcileScheduleChains()` checks EventBridge for each schedule-triggered workflow, recreates missing schedules. `reconcileWorkflowStats()` detects counter drift and optionally repairs.
- **Wait State Claims**: Atomic `UPDATE … WHERE status='waiting'` ensures only one handler (webhook vs timeout) claims a paused execution.
- **Reentry Prevention**: Partial unique index on `(workflowId, contactId) WHERE status IN (active states)` when `allowReentry=false`.

**Key Files**:
- `apps/api/src/services/workflow-events.ts` — Event triggering and workflow matching
- `apps/api/src/services/workflow-queue.ts` — SQS enqueueing and EventBridge scheduling
- `apps/api/src/services/workflow-scheduler.ts` — Cron schedule creation and chaining
- `apps/api/src/(ee)/workers/workflow-processor.ts` — SQS handler: step execution, transitions, sends
- `apps/api/src/(ee)/workers/workflow-dlq-consumer.ts` — DLQ handler: failure recovery
- `apps/api/src/(ee)/workers/workflow-stats.ts` — Stats reconciliation

## Metadata System

Deployment metadata stored in `~/.wraps/connections/{accountId}-{region}.json` (versioned, auto-migrating).

- **Format**: v1.0.0 multi-service — supports `email`, `sms`, `cdn` per account/region
- **Code**: `packages/cli/src/utils/shared/metadata.ts` (`loadConnectionMetadata`, `saveConnectionMetadata`)
- **Migrations**: Auto-applied on load. To add: bump `CURRENT_VERSION`, write migration function, add to chain, test in `metadata.test.ts`

## TypeScript SDKs

- [`@wraps.dev/email`](https://github.com/wraps-team/wraps-js) — Email SDK (separate repo: `wraps-js`)
- `@wraps.dev/sms` — SMS SDK
- Namespace: all SDKs under `@wraps.dev`

## Commands

### Multi-Service Architecture

```bash
wraps <service> <command>
wraps email init           # Deploy email infrastructure
wraps sms init             # Deploy SMS infrastructure
wraps cdn init             # Deploy CDN infrastructure
wraps auth login           # Authenticate with Wraps Platform
```

For detailed command reference, see the `cli-commands` skill.

## Critical Design Principles

1. **Non-Destructive**: Never modify existing AWS resources
2. **Namespace Everything**: All resources prefixed with `wraps-{service}-` (e.g., `wraps-email-`, `wraps-sms-`)
3. **Fail Fast**: Validate early, deploy confidently
4. **Great UX**: Beautiful output, clear errors, helpful suggestions
5. **Type-Safe**: Strict TypeScript throughout
6. **Testable**: Write tests for critical paths
7. **Documented**: JSDoc comments on public APIs

## Development Guidelines

### Infrastructure Deployment

#### Pulumi Stacks
- **Email** (`email-stack.ts`): SES, IAM, DynamoDB, Lambda, EventBridge, SQS, MailManager, S3 (inbound)
- **SMS** (`sms-stack.ts`): AWS End User Messaging / Pinpoint SMS
- **CDN** (`cdn-stack.ts`): S3 + CloudFront + ACM certificates
- All stacks use inline Pulumi programs (no separate stack files)
- Lambda functions bundled on-the-fly using esbuild
- Deployment state stored in `~/.wraps/` directory

#### Resource Naming
- All resources: `wraps-{service}-{resource}`
- Example: `wraps-email-role`, `wraps-email-tracking`, `wraps-sms-role`
- Consistent tagging: `ManagedBy: 'wraps-cli'`

### Testing

- Use Vitest for tests
- Mock AWS SDK clients
- Test critical paths: credential validation, deployment flow, error handling
- Keep tests in `__tests__` directories

### Code Style

- Strict TypeScript mode
- ESM modules (not CommonJS) — no `require()` or `module.exports`
- Async/await (no callbacks)
- Destructuring when appropriate
- Clear variable names (no abbreviations unless obvious)
- Use `@ts-expect-error` instead of `@ts-ignore` (fails when the error is fixed)
- No `catch (e: any)` — use `catch (e)` with `instanceof` type guards
- No swallowed errors (`catch (_e)`) in CLI commands — handle specifically

### Structured Logging

- `apps/web`: Pino logger at `src/lib/logger.ts`. Use `logger.info({ data }, 'message')`. Use `createRequestLogger()` for API routes, `createActionLogger()` for server actions, `serializeError()` for Error objects.
- `apps/api`: Custom JSON logger at `src/lib/logger.ts`. Use `log.info(msg, data?)`, `log.error(msg, error?, data?)`.
- Never use `console.log` in production code paths — use the structured logger.

### Security Patterns

- **SSRF Validation**: Webhook URLs must call `validateWebhookUrl()` before HTTP requests. Blocks loopback, link-local, private networks, IPv4-mapped IPv6, and AWS VPC ranges.
- **Timing-Safe Secrets**: Use `timingSafeEqual()` for webhook secrets, API keys, and tokens. Never use `===` for secret comparison.
- **Cross-Org IDOR Prevention**: All DB queries must scope by `organizationId` from `authContext`. Use `and(eq(resource.id, id), eq(resource.organizationId, authContext.organizationId))` — never query by ID alone.
- **Resource Ownership Validation**: Before using a user-provided `awsAccountId`, verify it belongs to the authenticated org via explicit DB query. Return 403 if no match.

### Banned Dependencies

These are enforced by `baseline.toml` and will fail CI:
- **axios** — use native `fetch()`
- **moment** / **dayjs** — use `date-fns` or `Intl` API
- **next/router** — use `next/navigation` (App Router)
- **@radix-ui/\*** directly in `apps/` — import from `components/ui/` (shadcn wrappers)
- **react-hook-form** — use `@tanstack/react-form` (migration in progress, ratcheted)

### Design System Rules

- No arbitrary hex colors (`bg-[#xxx]`) in `apps/web/` — use theme tokens
- Prefer semantic color tokens (`bg-background`, `text-foreground`, `border-border`) over raw Tailwind colors (`bg-gray-500`)
- Ratchets are actively reducing: raw colors, `as any` assertions, and react-hook-form usage

## Key Files Reference

- **ai-notes/CONTEXT/THESIS.md**: Business strategy, product vision, go-to-market plan
- **packages/cli/src/cli.ts**: CLI entry point (args-based multi-service router)
- **packages/cli/src/infrastructure/email-stack.ts**: Email Pulumi stack
- **packages/cli/src/infrastructure/sms-stack.ts**: SMS Pulumi stack
- **packages/cli/src/infrastructure/cdn-stack.ts**: CDN Pulumi stack
- **packages/cli/src/utils/shared/errors.ts**: Error handling and common errors
- **packages/cli/src/utils/shared/config.ts**: Centralized API/app URL helpers
- **packages/db/src/schema/**: All database table definitions
- **apps/api/src/routes/**: API route handlers
- **apps/api/src/services/workflow-events.ts**: Workflow event triggering and matching
- **apps/api/src/services/workflow-queue.ts**: SQS enqueueing and EventBridge scheduling
- **apps/api/src/services/workflow-scheduler.ts**: Cron schedule creation and chaining
- **apps/api/src/(ee)/workers/workflow-processor.ts**: Step execution, transitions, sends
- **apps/api/src/(ee)/workers/workflow-dlq-consumer.ts**: DLQ failure recovery
- **apps/api/src/lib/logger.ts**: Structured JSON logger (API)
- **apps/web/src/actions/**: Next.js server actions
- **apps/web/src/components/(ee)/workflow-builder/**: Workflow builder (React Flow)
- **apps/web/src/components/template-editor/**: Email template editor (TipTap)

## Common Tasks

### Adding a CLI Command
1. Create file in `packages/cli/src/commands/<service>/`
2. Export async function that takes options
3. Register in `packages/cli/src/cli.ts`
4. Add error handling with `handleCLIError`
5. Add spinner progress indicators
6. Add success output with next steps

### Adding a Pulumi Resource
1. Create file in `packages/cli/src/infrastructure/resources/`
2. Export async function that creates resource
3. Tag with `ManagedBy: 'wraps-cli'`
4. Return resource for use in stack
5. Add to relevant stack (`email-stack.ts`, `sms-stack.ts`, or `cdn-stack.ts`)

### Adding a Database Table/Column
1. Edit or create schema file in `packages/db/src/schema/`
2. Run `pnpm --filter @wraps/db db:generate` to generate migration
3. Run `pnpm --filter @wraps/db db:push` to apply (or `db:migrate` for production)

### Adding an API Route
1. Create route file in `apps/api/src/routes/`
2. Always scope queries by `organizationId`
3. Always `await` async operations (Lambda terminates when handler returns)
4. Emit workflow events for state changes (see `apps/api/CLAUDE.md`)

### Adding a New Error Type
1. Add to `packages/cli/src/utils/shared/errors.ts`
2. Include error code, message, suggestion, and docsUrl
3. Use in command files: `throw errors.yourError()`

## Environment Setup

### Prerequisites
- Node.js 20+
- pnpm 10+
- AWS CLI configured with valid credentials

### Local Development
```bash
pnpm install           # Install dependencies
pnpm build             # Build all packages
pnpm dev               # Watch mode (all packages)
pnpm sst:dev           # Run SST dev (API Lambda + linked resources)
pnpm cli email status  # Run CLI (auto-points at local API/app)
```

### CLI Environment Variables

The `pnpm cli` script automatically sets local dev URLs:

| Variable | Default (via `pnpm cli`) | Production |
|---|---|---|
| `WRAPS_API_URL` | `http://localhost:3001` | `https://api.wraps.dev` |
| `WRAPS_APP_URL` | `http://localhost:3000` | `https://app.wraps.dev` |

URL helpers are centralized in `packages/cli/src/utils/shared/config.ts` (`getApiBaseUrl()`, `getAppBaseUrl()`).

### Testing & Linting
```bash
pnpm test              # Run all tests
pnpm test:ee           # Run enterprise edition tests
pnpm check             # Lint check (ultracite + biome)
pnpm fix               # Auto-fix lint issues
pnpm check:all         # Full CI check: lint → typecheck → baseline → build → test
```

### Migration Backlog (Forms to Migrate)
These files still use `react-hook-form` and should be migrated to `@tanstack/react-form` when touched:
- `apps/web/src/app/(dashboard)/[orgSlug]/topics/components/preference-center-settings.tsx`
- `apps/web/src/app/(dashboard)/[orgSlug]/topics/components/double-opt-in-settings.tsx`

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output CLAUDE.md|01-app:{glossary.mdx}|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-cache-components.mdx,07-fetching-data.mdx,08-updating-data.mdx,09-caching-and-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers.mdx,16-proxy.mdx,17-deploying.mdx,18-upgrading.mdx}|01-app/02-guides:{analytics.mdx,authentication.mdx,backend-for-frontend.mdx,caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mcp.mdx,mdx.mdx,memory-usage.mdx,multi-tenant.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,prefetching.mdx,production-checklist.mdx,progressive-web-apps.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,single-page-applications.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx,version-16.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache-private.mdx,use-cache-remote.mdx,use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,proxy.mdx,public-folder.mdx,route-groups.mdx,route-segment-config.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,next-request.mdx,next-response.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,refresh.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,updateTag.mdx,use-link-status.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,browserDebugInfoInTerminal.mdx,cacheComponents.mdx,cacheHandlers.mdx,cacheLife.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,devIndicators.mdx,distDir.mdx,env.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,isolatedDevBuild.mdx,logging.mdx,mdxRs.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackFileSystemCache.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,viewTransition.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-forms-and-mutations.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,proxy.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-params.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,devIndicators.mdx,distDir.mdx,env.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,isolatedDevBuild.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
