/**
 * Scoring System
 * Calculate email deliverability score based on check results
 */

import type {
  BimiResult,
  BlacklistResult,
  Bonus,
  CaaResult,
  Deduction,
  DkimResult,
  DmarcResult,
  DnssecResult,
  DomainAgeResult,
  Ipv6Result,
  MtaStsResult,
  MxResult,
  MxTlsResult,
  ReverseDnsResult,
  ScoreResult,
  SpfResult,
  TlsRptResult,
} from "./types.js";

export type AllCheckResults = {
  spf: SpfResult;
  dkim: DkimResult;
  dmarc: DmarcResult;
  mx: MxResult;
  mxTls: MxTlsResult;
  mtaSts: MtaStsResult;
  tlsRpt: TlsRptResult;
  bimi: BimiResult;
  dnssec: DnssecResult;
  ipv6: Ipv6Result;
  reverseDns: ReverseDnsResult;
  blacklist: BlacklistResult;
  domainAge: DomainAgeResult;
  caa: CaaResult;
};

/**
 * Calculate email deliverability score
 */
export function calculateScore(checks: AllCheckResults): ScoreResult {
  let score = 100;
  const deductions: Deduction[] = [];
  const bonuses: Bonus[] = [];

  // === SPF (30 points max) ===
  if (!checks.spf.exists) {
    score -= 30;
    deductions.push({ check: "spf", points: 30, reason: "No SPF record" });
  } else if (checks.spf.multipleRecords) {
    score -= 30;
    deductions.push({
      check: "spf",
      points: 30,
      reason: "Multiple SPF records (RFC violation)",
    });
  } else if (!checks.spf.valid) {
    score -= 30;
    deductions.push({ check: "spf", points: 30, reason: "Invalid SPF syntax" });
  } else if (checks.spf.allMechanism === "+all") {
    score -= 30;
    deductions.push({
      check: "spf",
      points: 30,
      reason: "SPF +all allows anyone",
    });
  } else if (checks.spf.hasCircularInclude) {
    score -= 30;
    deductions.push({
      check: "spf",
      points: 30,
      reason: "SPF has circular include (infinite loop)",
    });
  } else {
    if (checks.spf.allMechanism === "?all") {
      score -= 15;
      deductions.push({
        check: "spf",
        points: 15,
        reason: "SPF ?all is too permissive",
      });
    } else if (checks.spf.allMechanism === "~all") {
      score -= 5;
      deductions.push({
        check: "spf",
        points: 5,
        reason: "SPF ~all (softfail) instead of -all",
      });
    }
    if (checks.spf.lookupCount > 10) {
      score -= 10;
      deductions.push({
        check: "spf",
        points: 10,
        reason: `SPF exceeds 10 lookups (${checks.spf.lookupCount})`,
      });
    }
    if (checks.spf.hasPtr) {
      score -= 2;
      deductions.push({
        check: "spf",
        points: 2,
        reason: "SPF uses deprecated ptr mechanism",
      });
    }
  }

  // === DKIM (25 points max) ===
  if (checks.dkim.found) {
    const validSelector = checks.dkim.selectors.find(
      (s) => s.valid && !s.revoked
    );
    if (validSelector) {
      if (
        validSelector.keyType === "rsa" &&
        validSelector.keyBits &&
        validSelector.keyBits < 1024
      ) {
        score -= 20;
        deductions.push({
          check: "dkim",
          points: 20,
          reason: `DKIM key too weak (${validSelector.keyBits} bits)`,
        });
      } else if (
        validSelector.keyType === "rsa" &&
        validSelector.keyBits &&
        validSelector.keyBits < 2048
      ) {
        score -= 5;
        deductions.push({
          check: "dkim",
          points: 5,
          reason: `DKIM key should be 2048+ bits (${validSelector.keyBits})`,
        });
      }
      if (validSelector.testMode) {
        score -= 10;
        deductions.push({
          check: "dkim",
          points: 10,
          reason: "DKIM in testing mode (t=y)",
        });
      }
      // Bonus for multiple selectors
      const validCount = checks.dkim.selectors.filter(
        (s) => s.valid && !s.revoked
      ).length;
      if (validCount > 1) {
        bonuses.push({
          check: "dkim",
          points: 2,
          reason: `${validCount} valid DKIM selectors`,
        });
      }
    } else {
      score -= 25;
      deductions.push({
        check: "dkim",
        points: 25,
        reason: "No valid DKIM record",
      });
    }
  } else {
    score -= 25;
    deductions.push({
      check: "dkim",
      points: 25,
      reason: "No DKIM record found",
    });
  }

  // === DMARC (25 points max) ===
  if (!checks.dmarc.exists) {
    score -= 20;
    deductions.push({ check: "dmarc", points: 20, reason: "No DMARC record" });
  } else if (checks.dmarc.valid) {
    if (checks.dmarc.policy === "none") {
      score -= 10;
      deductions.push({
        check: "dmarc",
        points: 10,
        reason: "DMARC policy is none (not enforcing)",
      });
    }
    if (checks.dmarc.percentage < 100) {
      score -= 5;
      deductions.push({
        check: "dmarc",
        points: 5,
        reason: `DMARC pct=${checks.dmarc.percentage} (not 100%)`,
      });
    }
    if (!checks.dmarc.reportingEnabled) {
      score -= 5;
      deductions.push({
        check: "dmarc",
        points: 5,
        reason: "DMARC reporting not configured (no rua=)",
      });
    }
    // Bonus for strict alignment
    if (
      checks.dmarc.alignmentSpf === "strict" &&
      checks.dmarc.alignmentDkim === "strict"
    ) {
      bonuses.push({
        check: "dmarc",
        points: 2,
        reason: "DMARC strict alignment configured",
      });
    }
  } else {
    score -= 20;
    deductions.push({
      check: "dmarc",
      points: 20,
      reason: "Invalid DMARC syntax",
    });
  }

  // === MX (10 points max) ===
  if (checks.mx.exists) {
    const unresolving = checks.mx.records.filter((r) => !r.resolves);
    if (unresolving.length > 0) {
      score -= 5;
      deductions.push({
        check: "mx",
        points: 5,
        reason: `${unresolving.length} MX records don't resolve`,
      });
    }
    // Bonus for redundancy
    if (checks.mx.hasRedundancy) {
      bonuses.push({
        check: "mx",
        points: 1,
        reason: "Multiple MX records for redundancy",
      });
    }
  } else {
    score -= 5;
    deductions.push({ check: "mx", points: 5, reason: "No MX records" });
  }

  // === Blacklists (10 points max) ===
  const domainListings = checks.blacklist.domainChecks.listed;
  const ipListings = checks.blacklist.ipChecks.listed;

  for (const listing of [...domainListings, ...ipListings]) {
    if (listing.zone.includes("spamhaus")) {
      score -= 30;
      deductions.push({
        check: "blacklist",
        points: 30,
        reason: `Listed on ${listing.blacklist}`,
      });
    } else if (listing.priority === "critical" || listing.priority === "high") {
      const pts = listing.priority === "critical" ? 15 : 10;
      score -= pts;
      deductions.push({
        check: "blacklist",
        points: pts,
        reason: `Listed on ${listing.blacklist}`,
      });
    } else if (listing.priority === "medium") {
      score -= 5;
      deductions.push({
        check: "blacklist",
        points: 5,
        reason: `Listed on ${listing.blacklist}`,
      });
    } else {
      score -= 2;
      deductions.push({
        check: "blacklist",
        points: 2,
        reason: `Listed on ${listing.blacklist}`,
      });
    }
  }

  if (checks.blacklist.overallClean) {
    bonuses.push({
      check: "blacklist",
      points: 5,
      reason: "Clean on all blacklists",
    });
  }

  // === Bonus checks ===

  // MTA-STS
  if (checks.mtaSts.configured && checks.mtaSts.policy?.mode === "enforce") {
    bonuses.push({ check: "mta-sts", points: 5, reason: "MTA-STS enforcing" });
  } else if (
    checks.mtaSts.configured &&
    checks.mtaSts.policy?.mode === "testing"
  ) {
    bonuses.push({
      check: "mta-sts",
      points: 2,
      reason: "MTA-STS testing mode",
    });
  }

  // TLS-RPT
  if (checks.tlsRpt.configured) {
    bonuses.push({ check: "tls-rpt", points: 2, reason: "TLS-RPT configured" });
  }

  // BIMI
  if (checks.bimi.configured && checks.bimi.dmarcCompatible) {
    if (checks.bimi.vmcValid) {
      bonuses.push({ check: "bimi", points: 5, reason: "BIMI with VMC" });
    } else if (checks.bimi.logoAccessible) {
      bonuses.push({
        check: "bimi",
        points: 2,
        reason: "BIMI configured (no VMC)",
      });
    }
  }

  // MX TLS (only if not skipped)
  if (checks.mxTls.checked && !checks.mxTls.skipped) {
    const allMxTls13 = checks.mxTls.servers.every((s) =>
      s.tlsVersions?.includes("TLSv1.3")
    );
    if (allMxTls13) {
      bonuses.push({
        check: "mx-tls",
        points: 2,
        reason: "All MX servers support TLS 1.3",
      });
    }
  }

  // DNSSEC
  if (checks.dnssec.enabled && checks.dnssec.valid) {
    bonuses.push({
      check: "dnssec",
      points: 3,
      reason: "DNSSEC enabled and valid",
    });
  } else if (checks.dnssec.enabled && !checks.dnssec.valid) {
    score -= 5;
    deductions.push({ check: "dnssec", points: 5, reason: "DNSSEC broken" });
  }

  // IPv6
  if (checks.ipv6.mxHasIpv6 && checks.ipv6.spfIncludesIpv6) {
    bonuses.push({ check: "ipv6", points: 2, reason: "Full IPv6 support" });
  } else if (checks.ipv6.mxHasIpv6) {
    bonuses.push({ check: "ipv6", points: 1, reason: "Partial IPv6 support" });
  }

  // Reverse DNS
  if (checks.reverseDns.allHavePtr && checks.reverseDns.allConfirm) {
    bonuses.push({ check: "ptr", points: 2, reason: "All PTR records valid" });
  } else if (!checks.reverseDns.allHavePtr) {
    score -= 5;
    deductions.push({ check: "ptr", points: 5, reason: "Missing reverse DNS" });
  }

  // Domain age (only if data available)
  if (checks.domainAge.ageInDays !== null) {
    if (checks.domainAge.ageInDays < 30) {
      score -= 10;
      deductions.push({
        check: "domain-age",
        points: 10,
        reason: "Domain less than 30 days old",
      });
    } else if (checks.domainAge.ageInDays < 90) {
      score -= 5;
      deductions.push({
        check: "domain-age",
        points: 5,
        reason: "Domain less than 90 days old",
      });
    } else if (checks.domainAge.ageInDays > 365) {
      bonuses.push({
        check: "domain-age",
        points: 2,
        reason: "Domain over 1 year old",
      });
    }
  }
  // No penalty if age unknown (privacy/unavailable)

  // CAA
  if (checks.caa.configured) {
    bonuses.push({ check: "caa", points: 1, reason: "CAA records configured" });
  }

  // Calculate final score
  const totalBonus = bonuses.reduce((sum, b) => sum + b.points, 0);
  const rawScore = score + Math.min(totalBonus, 20); // Cap bonus at 20
  const finalScore = Math.min(100, Math.max(0, rawScore));

  return {
    rawScore,
    finalScore,
    grade: getGrade(finalScore),
    deductions,
    bonuses,
    breakdown: {
      spf: {
        max: 30,
        score: Math.max(0, 30 - sumDeductions(deductions, "spf")),
      },
      dkim: {
        max: 25,
        score: Math.max(0, 25 - sumDeductions(deductions, "dkim")),
      },
      dmarc: {
        max: 25,
        score: Math.max(0, 25 - sumDeductions(deductions, "dmarc")),
      },
      mx: { max: 10, score: Math.max(0, 10 - sumDeductions(deductions, "mx")) },
      blacklist: {
        max: 10,
        score: Math.max(0, 10 - sumDeductions(deductions, "blacklist")),
      },
      bonus: { earned: Math.min(totalBonus, 20), possible: 20 },
    },
  };
}

/**
 * Get letter grade from score
 */
function getGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) {
    return "A";
  }
  if (score >= 80) {
    return "B";
  }
  if (score >= 70) {
    return "C";
  }
  if (score >= 50) {
    return "D";
  }
  return "F";
}

/**
 * Sum deductions for a check category
 */
function sumDeductions(deductions: Deduction[], check: string): number {
  return deductions
    .filter((d) => d.check === check)
    .reduce((sum, d) => sum + d.points, 0);
}

/**
 * Get grade color for terminal output
 */
export function getGradeColor(
  grade: string
): "green" | "yellow" | "orange" | "red" {
  switch (grade) {
    case "A":
    case "B":
      return "green";
    case "C":
      return "yellow";
    case "D":
      return "orange";
    default:
      return "red";
  }
}

/**
 * Get grade description
 */
export function getGradeDescription(grade: string): string {
  switch (grade) {
    case "A":
      return "Excellent - all critical checks pass, best practices followed";
    case "B":
      return "Good - all critical checks pass, minor improvements possible";
    case "C":
      return "Fair - some issues that could affect deliverability";
    case "D":
      return "Poor - significant issues likely affecting deliverability";
    case "F":
      return "Failing - critical issues, emails likely going to spam";
    default:
      return "Unknown";
  }
}
