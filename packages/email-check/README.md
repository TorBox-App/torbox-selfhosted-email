# @wraps.dev/email-check

Email deliverability auditing library. Checks SPF, DKIM, DMARC, MX, blacklists, TLS, and domain age — gives you a letter grade and actionable findings.

Zero dependencies. Pure Node.js built-ins.

## Install

```bash
npm install @wraps.dev/email-check
```

## Usage

```typescript
import { runEmailCheck } from "@wraps.dev/email-check";

const result = await runEmailCheck("yourdomain.com");

console.log(result.score.grade);   // "A", "B", "C", "D", or "F"
console.log(result.score.score);   // 0–100
console.log(result.spf.valid);     // true/false
console.log(result.dkim.found);    // true/false
console.log(result.dmarc.policy);  // "reject" | "quarantine" | "none" | null
```

### Options

```typescript
const result = await runEmailCheck("yourdomain.com", {
  quick: true,           // Fewer DKIM selectors, top blacklists only
  skipBlacklists: false, // Set true if port 25 is blocked in your env
  skipTls: false,        // Set true to skip MX STARTTLS checks
  dkimSelector: "s1",   // Check a specific DKIM selector
  verbose: true,         // Check all selectors, not just first match
});
```

### Individual checks

Every check is exported individually if you only need one:

```typescript
import {
  checkSpf,
  checkDkim,
  checkDmarc,
  checkMx,
  checkMxTls,
  checkBlacklist,
  checkDomainAge,
  calculateScore,
} from "@wraps.dev/email-check";

const spf = await checkSpf("yourdomain.com");
console.log(spf.record);       // "v=spf1 include:_spf.google.com ~all"
console.log(spf.lookupCount);  // DNS lookup count (RFC limit: 10)

const dkim = await checkDkim("yourdomain.com");
console.log(dkim.selectors);   // Array of found selectors with key details

const dmarc = await checkDmarc("yourdomain.com");
console.log(dmarc.policy);     // "reject" | "quarantine" | "none" | null
console.log(dmarc.pct);        // Policy percentage (100 = fully enforced)
```

## Grading

Grades are determined by the auth triad (SPF + DKIM + DMARC). Secondary factors move your score within the grade band.

| Grade | Requirement | Score |
|-------|-------------|-------|
| A | SPF + DKIM + DMARC enforcing (`quarantine`/`reject`) | 90–100 |
| B | All three present, DMARC not yet enforcing | 80–89 |
| C | Missing one of the three | 65–79 |
| D | Missing two | 35–64 |
| F | Missing all three, `+all` SPF, or Spamhaus-listed | 0–34 |

Bonuses (MTA-STS, BIMI, clean blacklists, MX redundancy) and deductions (weak DKIM key, no DMARC reporting, new domain) adjust the score within the band.

## What gets checked

| Check | What it detects |
|-------|----------------|
| **SPF** | Record existence, syntax, `-all`/`~all`/`+all`, lookup count (RFC 7208 limit: 10), duplicate records |
| **DKIM** | Auto-discovers ~100 common selectors; validates key type, size, and flags |
| **DMARC** | Policy (`none`/`quarantine`/`reject`), `pct`, alignment, reporting URIs |
| **MX** | Records, IP resolution, PTR records, IPv6 |
| **MX TLS** | STARTTLS support on port 25 |
| **Blacklists** | Domain and IP checked against major DNSBLs (Spamhaus, Barracuda, SORBS, etc.) |
| **Domain age** | Registration date via RDAP — new domains score lower |

## Result shape

```typescript
type EmailCheckResult = {
  domain: string;
  checkedAt: string;   // ISO timestamp
  duration: number;    // ms

  spf: SpfResult;
  dkim: DkimResult;
  dmarc: DmarcResult;
  mx: MxResult;
  mxTls: MxTlsResult;
  blacklist: BlacklistResult;
  domainAge: DomainAgeResult;
  reverseDns: ReverseDnsResult;
  ipv6: Ipv6Result;
  mtaSts: MtaStsResult;
  tlsRpt: TlsRptResult;
  dnssec: DnssecResult;
  caa: CaaResult;
  bimi: BimiResult;

  score: {
    score: number;         // 0–100
    grade: "A"|"B"|"C"|"D"|"F";
    deductions: Deduction[];
    bonuses: Bonus[];
  };
};
```

Full TypeScript types are exported from the package.

## Exit codes

Use `getExitCode(grade)` to map grades to process exit codes:

```typescript
import { runEmailCheck, getExitCode } from "@wraps.dev/email-check";

const result = await runEmailCheck("yourdomain.com");
process.exit(getExitCode(result.score.grade));
// A/B → 0, C/D → 1, F → 2
```

## Requirements

Node.js 20+. No external dependencies.

## License

MIT — [wraps.dev](https://wraps.dev)
