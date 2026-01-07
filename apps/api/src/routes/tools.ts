/**
 * Public Tools Routes
 * Free email deliverability tools - no authentication required
 */

import { runEmailCheck } from "@wraps/email-check";
import { Elysia, t } from "elysia";

export const toolsRoutes = new Elysia({ prefix: "/tools" })
  .post(
    "/email-check",
    async ({ body }) => {
      const { domain, quick = true } = body;

      // Validate domain format
      if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) {
        return {
          error: "Invalid domain format",
          domain,
        };
      }

      try {
        const result = await runEmailCheck(domain, {
          quick,
          skipBlacklists: quick, // Skip blacklists in quick mode for speed
          skipTls: true, // Skip TLS checks (port 25 often blocked)
        });

        // Return a simplified result for the frontend
        return {
          success: true,
          domain: result.domain,
          checkedAt: result.checkedAt,
          duration: result.duration,
          score: {
            grade: result.score.grade,
            score: result.score.finalScore,
            maxScore: 100,
          },
          spf: {
            exists: result.spf.exists,
            valid: result.spf.valid,
            record: result.spf.record,
            lookupCount: result.spf.lookupCount,
            allMechanism: result.spf.allMechanism,
          },
          dkim: {
            found: result.dkim.found,
            selectorsFound: result.dkim.selectors
              .filter((s) => s.valid && !s.revoked)
              .map((s) => ({
                selector: s.selector,
                keyType: s.keyType,
                keyBits: s.keyBits,
              })),
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
          },
          mx: {
            exists: result.mx.exists,
            records: result.mx.records.map((r) => ({
              exchange: r.exchange,
              priority: r.priority,
              resolves: r.resolves,
            })),
          },
          issues: result.score.deductions.map((d) => ({
            check: d.check,
            reason: d.reason,
            points: d.points,
            severity:
              d.points >= 20 ? "critical" : d.points >= 10 ? "warning" : "info",
          })),
        };
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
      }),
      detail: {
        tags: ["tools"],
        summary: "Check email deliverability",
        description:
          "Comprehensive email deliverability check for any domain. Returns SPF, DKIM, DMARC status and a grade.",
      },
    }
  )
  .get(
    "/email-check/:domain",
    async ({ params }) => {
      const { domain } = params;

      // Validate domain format
      if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) {
        return {
          error: "Invalid domain format",
          domain,
        };
      }

      try {
        const result = await runEmailCheck(domain, {
          quick: true,
          skipBlacklists: true,
          skipTls: true,
        });

        return {
          success: true,
          domain: result.domain,
          checkedAt: result.checkedAt,
          duration: result.duration,
          score: {
            grade: result.score.grade,
            score: result.score.finalScore,
            maxScore: 100,
          },
          spf: {
            exists: result.spf.exists,
            valid: result.spf.valid,
            record: result.spf.record,
            lookupCount: result.spf.lookupCount,
            allMechanism: result.spf.allMechanism,
          },
          dkim: {
            found: result.dkim.found,
            selectorsFound: result.dkim.selectors
              .filter((s) => s.valid && !s.revoked)
              .map((s) => ({
                selector: s.selector,
                keyType: s.keyType,
                keyBits: s.keyBits,
              })),
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
          },
          mx: {
            exists: result.mx.exists,
            records: result.mx.records.map((r) => ({
              exchange: r.exchange,
              priority: r.priority,
              resolves: r.resolves,
            })),
          },
          issues: result.score.deductions.map((d) => ({
            check: d.check,
            reason: d.reason,
            points: d.points,
            severity:
              d.points >= 20 ? "critical" : d.points >= 10 ? "warning" : "info",
          })),
        };
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
