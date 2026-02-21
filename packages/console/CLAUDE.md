# Wraps Console (packages/console)

Vite + React 19 embedded dashboard bundled into the CLI. Provides web UI for email, SMS, and CDN infrastructure metrics, logs, and settings.

## Critical Rules

### 1. Token-Based Auth from CLI

The CLI generates a random token and opens the console with it. Never store tokens in localStorage — use sessionStorage only.

```typescript
// Token extraction on mount (App.tsx)
const token = new URLSearchParams(window.location.search).get("token");
if (token) sessionStorage.setItem("wraps-auth-token", token);

// Every fetch includes token as query param
const response = await fetch(`/api/emails?token=${token}`);
```

### 2. No Direct AWS Credentials

The console NEVER has AWS credentials. All AWS operations go through the CLI's Express server at `/api/*`. The server handles credential resolution.

### 3. Build Output Goes to CLI

Vite builds to `../cli/dist/console` — the CLI serves this as static files. Changes here affect CLI package size.

### 4. Local Component State Only

No global state library. Each component manages its own fetch/filter/sort via `useState`. Theme is the only context-based state.

## Architecture

### Service Organization

Three peer services share the same navigation pattern:

| Service | Routes | API Prefix |
|---------|--------|------------|
| Email | `/email`, `/email/:id`, `/email/metrics`, `/email/settings` | `/api/emails` |
| SMS | `/sms`, `/sms/:id`, `/sms/metrics`, `/sms/settings` | `/api/sms` |
| CDN | `/cdn`, `/cdn/metrics`, `/cdn/settings` | `/api/cdn` |

Default route: `/` → `/email`

Each service has 4 views: **Logs** (searchable table) → **Detail** (click row) → **Metrics** (charts) → **Settings** (config display)

### Key Files

```
src/
├── App.tsx                    # Router + token extraction + breadcrumbs
├── components/
│   ├── app-sidebar.tsx        # Dual sidebar (product icons + submenu)
│   ├── email/                 # EmailLogs, EmailDetail, EmailMetrics, EmailSettings
│   ├── sms/                   # SMSLogs, SMSDetail, SMSMetrics, SMSSettings
│   ├── cdn/                   # CDN views
│   └── ui/                    # shadcn/ui components
├── hooks/
│   ├── useSSE.ts              # Server-Sent Events (real-time data)
│   ├── useTheme.ts            # Theme context consumer
│   └── useMobile.ts           # Responsive breakpoint (768px)
├── contexts/
│   └── theme-context.ts       # Light/dark mode
└── lib/
    ├── aws-client.ts          # API types (EmailIdentityDetails, etc.)
    └── dns-verification.ts    # DNS validation helpers
```

### Data Fetching Pattern

```typescript
const [logs, setLogs] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const token = sessionStorage.getItem("wraps-auth-token");
  fetch(`/api/emails?startTime=${startTime}&token=${token}`)
    .then(res => res.json())
    .then(data => { setLogs(data.logs); setLoading(false); })
    .catch(err => { setError(err); setLoading(false); });
}, [dateRange]);
```

### Sidebar

Dual-sidebar layout:
1. **Left rail**: Product icons (Email, SMS, CDN) + user dropdown
2. **Right panel**: Submenu items for active product

Active product determined by route prefix matching (`/email` → Email, `/sms` → SMS, `/cdn` → CDN).

## Dev Setup

```bash
pnpm --filter @wraps/console dev    # Dev server on :3003 (proxies /api to :5555)
pnpm --filter @wraps/console build  # Build to ../cli/dist/console
```

Dev mode proxies `/api` to the CLI's Express server at `http://localhost:5555`.
