"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Clock } from "lucide-react";
import { DocsLayout } from "@/components/docs-layout";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
} from "@/components/ui/shadcn-io/code-block";

// ---------------------------------------------------------------------------
// Email recipes
// ---------------------------------------------------------------------------

const welcomeEmailCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({ region: "us-east-1" });

// Plain HTML
await email.send({
  from: { email: "hello@yourapp.com", name: "YourApp" },
  to: user.email,
  subject: "Welcome to YourApp!",
  html: \`
    <h1>Welcome, \${user.name}!</h1>
    <p>Your account is ready. Here is what to do next:</p>
    <a href="https://yourapp.com/getting-started">Get started</a>
  \`,
});

// Or use a React Email component
import WelcomeEmail from "./emails/welcome";

await email.send({
  from: { email: "hello@yourapp.com", name: "YourApp" },
  to: user.email,
  subject: "Welcome to YourApp!",
  react: <WelcomeEmail name={user.name} />,
});`;

const batchNewsletterCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({ region: "us-east-1" });

// Send unique content to each recipient (max 100 per batch)
const result = await email.sendBatch({
  from: { email: "newsletter@yourapp.com", name: "YourApp" },
  entries: subscribers.map((sub) => ({
    to: sub.email,
    subject: \`\${sub.name}, here is your weekly digest\`,
    html: renderNewsletter({ name: sub.name, articles }),
  })),
  tags: { campaign: "weekly-digest" },
});

console.log(\`Sent: \${result.successCount}, Failed: \${result.failureCount}\`);

// Check individual results
for (const entry of result.results) {
  if (entry.status === "failure") {
    console.error(\`Failed for index \${entry.index}: \${entry.error}\`);
  }
}`;

const sendTemplateCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({ region: "us-east-1" });

// 1. Create a template with {{variable}} placeholders
await email.templates.create({
  name: "order-confirmation",
  subject: "Order #{{orderId}} confirmed",
  html: \`
    <h1>Thanks for your order, {{name}}!</h1>
    <p>Order #{{orderId}} has been confirmed.</p>
    <p>Total: \${{total}}</p>
  \`,
});

// 2. Send using the template
await email.sendTemplate({
  from: "orders@yourapp.com",
  to: customer.email,
  template: "order-confirmation",
  templateData: {
    name: customer.name,
    orderId: order.id,
    total: order.total.toFixed(2),
  },
});

// 3. Bulk send to up to 50 recipients with per-recipient data
await email.sendBulkTemplate({
  from: "orders@yourapp.com",
  template: "order-confirmation",
  destinations: customers.map((c) => ({
    to: c.email,
    templateData: {
      name: c.name,
      orderId: c.orderId,
      total: c.total.toFixed(2),
    },
  })),
});`;

const handleBouncesCode = `import crypto from "crypto";
import { type NextRequest, NextResponse } from "next/server";

const WEBHOOK_SECRET = process.env.WRAPS_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  // Verify the webhook signature
  const signature = request.headers.get("x-wraps-signature");
  if (
    !signature ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(WEBHOOK_SECRET),
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { event, detail, messageId } = await request.json();

  switch (event) {
    case "Bounce": {
      const { bounceType, bouncedRecipients } = detail.bounce;
      if (bounceType === "Permanent") {
        // Hard bounce: remove these addresses from your mailing list
        for (const r of bouncedRecipients) {
          await db.contacts.update({
            where: { email: r.emailAddress },
            data: { bounced: true, bouncedAt: new Date() },
          });
        }
      }
      break;
    }
    case "Complaint": {
      // ISP complaint: unsubscribe immediately
      for (const r of detail.complaint.complainedRecipients) {
        await db.contacts.update({
          where: { email: r.emailAddress },
          data: { unsubscribed: true, unsubscribedAt: new Date() },
        });
      }
      break;
    }
    case "Delivery":
      console.log(\`Email \${messageId} delivered successfully\`);
      break;
  }

  return NextResponse.json({ received: true });
}`;

const trackEventsCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({
  region: "us-east-1",
  historyTableName: "wraps-email-events", // DynamoDB table deployed by CLI
});

// Get events for a specific email by messageId
const status = await email.events!.get("01234567-89ab-cdef-0123-456789abcdef");

if (status) {
  console.log(\`Status: \${status.status}\`);
  // "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | "suppressed"

  for (const event of status.events) {
    console.log(\`  \${event.type} at \${new Date(event.timestamp).toISOString()}\`);
  }
}

// List recent emails with filtering
const { emails, nextToken } = await email.events!.list({
  accountId: "123456789012",
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24 hours
  maxResults: 20,
});

for (const e of emails) {
  console.log(\`\${e.subject} -> \${e.to.join(", ")} [\${e.status}]\`);
}`;

const suppressionListCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({ region: "us-east-1" });

// Check if an address is suppressed
const entry = await email.suppression.get("bounced@example.com");
if (entry) {
  console.log(\`Suppressed: \${entry.reason} on \${entry.lastUpdated}\`);
}

// Manually suppress an address
await email.suppression.add("bad-actor@example.com", "COMPLAINT");

// Remove from suppression list (e.g. after user re-confirms)
await email.suppression.remove("reactivated@example.com");

// List all suppressed addresses with filters
const { entries, nextToken } = await email.suppression.list({
  reason: "BOUNCE",
  startDate: new Date("2024-01-01"),
  maxResults: 100,
});

for (const e of entries) {
  console.log(\`\${e.email} - \${e.reason} - \${e.lastUpdated}\`);
}`;

// ---------------------------------------------------------------------------
// Workflow recipes
// ---------------------------------------------------------------------------

const dripCampaignCode = `import {
  defineWorkflow,
  sendEmail,
  delay,
  condition,
  exit,
  updateContact,
  waitForEmailEngagement,
} from "@wraps.dev/client";

export default defineWorkflow({
  name: "User Onboarding",
  description: "3-email drip sequence for new signups",

  trigger: { type: "contact_created" },

  defaults: {
    from: "hello@yourapp.com",
    fromName: "YourApp",
  },

  steps: [
    // Day 0: Welcome email
    sendEmail("welcome", { template: "welcome" }),
    updateContact("mark-welcomed", {
      updates: [{ field: "welcomeEmailSent", operation: "set", value: true }],
    }),

    // Day 1: Check if they activated
    delay("wait-1-day", { days: 1 }),
    condition("check-activation", {
      field: "contact.hasActivated",
      operator: "equals",
      value: true,
      branches: {
        yes: [exit("activated")],
        no: [
          sendEmail("tips", { template: "getting-started-tips" }),

          // Day 3: Final nudge if still not activated
          delay("wait-2-days", { days: 2 }),
          condition("check-activation-again", {
            field: "contact.hasActivated",
            operator: "equals",
            value: true,
            branches: {
              yes: [exit("activated-late")],
              no: [sendEmail("last-chance", { template: "activation-reminder" })],
            },
          }),
        ],
      },
    }),
  ],
});`;

// ---------------------------------------------------------------------------
// Inbound recipes
// ---------------------------------------------------------------------------

const inboundEmailCode = `import { WrapsEmail } from "@wraps.dev/email";

const email = new WrapsEmail({
  region: "us-east-1",
  inboxBucketName: "wraps-email-inbox-123456789012", // S3 bucket deployed by CLI
});

// List recent inbound emails
const { emails: summaries, nextToken } = await email.inbox!.list({
  maxResults: 10,
});

for (const summary of summaries) {
  console.log(\`\${summary.emailId} - \${summary.lastModified}\`);
}

// Get full email content by ID
const message = await email.inbox!.get(summaries[0].emailId);

console.log(\`From: \${message.from.name} <\${message.from.address}>\`);
console.log(\`Subject: \${message.subject}\`);
console.log(\`Date: \${message.date}\`);
console.log(\`Body: \${message.text ?? message.html}\`);

// Access attachments
for (const att of message.attachments) {
  const url = await email.inbox!.getAttachment(message.emailId, att.id);
  console.log(\`Attachment: \${att.filename} (\${att.contentType}) -> \${url}\`);
}

// Reply to the email (preserves threading headers)
await email.inbox!.reply(message.emailId, {
  from: "support@yourapp.com",
  html: "<p>Thanks for reaching out! We will get back to you shortly.</p>",
});

// Forward to another address
await email.inbox!.forward(message.emailId, {
  from: "support@yourapp.com",
  to: "team@yourapp.com",
});`;

// ---------------------------------------------------------------------------
// SMS recipes
// ---------------------------------------------------------------------------

const smsOptOutCode = `import { WrapsSMS, OptedOutError } from "@wraps.dev/sms";

const sms = new WrapsSMS({ region: "us-east-1" });

// Check opt-out status before sending
const isOptedOut = await sms.optOuts.check("+14155551234");

if (isOptedOut) {
  console.log("User has opted out, skipping send");
} else {
  const result = await sms.send({
    to: "+14155551234",
    message: "Your order has shipped! Track it here: https://yourapp.com/track/123",
    messageType: "TRANSACTIONAL",
  });

  console.log(\`Sent: \${result.messageId} (\${result.segments} segments)\`);
}

// Handle opt-out errors during send
try {
  await sms.send({
    to: "+14155559999",
    message: "Weekly sale: 20% off everything!",
    messageType: "PROMOTIONAL",
  });
} catch (error) {
  if (error instanceof OptedOutError) {
    console.log(\`\${error.phoneNumber} has opted out\`);
    // Mark as opted out in your database
  }
  throw error;
}

// Manage opt-out list directly
await sms.optOuts.add("+14155550000");    // Manually opt out a number
await sms.optOuts.remove("+14155550000"); // Remove opt-out (re-consent received)

const optedOut = await sms.optOuts.list();
for (const entry of optedOut) {
  console.log(\`\${entry.phoneNumber} opted out at \${entry.optedOutAt}\`);
}`;

// ---------------------------------------------------------------------------
// Recipe definitions
// ---------------------------------------------------------------------------

type Recipe = {
  id: string;
  title: string;
  description: string;
  filename: string;
  language: string;
  code: string;
};

const emailRecipes: Recipe[] = [
  {
    id: "welcome-email",
    title: "Send a welcome email on signup",
    description:
      "Basic send with plain HTML or a React Email component. Uses the WrapsEmail client with automatic AWS credential resolution.",
    filename: "signup-handler.tsx",
    language: "typescript",
    code: welcomeEmailCode,
  },
  {
    id: "batch-newsletter",
    title: "Batch send a newsletter",
    description:
      "Send unique content to up to 100 recipients in a single API call using sendBatch. Each entry can have its own subject and body.",
    filename: "send-newsletter.ts",
    language: "typescript",
    code: batchNewsletterCode,
  },
  {
    id: "send-template",
    title: "Send with dynamic templates",
    description:
      "Create SES templates with {{variable}} placeholders, then send personalized emails without rebuilding HTML each time. Use sendBulkTemplate for up to 50 recipients.",
    filename: "templated-send.ts",
    language: "typescript",
    code: sendTemplateCode,
  },
  {
    id: "handle-bounces",
    title: "Handle bounces with webhooks",
    description:
      "Next.js route handler that verifies the Wraps webhook signature and processes bounce, complaint, and delivery events.",
    filename: "app/api/webhooks/email/route.ts",
    language: "typescript",
    code: handleBouncesCode,
  },
  {
    id: "track-events",
    title: "Track email events",
    description:
      "Query delivery, open, click, and bounce events from DynamoDB using the events API. Requires the historyTableName config option.",
    filename: "check-delivery.ts",
    language: "typescript",
    code: trackEventsCode,
  },
  {
    id: "suppression-list",
    title: "Manage suppression lists",
    description:
      "Check, add, remove, and list suppressed email addresses on the SES account-level suppression list.",
    filename: "suppression.ts",
    language: "typescript",
    code: suppressionListCode,
  },
];

const workflowRecipes: Recipe[] = [
  {
    id: "drip-campaign",
    title: "Set up a drip campaign",
    description:
      "Declarative workflow definition with delays, conditions, and branching. Define in wraps/workflows/*.ts for full TypeScript intellisense.",
    filename: "wraps/workflows/onboarding.ts",
    language: "typescript",
    code: dripCampaignCode,
  },
];

const inboundRecipes: Recipe[] = [
  {
    id: "inbound-email",
    title: "Receive and parse inbound email",
    description:
      "List, read, reply to, and forward inbound emails stored in S3. Requires the inboxBucketName config option.",
    filename: "process-inbox.ts",
    language: "typescript",
    code: inboundEmailCode,
  },
];

const smsRecipes: Recipe[] = [
  {
    id: "sms-opt-out",
    title: "Send SMS with opt-out handling",
    description:
      "Check opt-out status before sending, handle OptedOutError gracefully, and manage the opt-out list programmatically.",
    filename: "send-sms.ts",
    language: "typescript",
    code: smsOptOutCode,
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function RecipeBlock({ recipe }: { recipe: Recipe }) {
  return (
    <div className="scroll-mt-20" id={recipe.id}>
      <h3 className="mb-2 font-semibold text-xl">{recipe.title}</h3>
      <p className="mb-4 text-muted-foreground">{recipe.description}</p>
      <CodeBlock
        className="mb-10 h-auto"
        data={[
          {
            language: recipe.language,
            filename: recipe.filename,
            code: recipe.code,
          },
        ]}
        defaultValue={recipe.language}
      >
        <CodeBlockHeader>
          <CodeBlockFiles>
            {(item) => (
              <CodeBlockFilename key={item.language} value={item.language}>
                {item.filename}
              </CodeBlockFilename>
            )}
          </CodeBlockFiles>
          <CodeBlockCopyButton />
        </CodeBlockHeader>
        <CodeBlockBody>
          {(item) => (
            <CodeBlockItem
              key={item.language}
              lineNumbers={false}
              value={item.language}
            >
              <CodeBlockContent language={item.language}>
                {item.code}
              </CodeBlockContent>
            </CodeBlockItem>
          )}
        </CodeBlockBody>
      </CodeBlock>
    </div>
  );
}

function RecipeSection({
  title,
  recipes,
}: {
  title: string;
  recipes: Recipe[];
}) {
  return (
    <section className="mb-16">
      <h2 className="mb-8 font-bold text-2xl">{title}</h2>
      {recipes.map((recipe) => (
        <RecipeBlock key={recipe.id} recipe={recipe} />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CookbookPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Reference
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">Cookbook</h1>
        <p className="text-lg text-muted-foreground">
          Copy-pasteable recipes for common email, SMS, and workflow patterns
          using the Wraps TypeScript SDKs.
        </p>
        <div className="mt-4 flex items-center gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {emailRecipes.length +
              workflowRecipes.length +
              inboundRecipes.length +
              smsRecipes.length}{" "}
            recipes
          </span>
        </div>
      </div>

      {/* Table of contents */}
      <nav className="mb-12 rounded-lg border p-6">
        <h2 className="mb-3 font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          On this page
        </h2>
        <ul className="space-y-2 text-sm">
          {[
            { label: "Email", recipes: emailRecipes },
            { label: "Workflows", recipes: workflowRecipes },
            { label: "Inbound", recipes: inboundRecipes },
            { label: "SMS", recipes: smsRecipes },
          ].map((section) => (
            <li key={section.label}>
              <span className="font-medium">{section.label}</span>
              <ul className="mt-1 space-y-1 pl-4">
                {section.recipes.map((r) => (
                  <li key={r.id}>
                    <a
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      href={`#${r.id}`}
                    >
                      {r.title}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* Recipe sections */}
      <RecipeSection recipes={emailRecipes} title="Email" />
      <RecipeSection recipes={workflowRecipes} title="Workflows" />
      <RecipeSection recipes={inboundRecipes} title="Inbound" />
      <RecipeSection recipes={smsRecipes} title="SMS" />
    </DocsLayout>
  );
}
