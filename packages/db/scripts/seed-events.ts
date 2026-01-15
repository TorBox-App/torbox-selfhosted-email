/**
 * Seed Demo Contact Events
 *
 * Creates realistic demo events for existing contacts.
 *
 * Usage:
 *   pnpm --filter @wraps/db seed:events
 *
 * Or with specific org:
 *   ORG_ID=xxx pnpm --filter @wraps/db seed:events
 *
 * Options (via env vars):
 *   ORG_ID - Target organization ID
 *   EVENT_COUNT - Number of events to create (default: 100)
 */

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/schema";

// Load env from apps/web/.env.local (same as drizzle.config.ts)
dotenv.config({ path: "../../apps/web/.env.local" });
dotenv.config({ path: "../../.env" }); // Fallback to root .env

if (!process.env.DATABASE_URL) {
  console.error(`
DATABASE_URL not found. Either:
  1. Create apps/web/.env.local with DATABASE_URL
  2. Or run with: DATABASE_URL="..." pnpm --filter @wraps/db seed:events
`);
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

// Sample event types with realistic data patterns
const eventTypes = [
  {
    name: "user.signup",
    getData: () => ({
      source: randomChoice(["website", "mobile_app", "api", "referral"]),
      plan: randomChoice(["free", "starter", "pro"]),
      referrer: randomChoice([null, "google", "twitter", "friend"]),
    }),
  },
  {
    name: "order.completed",
    getData: () => ({
      orderId: `ORD-${randomInt(10000, 99999)}`,
      total: randomInt(10, 500),
      currency: "USD",
      items: randomInt(1, 5),
      paymentMethod: randomChoice(["card", "paypal", "apple_pay"]),
    }),
  },
  {
    name: "subscription.upgraded",
    getData: () => ({
      previousPlan: randomChoice(["free", "starter"]),
      newPlan: randomChoice(["starter", "pro", "enterprise"]),
      mrr: randomInt(10, 200),
    }),
  },
  {
    name: "feature.used",
    getData: () => ({
      feature: randomChoice([
        "template_editor",
        "broadcast",
        "automation",
        "analytics",
        "segments",
      ]),
      duration: randomInt(5, 300),
    }),
  },
  {
    name: "page.viewed",
    getData: () => ({
      path: randomChoice([
        "/pricing",
        "/features",
        "/docs",
        "/blog",
        "/contact",
      ]),
      referrer: randomChoice([null, "google.com", "twitter.com"]),
      device: randomChoice(["desktop", "mobile", "tablet"]),
    }),
  },
  {
    name: "form.submitted",
    getData: () => ({
      formId: `form_${randomInt(100, 999)}`,
      formName: randomChoice([
        "contact_us",
        "demo_request",
        "newsletter",
        "feedback",
      ]),
      fields: randomInt(3, 8),
    }),
  },
  {
    name: "button.clicked",
    getData: () => ({
      buttonId: randomChoice([
        "cta_signup",
        "cta_upgrade",
        "nav_pricing",
        "footer_contact",
      ]),
      page: randomChoice(["/", "/pricing", "/features"]),
    }),
  },
  {
    name: "email.link_clicked",
    getData: () => ({
      campaignId: `camp_${randomInt(1000, 9999)}`,
      linkUrl: randomChoice([
        "https://example.com/promo",
        "https://example.com/new-feature",
        "https://example.com/blog/latest",
      ]),
    }),
  },
  {
    name: "cart.abandoned",
    getData: () => ({
      cartId: `CART-${randomInt(10000, 99999)}`,
      value: randomInt(20, 300),
      itemCount: randomInt(1, 4),
    }),
  },
  {
    name: "support.ticket_opened",
    getData: () => ({
      ticketId: `TKT-${randomInt(1000, 9999)}`,
      category: randomChoice(["billing", "technical", "feature_request", "bug"]),
      priority: randomChoice(["low", "medium", "high"]),
    }),
  },
];

// Helper functions
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack: number): Date {
  const now = new Date();
  const msBack = randomInt(0, daysBack * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - msBack);
}

async function main() {
  console.log("Seeding demo contact events...\n");

  const eventCount = Number.parseInt(process.env.EVENT_COUNT || "100", 10);

  // Get organization
  let organizationId = process.env.ORG_ID;

  if (!organizationId) {
    const org = await db.query.organization.findFirst();
    if (!org) {
      console.error("No organization found. Create one first.");
      process.exit(1);
    }
    organizationId = org.id;
    console.log(`Using organization: ${org.name} (${org.id})`);
  }

  // Get contacts for this organization
  const contacts = await db.query.contact.findMany({
    where: eq(schema.contact.organizationId, organizationId),
    limit: 500, // Get up to 500 contacts
  });

  if (contacts.length === 0) {
    console.error("No contacts found for this organization. Create some first.");
    process.exit(1);
  }

  console.log(`Found ${contacts.length} contacts`);
  console.log(`Creating ${eventCount} events...\n`);

  // Track event type distribution
  const eventCounts: Record<string, number> = {};

  // Create events
  for (let i = 0; i < eventCount; i++) {
    const contact = randomChoice(contacts);
    const eventType = randomChoice(eventTypes);
    const createdAt = randomDate(30); // Events from the last 30 days

    // Calculate expiration (2 years from creation)
    const expiresAt = new Date(createdAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);

    await db.insert(schema.contactEvent).values({
      contactId: contact.id,
      organizationId,
      eventName: eventType.name,
      eventData: eventType.getData(),
      createdAt,
      expiresAt,
    });

    // Track counts
    eventCounts[eventType.name] = (eventCounts[eventType.name] || 0) + 1;

    // Progress indicator
    if ((i + 1) % 20 === 0 || i + 1 === eventCount) {
      process.stdout.write(`\r  Progress: ${i + 1}/${eventCount} events`);
    }
  }

  console.log("\n\n📊 Event distribution:");
  for (const [name, count] of Object.entries(eventCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${name}: ${count}`);
  }

  console.log(`\n✅ Created ${eventCount} demo events!\n`);
  console.log("View them at: http://localhost:3000/<org-slug>/events");
}

main().catch(console.error);
