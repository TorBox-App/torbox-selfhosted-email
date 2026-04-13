/**
 * Test script: render, publish, and send test emails for platform templates.
 *
 * Usage:
 *   AWS_PROFILE=wraps-dogfood npx tsx scripts/test-templates.ts [template-name] [to-email]
 *
 * Examples:
 *   AWS_PROFILE=wraps-dogfood npx tsx scripts/test-templates.ts password-reset jarod@wraps.dev
 *   AWS_PROFILE=wraps-dogfood npx tsx scripts/test-templates.ts --all jarod@wraps.dev
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { SESClient, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";
import {
  CreateEmailTemplateCommand,
  SESv2Client,
  UpdateEmailTemplateCommand,
} from "@aws-sdk/client-sesv2";

const TEMPLATES_DIR = join(__dirname, "../wraps/templates");
const REGION = "us-east-1";
const FROM = "Wraps <hello@wraps.dev>";

// Templates we want to test (the new ones)
const NEW_TEMPLATES = [
  "password-reset",
  "password-changed",
  "payment-failure",
  "email-verification",
  "team-invitation",
  "mobile-rescue",
];

// Test data for each template
const TEST_DATA: Record<string, Record<string, string>> = {
  "password-reset": {
    name: "Jarod",
    email: "jarod@wraps.dev",
    resetPasswordUrl: "https://app.wraps.dev/reset-password?token=test-123",
    privacyUrl: "https://wraps.dev/privacy",
  },
  "password-changed": {
    name: "Jarod",
    email: "jarod@wraps.dev",
  },
  "payment-failure": {
    name: "Jarod",
    amount: "USD $29.00",
    organizationName: "Wraps Dogfood",
    billingUrl: "https://app.wraps.dev/wraps-dogfood/settings/billing",
    invoiceUrl: "https://stripe.com/invoice/test",
  },
  "email-verification": {
    name: "Jarod",
    verificationUrl: "https://app.wraps.dev/verify?token=test-123",
  },
  "team-invitation": {
    inviterName: "Jarod",
    organizationName: "Wraps Dogfood",
    role: "admin",
    roleArticle: "an",
    inviteLink: "https://app.wraps.dev/invitations/test/accept",
    declineLink: "https://app.wraps.dev/invitations/test/decline",
    workspaceItemsHtml:
      '<li style="margin-bottom:4px;">5 email templates</li><li style="margin-bottom:4px;">120 contacts</li><li style="margin-bottom:4px;">AWS connected</li><li style="margin-bottom:4px;">1 verified domain (wraps.dev)</li>',
    showAwsWarning: "",
  },
  "mobile-rescue": {
    orgName: "Wraps Dogfood",
    dashboardUrl: "https://app.wraps.dev/wraps-dogfood/onboarding",
  },
};

async function renderTemplate(slug: string) {
  const filePath = join(TEMPLATES_DIR, `${slug}.tsx`);
  const mod = await import(filePath);
  const Component = mod.default;
  const subject = mod.subject as string;

  // Use proxy to inject Handlebars placeholders (same as CLI)
  const accessedProps = new Set<string>();
  const props = new Proxy({} as Record<string, string>, {
    get: (_target, prop) => {
      if (typeof prop === "symbol") return;
      const name = String(prop);
      accessedProps.add(name);
      return `{{${name}}}`;
    },
  });

  // @react-email/render is installed in apps/api
  const { render } = await import(
    "../apps/api/node_modules/@react-email/render/dist/node/index.js"
  );
  const element = Component(props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return { html, text, subject, accessedProps };
}

async function upsertTemplate(
  ses: SESv2Client,
  name: string,
  subject: string,
  html: string,
  text: string
) {
  const content = { Subject: subject, Html: html, Text: text };
  try {
    await ses.send(
      new CreateEmailTemplateCommand({
        TemplateName: name,
        TemplateContent: content,
      })
    );
    console.log(`  Created template: ${name}`);
  } catch (err: any) {
    if (err.name === "AlreadyExistsException") {
      await ses.send(
        new UpdateEmailTemplateCommand({
          TemplateName: name,
          TemplateContent: content,
        })
      );
      console.log(`  Updated template: ${name}`);
    } else {
      throw err;
    }
  }
}

async function sendTest(
  ses: SESClient,
  template: string,
  to: string,
  data: Record<string, string>
) {
  await ses.send(
    new SendTemplatedEmailCommand({
      Source: FROM,
      Destination: { ToAddresses: [to] },
      Template: template,
      TemplateData: JSON.stringify(data),
    })
  );
  console.log(`  Sent test: ${template} → ${to}`);
}

async function main() {
  const args = process.argv.slice(2);
  const toEmail = args.find((a) => a.includes("@"));
  const templateArg = args.find((a) => !a.includes("@") && a !== "--all");
  const sendAll = args.includes("--all");

  if (!toEmail) {
    console.error(
      "Usage: AWS_PROFILE=wraps-dogfood npx tsx scripts/test-templates.ts [--all|template-name] <to-email>"
    );
    process.exit(1);
  }

  const templates = templateArg
    ? [templateArg]
    : sendAll
      ? NEW_TEMPLATES
      : NEW_TEMPLATES;

  const sesV2 = new SESv2Client({ region: REGION });
  const sesV1 = new SESClient({ region: REGION });

  console.log(`\nRendering and publishing ${templates.length} templates...\n`);

  for (const slug of templates) {
    console.log(`[${slug}]`);
    try {
      const { html, text, subject, accessedProps } = await renderTemplate(slug);
      console.log(
        `  Rendered (${accessedProps.size} variables: ${[...accessedProps].join(", ")})`
      );

      await upsertTemplate(sesV2, slug, subject, html, text);

      const data = TEST_DATA[slug];
      if (!data) {
        console.log("  No test data defined, skipping send");
        continue;
      }

      await sendTest(sesV1, slug, toEmail, data);
    } catch (err) {
      console.error(`  ERROR: ${err}`);
    }
    console.log();
  }

  console.log("Done! Check your inbox.");
}

main();
