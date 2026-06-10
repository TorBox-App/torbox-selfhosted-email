#!/usr/bin/env node
/**
 * SES test-render gate: TestRenderEmailTemplate every template in the
 * account with the standard variable set and report failures. Exits 1 if
 * any template fails — wire into cron/CI to catch templates that would
 * RenderingFailure (silent non-delivery) on a real send.
 *
 * Usage: AWS_PROFILE=<profile> node scripts/test-render-all.mjs
 */

import {
  ListEmailTemplatesCommand,
  SESv2Client,
  TestRenderEmailTemplateCommand,
} from "@aws-sdk/client-sesv2";

const client = new SESv2Client({});

const TEST_DATA = JSON.stringify({
  email: "test@example.com",
  contactEmail: "test@example.com",
  firstName: "Jane",
  lastName: "Doe",
  company: "Acme",
  jobTitle: "Engineer",
  contactFirstName: "Jane",
  contactLastName: "Doe",
  contactCompany: "Acme",
  contactJobTitle: "Engineer",
  organizationName: "Acme",
  unsubscribeUrl: "https://example.com/u",
  preferencesUrl: "https://example.com/p",
  workflowName: "My Workflow",
  templateName: "My Template",
  contactName: "Jane Doe",
  recipientCount: "42",
  dashboardUrl: "https://app.wraps.dev",
  // Transactional per-send data — always supplied by the sender at send
  // time (sendTemplate callers), included here so the gate exercises the
  // full fleet instead of false-failing on auth/billing templates.
  name: "Jane",
  resetPasswordUrl: "https://app.wraps.dev/reset",
  verificationUrl: "https://app.wraps.dev/verify",
  inviterName: "Jarod",
  inviteUrl: "https://app.wraps.dev/invite",
  orgName: "Acme",
  amount: "$19.00",
  cardLast4: "4242",
  dueDate: "June 15, 2026",
  billingUrl: "https://app.wraps.dev/billing",
  continueUrl: "https://app.wraps.dev/continue",
  url: "https://app.wraps.dev",
  privacyUrl: "https://wraps.dev/privacy",
  termsUrl: "https://wraps.dev/terms",
  supportUrl: "https://wraps.dev/support",
  roleArticle: "a",
  role: "member",
  expiresIn: "48 hours",
  inviteLink: "https://app.wraps.dev/invite",
  declineLink: "https://app.wraps.dev/invite/decline",
  workspaceItemsHtml: "<li>Templates</li>",
  showAwsWarning: "",
});

const templates = [];
let next;
do {
  const page = await client.send(
    new ListEmailTemplatesCommand({ NextToken: next, PageSize: 50 })
  );
  templates.push(...(page.TemplatesMetadata ?? []));
  next = page.NextToken;
} while (next);

let failures = 0;
for (const meta of templates) {
  let lastError;
  let ok = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await client.send(
        new TestRenderEmailTemplateCommand({
          TemplateName: meta.TemplateName,
          TemplateData: TEST_DATA,
        })
      );
      ok = true;
      break;
    } catch (error) {
      lastError = error;
      if (!/rate exceeded|throttl/i.test(error.message)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  if (ok) {
    console.log(`OK    ${meta.TemplateName}`);
  } else {
    failures++;
    console.log(`FAIL  ${meta.TemplateName}: ${lastError.message}`);
  }
  await new Promise((r) => setTimeout(r, 200));
}

console.log(
  `\n${templates.length - failures}/${templates.length} templates render`
);
process.exit(failures > 0 ? 1 : 0);
