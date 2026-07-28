import {
  CreateEmailTemplateCommand,
  SESv2Client,
  TestRenderEmailTemplateCommand,
  UpdateEmailTemplateCommand,
} from "@aws-sdk/client-sesv2";
import { AUTH_SES_TEMPLATES, type AuthSesTemplate } from "./auth-templates.js";

export type ProvisionOutcome = {
  templateName: string;
  /** "render-skipped" still published — SES just could not confirm it renders. */
  status: "published" | "render-skipped" | "failed";
  detail?: string;
};

/**
 * Deliberately not `upsertSESTemplate` from @wraps/email. That one takes
 * explicit credentials because the platform assumes a role into someone else's
 * account, and its AccessDenied message tells the reader to run
 * `wraps platform update-role` — advice that is wrong for a self-hoster. Here
 * the caller already IS the account that owns SES, so the ambient chain is the
 * right identity and the remediation is different.
 */
function client(region: string): SESv2Client {
  return new SESv2Client({ region });
}

async function publish(
  region: string,
  template: AuthSesTemplate
): Promise<void> {
  const ses = client(region);
  const TemplateContent = {
    Subject: template.subject,
    Html: template.htmlPart,
    Text: template.textPart,
  };

  try {
    await ses.send(
      new CreateEmailTemplateCommand({
        TemplateName: template.templateName,
        TemplateContent,
      })
    );
  } catch (error) {
    const err = error as { name?: string };
    if (err.name !== "AlreadyExistsException") {
      throw error;
    }
    // Re-running deploy or upgrade is how an edited template ships.
    await ses.send(
      new UpdateEmailTemplateCommand({
        TemplateName: template.templateName,
        TemplateContent,
      })
    );
  }
}

/**
 * Ask SES to render what was just published.
 *
 * This is the point of publishing at deploy time rather than trusting the
 * source: SES's Handlebars dialect is not handlebars.js, so a `{{#if}}` or
 * triple stash that looks right in the file can still fail inside SES. Without
 * this the failure surfaces later as a RenderingFailure event on a real signup,
 * which nobody is watching.
 *
 * A permission or throttle error is NOT a template problem — older roles may
 * lack ses:TestRenderEmailTemplate — so it downgrades to "render-skipped"
 * rather than failing a template that published fine.
 */
async function confirmRenders(
  region: string,
  template: AuthSesTemplate
): Promise<ProvisionOutcome> {
  try {
    await client(region).send(
      new TestRenderEmailTemplateCommand({
        TemplateName: template.templateName,
        TemplateData: JSON.stringify(template.sampleData),
      })
    );
    return { templateName: template.templateName, status: "published" };
  } catch (error) {
    const err = error as { name?: string; message?: string };
    const message = err.message ?? "Unknown SES error";

    // AWS SDK v3 error names are unreliable — check the message too.
    if (err.name === "BadRequestException" || message.includes("BadRequest")) {
      return {
        templateName: template.templateName,
        status: "failed",
        detail: message,
      };
    }

    return {
      templateName: template.templateName,
      status: "render-skipped",
      detail: message,
    };
  }
}

/**
 * Publish every SES template the platform's own auth email addresses by name.
 *
 * On the SaaS platform these were created once by hand; nothing creates them in
 * a fresh account, so without this a self-hosted install has the entire send
 * path wired and still dies at the first signup on
 * `Template email-verification does not exist`.
 *
 * Idempotent, and never throws — one template's failure does not stop the rest,
 * and the caller decides how loudly to report.
 */
export async function provisionAuthTemplates(
  region: string
): Promise<ProvisionOutcome[]> {
  const outcomes: ProvisionOutcome[] = [];

  for (const template of AUTH_SES_TEMPLATES) {
    try {
      await publish(region, template);
    } catch (error) {
      outcomes.push({
        templateName: template.templateName,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    outcomes.push(await confirmRenders(region, template));
  }

  return outcomes;
}

/** Human-readable one-liner per outcome, shared by both deploy paths. */
export function describeProvisionOutcomes(outcomes: ProvisionOutcome[]): {
  published: ProvisionOutcome[];
  skipped: ProvisionOutcome[];
  failed: ProvisionOutcome[];
} {
  return {
    published: outcomes.filter((o) => o.status === "published"),
    skipped: outcomes.filter((o) => o.status === "render-skipped"),
    failed: outcomes.filter((o) => o.status === "failed"),
  };
}
