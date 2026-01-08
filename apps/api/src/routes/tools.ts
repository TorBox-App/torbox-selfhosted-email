/**
 * Public Tools Routes
 * Free email deliverability tools - no authentication required
 */

import { type EmailCheckResult, runEmailCheck } from "@wraps/email-check";
import { Elysia, t } from "elysia";

import { publicRateLimitMiddleware } from "../middleware/public-rate-limit";
import {
  getCached,
  getEmailCheckCacheKey,
  setCache,
} from "../middleware/tools-cache";

/**
 * Transform EmailCheckResult to API response format
 */
function formatEmailCheckResult(result: EmailCheckResult) {
  return {
    success: true,
    domain: result.domain,
    checkedAt: result.checkedAt,
    duration: result.duration,
    score: {
      grade: result.score.grade,
      score: result.score.finalScore,
      maxScore: 100,
      breakdown: result.score.breakdown,
    },
    spf: {
      exists: result.spf.exists,
      valid: result.spf.valid,
      record: result.spf.record,
      lookupCount: result.spf.lookupCount,
      lookupLimit: result.spf.lookupLimit,
      allMechanism: result.spf.allMechanism,
      includes: result.spf.includes,
      hasPtr: result.spf.hasPtr,
      warnings: result.spf.warnings,
    },
    dkim: {
      found: result.dkim.found,
      selectorsFound: result.dkim.selectors
        .filter((s) => s.valid && !s.revoked)
        .map((s) => ({
          selector: s.selector,
          keyType: s.keyType,
          keyBits: s.keyBits,
          testMode: s.testMode,
        })),
      selectorsChecked: result.dkim.selectorsChecked,
      warnings: result.dkim.warnings,
    },
    dmarc: {
      exists: result.dmarc.exists,
      valid: result.dmarc.valid,
      record: result.dmarc.record,
      policy: result.dmarc.policy,
      subdomainPolicy: result.dmarc.subdomainPolicy,
      reportingEnabled: result.dmarc.reportingEnabled,
      pct: result.dmarc.percentage,
      alignmentSpf: result.dmarc.alignmentSpf,
      alignmentDkim: result.dmarc.alignmentDkim,
      ruaAddresses: result.dmarc.ruaAddresses,
      warnings: result.dmarc.warnings,
    },
    mx: {
      exists: result.mx.exists,
      hasRedundancy: result.mx.hasRedundancy,
      records: result.mx.records.map((r) => ({
        exchange: r.exchange,
        priority: r.priority,
        resolves: r.resolves,
        ipv4Count: r.ipv4Addresses.length,
        ipv6Count: r.ipv6Addresses.length,
      })),
    },
    domainAge: {
      ageInDays: result.domainAge.ageInDays,
      createdAt: result.domainAge.createdAt,
      expiresAt: result.domainAge.expiresAt,
      daysUntilExpiry: result.domainAge.daysUntilExpiry,
      registrar: result.domainAge.registrar,
      source: result.domainAge.source,
      privacyEnabled: result.domainAge.privacyEnabled,
    },
    ipv6: {
      mxHasIpv6: result.ipv6.mxHasIpv6,
      spfIncludesIpv6: result.ipv6.spfIncludesIpv6,
      mxIpv6Count: result.ipv6.mxIpv6Addresses.length,
    },
    reverseDns: {
      allHavePtr: result.reverseDns.allHavePtr,
      allConfirm: result.reverseDns.allConfirm,
      count: result.reverseDns.results.length,
    },
    blacklist: {
      checked: !result.blacklist.quickMode,
      overallClean: result.blacklist.overallClean,
      domainListings: result.blacklist.domainChecks.listed.map((l) => ({
        blacklist: l.blacklist,
        priority: l.priority,
        delistUrl: l.delistUrl,
      })),
      ipListings: result.blacklist.ipChecks.listed.map((l) => ({
        blacklist: l.blacklist,
        priority: l.priority,
        target: l.target,
        delistUrl: l.delistUrl,
      })),
    },
    issues: result.score.deductions.map((d) => ({
      check: d.check,
      reason: d.reason,
      points: d.points,
      severity:
        d.points >= 20 ? "critical" : d.points >= 10 ? "warning" : "info",
    })),
    bonuses: result.score.bonuses.map((b) => ({
      check: b.check,
      reason: b.reason,
      points: b.points,
    })),
  };
}

export const toolsRoutes = new Elysia({ prefix: "/tools" })
  // Apply IP-based rate limiting to all tools routes
  .use(publicRateLimitMiddleware)
  .post(
    "/email-check",
    async ({ body, set }) => {
      const { domain, quick = true, dkimSelector, dkimSelectors } = body;

      // Validate domain format
      if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) {
        return {
          error: "Invalid domain format",
          domain,
        };
      }

      // Build selectors array from either single selector or array
      const selectors = dkimSelectors?.length
        ? dkimSelectors
        : dkimSelector
          ? [dkimSelector]
          : undefined;

      // Check cache first
      const cacheKey = getEmailCheckCacheKey(domain, {
        quick,
        dkimSelectors: selectors,
      });
      const cached =
        await getCached<ReturnType<typeof formatEmailCheckResult>>(cacheKey);
      if (cached) {
        set.headers["X-Cache"] = "HIT";
        return cached;
      }

      try {
        const result = await runEmailCheck(domain, {
          quick,
          skipBlacklists: quick, // Skip blacklists in quick mode for speed
          skipTls: true, // Skip TLS checks (port 25 often blocked)
          dkimSelectors: selectors, // Custom DKIM selectors (useful for AWS SES)
        });

        const formatted = formatEmailCheckResult(result);

        // Cache successful results for 5 minutes
        await setCache(cacheKey, formatted);
        set.headers["X-Cache"] = "MISS";

        return formatted;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          success: false,
          error: message,
          domain,
        };
      }
    },
    {
      body: t.Object({
        domain: t.String({ minLength: 3 }),
        quick: t.Optional(t.Boolean()),
        dkimSelector: t.Optional(t.String()),
        dkimSelectors: t.Optional(t.Array(t.String())),
      }),
      detail: {
        tags: ["tools"],
        summary: "Check email deliverability",
        description:
          "Comprehensive email deliverability check for any domain. Returns SPF, DKIM, DMARC status and a grade. Optionally provide DKIM selectors for providers like AWS SES that use random selectors.",
      },
    }
  )
  .get(
    "/email-check/:domain",
    async ({ params, set }) => {
      const { domain } = params;

      // Validate domain format
      if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) {
        return {
          error: "Invalid domain format",
          domain,
        };
      }

      // Check cache first
      const cacheKey = getEmailCheckCacheKey(domain, { quick: true });
      const cached =
        await getCached<ReturnType<typeof formatEmailCheckResult>>(cacheKey);
      if (cached) {
        set.headers["X-Cache"] = "HIT";
        return cached;
      }

      try {
        const result = await runEmailCheck(domain, {
          quick: true,
          skipBlacklists: true,
          skipTls: true,
        });

        const formatted = formatEmailCheckResult(result);

        // Cache successful results for 5 minutes
        await setCache(cacheKey, formatted);
        set.headers["X-Cache"] = "MISS";

        return formatted;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          success: false,
          error: message,
          domain,
        };
      }
    },
    {
      params: t.Object({
        domain: t.String(),
      }),
      detail: {
        tags: ["tools"],
        summary: "Check email deliverability (GET)",
        description:
          "Quick email deliverability check for any domain via GET request.",
      },
    }
  );
