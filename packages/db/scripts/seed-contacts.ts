/**
 * Seed Demo Contacts
 *
 * Creates realistic demo contacts with email/SMS channels and engagement data.
 *
 * Usage:
 *   pnpm --filter @wraps/db seed:contacts
 *
 * Or with specific org:
 *   ORG_ID=xxx pnpm --filter @wraps/db seed:contacts
 *
 * Options (via env vars):
 *   ORG_ID - Target organization ID
 *   CONTACT_COUNT - Number of contacts to create (default: 200)
 */

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/schema";
import type { EmailStatus, SmsStatus } from "../src/schema/contacts";

dotenv.config({ path: "../../apps/web/.env.local" });
dotenv.config({ path: "../../.env" });

if (!process.env.DATABASE_URL) {
  console.error(`
DATABASE_URL not found. Either:
  1. Create apps/web/.env.local with DATABASE_URL
  2. Or run with: DATABASE_URL="..." pnpm --filter @wraps/db seed:contacts
`);
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

// --- Name pools ---

const firstNames = [
  "Emma",
  "Liam",
  "Olivia",
  "Noah",
  "Ava",
  "Elijah",
  "Sophia",
  "James",
  "Isabella",
  "William",
  "Mia",
  "Benjamin",
  "Charlotte",
  "Lucas",
  "Amelia",
  "Henry",
  "Harper",
  "Alexander",
  "Evelyn",
  "Sebastian",
  "Abigail",
  "Jack",
  "Emily",
  "Daniel",
  "Elizabeth",
  "Michael",
  "Sofia",
  "Owen",
  "Avery",
  "Ethan",
  "Ella",
  "Jacob",
  "Scarlett",
  "Logan",
  "Grace",
  "Jackson",
  "Chloe",
  "Aiden",
  "Victoria",
  "Samuel",
  "Riley",
  "Mateo",
  "Aria",
  "David",
  "Luna",
  "Joseph",
  "Zoey",
  "Carter",
  "Penelope",
  "Luke",
];

const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
];

const companies = [
  "Acme Corp",
  "Globex",
  "Initech",
  "Hooli",
  "Pied Piper",
  "Umbrella Corp",
  "Stark Industries",
  "Wayne Enterprises",
  "Dunder Mifflin",
  "Sterling Cooper",
  "Weyland-Yutani",
  "Cyberdyne Systems",
  "Massive Dynamic",
  "Tyrell Corp",
  "Oscorp",
  "LexCorp",
  "Wonka Industries",
  "Prestige Worldwide",
  "Bluth Company",
  "InGen",
  "Soylent Corp",
  "Rekall",
  "Aperture Science",
  "Black Mesa",
  null,
  null,
  null,
  null,
  null,
  null, // ~20% no company
];

const jobTitles = [
  "Software Engineer",
  "Product Manager",
  "Designer",
  "Marketing Manager",
  "CEO",
  "CTO",
  "VP Engineering",
  "Data Scientist",
  "DevOps Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Growth Lead",
  "Head of Marketing",
  "Sales Director",
  "Customer Success",
  "Engineering Manager",
  "Technical Lead",
  "UX Researcher",
  "Content Writer",
  null,
  null,
  null,
  null,
  null, // ~20% no title
];

const emailDomains = [
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "hey.com",
  "proton.me",
  "icloud.com",
  "fastmail.com",
  "zoho.com",
  "tutanota.com",
  "pm.me",
  "company.com",
  "startup.io",
  "agency.co",
  "corp.net",
  "tech.dev",
];

// --- Helpers ---

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

function growthDate(daysBack: number): Date {
  const now = new Date();
  // Power distribution biases toward recent dates → exponential growth curve
  const t = Math.random() ** 1.8;
  const msBack = t * daysBack * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - msBack);
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex");
}

function hashPhone(phone: string): string {
  return createHash("sha256").update(phone).digest("hex");
}

function randomPhone(): string {
  const area = randomInt(200, 999);
  const prefix = randomInt(200, 999);
  const line = randomInt(1000, 9999);
  return `+1${area}${prefix}${line}`;
}

function generateEmail(
  firstName: string,
  lastName: string,
  index: number
): string {
  const domain = randomChoice(emailDomains);
  const patterns = [
    () => `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
    () => `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
    () => `${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${domain}`,
    () =>
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}@${domain}`,
    () => `${firstName.toLowerCase()}${index}@${domain}`,
  ];
  return randomChoice(patterns)();
}

// --- Weighted status distribution ---

function randomEmailStatus(): {
  status: EmailStatus;
  timestamps: Record<string, Date | undefined>;
} {
  const roll = Math.random();
  const createdAt = randomDate(180);

  if (roll < 0.8) {
    return {
      status: "active",
      timestamps: {
        emailVerifiedAt: new Date(
          createdAt.getTime() + randomInt(0, 3_600_000)
        ),
      },
    };
  }
  if (roll < 0.9) {
    return {
      status: "unsubscribed",
      timestamps: {
        emailVerifiedAt: new Date(
          createdAt.getTime() + randomInt(0, 3_600_000)
        ),
        emailUnsubscribedAt: randomDate(30),
      },
    };
  }
  if (roll < 0.95) {
    return {
      status: "bounced",
      timestamps: { emailBouncedAt: randomDate(60) },
    };
  }
  if (roll < 0.98) {
    return {
      status: "complained",
      timestamps: {
        emailVerifiedAt: new Date(
          createdAt.getTime() + randomInt(0, 3_600_000)
        ),
        emailComplainedAt: randomDate(30),
      },
    };
  }
  return {
    status: "suppressed",
    timestamps: { emailSuppressedAt: randomDate(30) },
  };
}

function randomSmsStatus(): {
  status: SmsStatus;
  timestamps: Record<string, Date | undefined>;
} {
  const roll = Math.random();

  if (roll < 0.6) {
    return {
      status: "opted_in",
      timestamps: { smsConsentedAt: randomDate(120) },
    };
  }
  if (roll < 0.8) {
    return {
      status: "pending_consent",
      timestamps: {},
    };
  }
  if (roll < 0.95) {
    return {
      status: "opted_out",
      timestamps: {
        smsConsentedAt: randomDate(120),
        smsOptedOutAt: randomDate(30),
      },
    };
  }
  return {
    status: "invalid",
    timestamps: { smsInvalidAt: randomDate(60) },
  };
}

function randomEngagement(status: EmailStatus) {
  if (status !== "active") {
    return { emailsSent: randomInt(0, 5), emailsOpened: 0, emailsClicked: 0 };
  }

  const sent = randomInt(1, 50);
  const opened = randomInt(0, sent);
  const clicked = randomInt(0, opened);

  return {
    emailsSent: sent,
    emailsOpened: opened,
    emailsClicked: clicked,
    lastEmailSentAt: randomDate(14),
    lastEmailOpenedAt: opened > 0 ? randomDate(14) : undefined,
    lastEmailClickedAt: clicked > 0 ? randomDate(14) : undefined,
  };
}

function randomProperties(): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (Math.random() < 0.4)
    props.plan = randomChoice(["free", "starter", "pro", "enterprise"]);
  if (Math.random() < 0.3)
    props.source = randomChoice([
      "website",
      "import",
      "api",
      "referral",
      "event",
    ]);
  if (Math.random() < 0.2)
    props.city = randomChoice([
      "San Francisco",
      "New York",
      "Austin",
      "London",
      "Berlin",
      "Tokyo",
    ]);
  if (Math.random() < 0.15) props.lifetime_value = randomInt(0, 5000);
  return props;
}

// --- Main ---

async function main() {
  console.log("Seeding demo contacts...\n");

  const contactCount = Number.parseInt(process.env.CONTACT_COUNT || "2000", 10);

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

  console.log(`Creating ${contactCount} contacts...\n`);

  const stats = { email: 0, sms: 0, both: 0 };
  const statusCounts: Record<string, number> = {};
  const batchSize = 50;

  for (let i = 0; i < contactCount; i += batchSize) {
    const batch = [];
    const end = Math.min(i + batchSize, contactCount);

    for (let j = i; j < end; j++) {
      const firstName = randomChoice(firstNames);
      const lastName = randomChoice(lastNames);
      const createdAt = growthDate(180);

      // Channel distribution: 60% email-only, 15% SMS-only, 25% both
      const channelRoll = Math.random();
      const hasEmail = channelRoll < 0.85; // 60% email-only + 25% both
      const hasSms = channelRoll >= 0.6; // 15% SMS-only + 25% both

      if (hasEmail && hasSms) stats.both++;
      else if (hasEmail) stats.email++;
      else stats.sms++;

      const email = hasEmail ? generateEmail(firstName, lastName, j) : null;
      const emailResult = hasEmail ? randomEmailStatus() : null;
      const engagement =
        hasEmail && emailResult ? randomEngagement(emailResult.status) : {};

      const phone = hasSms ? randomPhone() : null;
      const smsResult = hasSms ? randomSmsStatus() : null;
      const smsEngagement =
        hasSms && smsResult?.status === "opted_in"
          ? { smsSent: randomInt(0, 20), smsClicked: randomInt(0, 5) }
          : {};

      if (emailResult) {
        statusCounts[`email:${emailResult.status}`] =
          (statusCounts[`email:${emailResult.status}`] || 0) + 1;
      }
      if (smsResult) {
        statusCounts[`sms:${smsResult.status}`] =
          (statusCounts[`sms:${smsResult.status}`] || 0) + 1;
      }

      batch.push({
        organizationId,
        firstName,
        lastName,
        company: randomChoice(companies),
        jobTitle: randomChoice(jobTitles),
        preferredChannel:
          hasEmail && hasSms
            ? randomChoice(["email", "sms"] as const)
            : hasEmail
              ? ("email" as const)
              : ("sms" as const),
        properties: randomProperties(),
        lastActivityAt: randomDate(30),
        createdAt,
        updatedAt: new Date(),

        // Email
        email,
        emailHash: email ? hashEmail(email) : null,
        emailStatus: emailResult?.status ?? null,
        emailVerifiedAt: emailResult?.timestamps.emailVerifiedAt,
        emailUnsubscribedAt: emailResult?.timestamps.emailUnsubscribedAt,
        emailBouncedAt: emailResult?.timestamps.emailBouncedAt,
        emailComplainedAt: emailResult?.timestamps.emailComplainedAt,
        emailSuppressedAt: emailResult?.timestamps.emailSuppressedAt,
        ...engagement,

        // SMS
        phone,
        phoneHash: phone ? hashPhone(phone) : null,
        smsStatus: smsResult?.status ?? null,
        smsConsentedAt: smsResult?.timestamps.smsConsentedAt,
        smsOptedOutAt: smsResult?.timestamps.smsOptedOutAt,
        smsInvalidAt: smsResult?.timestamps.smsInvalidAt,
        ...smsEngagement,
      });
    }

    await db.insert(schema.contact).values(batch);
    process.stdout.write(`\r  Progress: ${end}/${contactCount} contacts`);
  }

  console.log("\n\n📊 Channel distribution:");
  console.log(`  Email only: ${stats.email}`);
  console.log(`  SMS only: ${stats.sms}`);
  console.log(`  Both: ${stats.both}`);

  console.log("\n📊 Status distribution:");
  for (const [key, count] of Object.entries(statusCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${key}: ${count}`);
  }

  console.log(`\n✅ Created ${contactCount} demo contacts!\n`);
  console.log("View them at: http://localhost:3000/<org-slug>/contacts");
}

main().catch(console.error);
