/**
 * Event Limit Enforcement — Integration Tests
 *
 * Runs against REAL SST dev resources:
 * - Real database (apps/web/.env.local)
 * - Real API Lambda (SST dev)
 * - Real HTTP via fetch()
 *
 * Prerequisites:
 * 1. Run `pnpm sst:dev` in another terminal
 * 2. Run `pnpm --filter @wraps/api test:integration`
 *
 * Validates that enforceEventLimit actually blocks requests over the grace
 * limit and sets the correct response headers.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  apiKey,
  contact,
  db,
  eq,
  eventUsageMonthly,
  member,
  organization,
  user,
} from "@wraps/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// -----------------------------------------------------------------------------
// SST output loading
// -----------------------------------------------------------------------------

type SstOutputs = { apiUrl: string };

function loadSstOutputs(): SstOutputs {
  const outputsPath = resolve(process.cwd(), "../../.sst/outputs.json");
  if (!existsSync(outputsPath)) {
    throw new Error(
      `SST outputs not found at ${outputsPath}. Run "pnpm sst:dev" first.`
    );
  }
  const outputs = JSON.parse(readFileSync(outputsPath, "utf-8"));
  if (!outputs.apiUrl) {
    throw new Error("apiUrl not found in SST outputs. Is SST dev running?");
  }
  return outputs as SstOutputs;
}

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const TEST_PREFIX = "int-event-limit-test";
const RAW_API_KEY = `wraps_live_${TEST_PREFIX}_key`;

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "Event Limit Integration User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Event Limit Integration Org",
  slug: `${TEST_PREFIX}-org`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: `${TEST_PREFIX}-member-1`,
  organizationId: testOrg.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testApiKey = {
  id: `${TEST_PREFIX}-apikey-1`,
  organizationId: testOrg.id,
  name: "Event Limit Integration Key",
  keyHash: hashKey(RAW_API_KEY),
  prefix: "wraps_live",
  permissions: [] as string[],
  expiresAt: null,
  createdBy: testUser.id,
  createdAt: new Date(),
};

const testContact = {
  id: `${TEST_PREFIX}-contact-1`,
  organizationId: testOrg.id,
  email: `${TEST_PREFIX}-contact@example.com`,
  emailHash: `${TEST_PREFIX}-contact-hash`,
  firstName: "Limit",
  lastName: "Test",
  emailStatus: "active" as const,
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PERIOD_KEY = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
const FREE_LIMIT = 5000;
const FREE_GRACE = Math.floor(FREE_LIMIT * 1.25); // 6250

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function seedUsage(count: number) {
  await db
    .insert(eventUsageMonthly)
    .values({
      organizationId: testOrg.id,
      periodKey: PERIOD_KEY,
      eventCount: count,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [eventUsageMonthly.organizationId, eventUsageMonthly.periodKey],
      set: { eventCount: count, updatedAt: new Date() },
    });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe.skipIf(!existsSync(resolve(process.cwd(), "../../.sst/outputs.json")))(
  "Event Limit Enforcement (real Lambda, real DB)",
  () => {
    let apiUrl: string;

    function postEvent(): Promise<Response> {
      return fetch(`${apiUrl}/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RAW_API_KEY}`,
        },
        body: JSON.stringify({
          name: "test.limit.event",
          contactId: testContact.id,
        }),
      });
    }

    beforeAll(async () => {
      ({ apiUrl } = loadSstOutputs());

      await db
        .insert(user)
        .values(testUser)
        .onConflictDoUpdate({
          target: user.id,
          set: { updatedAt: new Date() },
        });
      await db
        .insert(organization)
        .values(testOrg)
        .onConflictDoUpdate({
          target: organization.id,
          set: { name: testOrg.name },
        });
      await db
        .insert(member)
        .values(testMember)
        .onConflictDoUpdate({
          target: member.id,
          set: { role: testMember.role },
        });
      await db
        .insert(apiKey)
        .values(testApiKey)
        .onConflictDoUpdate({
          target: apiKey.id,
          set: { keyHash: testApiKey.keyHash },
        });
      await db
        .insert(contact)
        .values(testContact)
        .onConflictDoUpdate({
          target: contact.id,
          set: { updatedAt: new Date() },
        });
    });

    afterAll(async () => {
      // org cascade deletes: eventUsageMonthly, contact, member, apiKey
      await db.delete(organization).where(eq(organization.id, testOrg.id));
      await db.delete(user).where(eq(user.id, testUser.id));
    });

    beforeEach(async () => {
      await db
        .delete(eventUsageMonthly)
        .where(eq(eventUsageMonthly.organizationId, testOrg.id));
    });

    it("returns 200 with usage headers when under limit", async () => {
      await seedUsage(2500);
      const res = await postEvent();
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Event-Limit")).toBe(String(FREE_LIMIT));
      expect(res.headers.get("X-Event-Current")).toBe("2500");
      expect(res.headers.get("X-Event-Remaining")).toBe("2500");
      expect(res.headers.get("X-Event-Percent")).toBe("50");
    });

    it("returns 200 with zero prior usage", async () => {
      const res = await postEvent();
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Event-Limit")).toBe(String(FREE_LIMIT));
      expect(res.headers.get("X-Event-Current")).toBe("0");
    });

    it("returns 200 one below the grace limit (6249)", async () => {
      await seedUsage(FREE_GRACE - 1);
      const res = await postEvent();
      expect(res.status).toBe(200);
    });

    it("returns 429 at the grace limit (6250)", async () => {
      await seedUsage(FREE_GRACE);
      const res = await postEvent();
      expect(res.status).toBe(429);
      expect(res.headers.get("X-Event-Exceeded")).toBe("true");
      expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
      const body = await res.json();
      expect(body.error).toBe("event_limit_exceeded");
      expect(body.current).toBe(FREE_GRACE);
      expect(body.limit).toBe(FREE_LIMIT);
      expect(body.upgradeUrl).toBe("https://app.wraps.dev/settings/billing");
      expect(body.resetsAt).toMatch(/^\d{4}-\d{2}-01T/);
    });

    it("returns 429 well over the limit (Darren's 8259 scenario)", async () => {
      await seedUsage(8259);
      const res = await postEvent();
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.current).toBe(8259);
      expect(body.limit).toBe(FREE_LIMIT);
      expect(body.percentUsed).toBe(165);
    });
  }
);
