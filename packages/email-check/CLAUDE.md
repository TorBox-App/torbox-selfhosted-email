# Wraps Email Check (packages/email-check)

Email deliverability auditing library. Zero dependencies — uses only Node.js built-ins. Performs DNS-based validation (SPF, DKIM, DMARC, MX, blacklists, TLS) and produces a letter grade (A-F).

## Critical Rules

### 1. Zero External Dependencies

This package uses ONLY Node.js built-ins (`dns/promises`, `url`). Never add external dependencies.

### 2. Checks Run in Parallel

Core checks (SPF, DKIM, DMARC, MX) execute via `Promise.all()`. Blacklist and TLS checks run after with optional skipping. Never serialize checks that can run in parallel.

### 3. DNS Provider Is Pluggable

All DNS calls go through the `DnsProvider` interface. Never call `dns.resolve*` directly — always use the provider.

```typescript
interface DnsProvider {
  resolveTxt(domain: string): Promise<string[][]>;
  resolveMx(domain: string): Promise<MxRecord[]>;
  resolveA(domain: string): Promise<string[]>;
  // ... resolveAaaa, resolvePtr, resolveCaa, resolveCname
}
```

### 4. DKIM Selector Discovery Uses Batching

~100 selectors checked in batches of 10 to avoid overwhelming DNS servers. Early exit on first valid selector unless verbose mode.

## Architecture

### Check Pipeline

```
runEmailCheck(domain, options)
  ├── Promise.all([SPF, DKIM, DMARC, MX])    # Core checks (parallel)
  ├── Blacklist check                          # Optional (skippable)
  ├── MX TLS check                            # Optional (skippable)
  ├── RDAP domain age                          # Optional
  └── calculateScore(results)                  # Scoring + grading
```

### Key Files

```
src/
├── index.ts              # runEmailCheck() orchestrator
├── types.ts              # All types (~700 lines)
├── scoring.ts            # Score calculation + grading
├── constants.ts          # DKIM selectors, blacklists, provider patterns
├── checks/
│   ├── spf.ts            # SPF with recursive lookup tree tracking
│   ├── dkim.ts           # DKIM selector discovery + key analysis
│   ├── dmarc.ts          # DMARC record parsing
│   ├── mx.ts             # MX resolution + PTR + IPv6
│   ├── mx-tls.ts         # STARTTLS on port 25
│   ├── blacklist.ts      # Domain + IP blacklist checking
│   └── rdap.ts           # Domain age via RDAP
├── dns/
│   ├── index.ts          # DNS abstraction + helpers
│   └── node.ts           # Node.js DNS with timeout wrapping
└── utils/
    └── domain.ts         # IDN/punycode, validation
```

## Scoring Algorithm

**Base: 100 points. Deductions for issues, bonuses for best practices.**

### Deductions (Critical)

| Check | Max Deduction | Examples |
|-------|---------------|---------|
| SPF | -30 | No record, `+all`, >10 lookups |
| DKIM | -25 | No record (-25, or -5 if SES detected), weak key |
| DMARC | -20 | No record, `p=none` (-10) |
| MX | -5 | No records, non-resolving |
| Blacklists | -30 | Spamhaus listing |

### Bonuses (Capped at +20 total)

| Feature | Bonus |
|---------|-------|
| MTA-STS enforcing | +5 |
| BIMI with VMC | +5 |
| DNSSEC valid | +3 |
| Clean blacklists | +5 |
| All MX TLS 1.3 | +2 |
| Multiple DKIM selectors | +2 |
| Strict DMARC alignment | +2 |
| Domain >1 year old | +2 |

### Grade Mapping

| Grade | Score |
|-------|-------|
| A | 90-100 |
| B | 80-89 |
| C | 70-79 |
| D | 50-69 |
| F | <50 |

## Provider Detection

When DKIM selectors aren't found, SPF records are checked for provider hints to give helpful warnings:

```typescript
// constants.ts — PROVIDER_PATTERNS
"amazonses.com" → AWS SES (suggest: ses-YYYYMMDD selectors)
"sendgrid.net" → SendGrid (suggest: s1/s2 selectors)
"mailgun.org" → Mailgun (suggest: smtp/mailo selectors)
```

## Key Constants

| Constant | Value | Notes |
|----------|-------|-------|
| `DEFAULT_TIMEOUT` | 5s | Per DNS query |
| `TOTAL_TIMEOUT` | 30s | Overall check |
| `SPF_LOOKUP_LIMIT` | 10 | RFC 7208 |
| `DKIM_BATCH_SIZE` | 10 | Parallel selector checks |
| `BLACKLIST_BATCH_SIZE` | 20 | Parallel blacklist checks |
| `QUICK_DKIM_SELECTORS` | 25 | Quick mode |
| `DEFAULT_DKIM_SELECTORS` | ~100 | Full mode |

## Commands

```bash
pnpm --filter @wraps/email-check build   # Build
pnpm --filter @wraps/email-check test    # Run tests
```
