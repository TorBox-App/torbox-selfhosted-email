#!/usr/bin/env node
/**
 * Repair SES email templates whose TextPart contains case-corrupted
 * Handlebars tokens ({{#IF FIRSTNAME}} et al — produced by html-to-text
 * uppercasing heading content before the normalize fix existed).
 *
 * For each template in the account: fetch Subject/Html/Text, run the text
 * through normalizePlainTextForSes against the Html (canonical casing),
 * and update the template only when the text actually changes. Verifies
 * each repaired template with TestRenderEmailTemplate afterward.
 *
 * Usage:
 *   node scripts/repair-ses-text-parts.mjs            # dry run (report only)
 *   node scripts/repair-ses-text-parts.mjs --apply    # write repairs
 *   AWS_PROFILE=<profile> node scripts/...            # target another account
 */

import {
  GetEmailTemplateCommand,
  ListEmailTemplatesCommand,
  SESv2Client,
  TestRenderEmailTemplateCommand,
  UpdateEmailTemplateCommand,
} from "@aws-sdk/client-sesv2";
import { normalizePlainTextForSes } from "../src/mustache-case.ts";

const apply = process.argv.includes("--apply");
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

console.log(`${templates.length} templates in account\n`);

let corrupted = 0;
for (const meta of templates) {
  const name = meta.TemplateName;
  const { TemplateContent: c } = await client.send(
    new GetEmailTemplateCommand({ TemplateName: name })
  );
  const text = c.Text ?? "";
  const fixedText = normalizePlainTextForSes(text, c.Html ?? "");

  if (fixedText === text) {
    continue;
  }
  corrupted++;
  console.log(`CORRUPTED: ${name}`);
  for (const line of text.split("\n")) {
    if (/\{\{[#/]?[A-Z]/.test(line)) {
      console.log(`  before: ${line.trim().slice(0, 100)}`);
    }
  }

  if (!apply) {
    continue;
  }
  await client.send(
    new UpdateEmailTemplateCommand({
      TemplateName: name,
      TemplateContent: { Subject: c.Subject, Html: c.Html, Text: fixedText },
    })
  );
  try {
    await client.send(
      new TestRenderEmailTemplateCommand({
        TemplateName: name,
        TemplateData: TEST_DATA,
      })
    );
    console.log(`  REPAIRED + test-render OK: ${name}`);
  } catch (error) {
    console.log(`  REPAIRED but test-render still fails: ${error.message}`);
  }
}

console.log(
  `\n${corrupted} corrupted template(s)${apply ? " repaired" : " — rerun with --apply to fix"}`
);
