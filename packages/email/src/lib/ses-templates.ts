import {
  CreateEmailTemplateCommand,
  DeleteEmailTemplateCommand,
  GetEmailTemplateCommand,
  SESv2Client,
  TestRenderEmailTemplateCommand,
  UpdateEmailTemplateCommand,
} from "@aws-sdk/client-sesv2";

/**
 * AWS credentials for SES operations
 */
export type SESCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type SESTemplateParams = {
  templateName: string;
  subject: string;
  htmlPart: string;
  textPart: string;
};

/**
 * Creates an SESv2 client using provided credentials.
 * Uses SESv2 (JSON protocol) to avoid XML entity expansion limits in v1.
 */
function createSESClient(
  credentials: SESCredentials,
  region: string
): SESv2Client {
  return new SESv2Client({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
}

/**
 * Check if a template exists in SES
 */
export async function templateExists(
  credentials: SESCredentials,
  region: string,
  templateName: string
): Promise<boolean> {
  const ses = createSESClient(credentials, region);

  try {
    await ses.send(new GetEmailTemplateCommand({ TemplateName: templateName }));
    return true;
  } catch (error) {
    const err = error as { name?: string };
    if (err.name === "NotFoundException") {
      return false;
    }
    throw error;
  }
}

/**
 * Creates or updates an SES template in the customer's AWS account
 */
export async function upsertSESTemplate(
  credentials: SESCredentials,
  region: string,
  params: SESTemplateParams
): Promise<void> {
  const ses = createSESClient(credentials, region);
  const { templateName, subject, htmlPart, textPart } = params;

  const templateContent = {
    Subject: subject,
    Html: htmlPart,
    Text: textPart,
  };

  // Try create first, fall back to update if it already exists
  try {
    await ses.send(
      new CreateEmailTemplateCommand({
        TemplateName: templateName,
        TemplateContent: templateContent,
      })
    );
  } catch (error) {
    const err = error as { name?: string; message?: string };
    if (err.name === "AlreadyExistsException") {
      await ses.send(
        new UpdateEmailTemplateCommand({
          TemplateName: templateName,
          TemplateContent: templateContent,
        })
      );
    } else if (
      err.name === "AccessDeniedException" ||
      err.message?.includes("is not authorized to perform")
    ) {
      throw new Error(
        "Your IAM role is missing SESv2 template permissions. " +
          "Update your role by re-deploying the CloudFormation stack from the Wraps dashboard, " +
          "or run: wraps platform update-role"
      );
    } else {
      throw error;
    }
  }
}

export type SESTestRenderOutcome =
  | { status: "ok" }
  | { status: "render-failed"; reason: string }
  | { status: "skipped"; reason: string };

/**
 * Smoke-check that SES can actually render a just-published template.
 *
 * SES's Handlebars dialect is not handlebars.js — a template our local
 * renderer accepts can still hard-fail in SES at send time, which surfaces
 * as a RenderingFailure event and silent non-delivery. Calling
 * TestRenderEmailTemplate at publish time turns that into an immediate,
 * fixable error.
 *
 * Outcomes:
 * - "ok"            — SES rendered the template with the given data
 * - "render-failed" — SES rejected the template (BadRequestException);
 *                     the caller should fail the publish
 * - "skipped"       — permission or transient API error; the check could
 *                     not run. Callers should log and continue: older
 *                     customer roles may lack ses:TestRenderEmailTemplate,
 *                     and a throttle must not block publishing.
 */
export async function testRenderSESTemplate(
  credentials: SESCredentials,
  region: string,
  params: { templateName: string; templateData: Record<string, string> }
): Promise<SESTestRenderOutcome> {
  const ses = createSESClient(credentials, region);

  try {
    await ses.send(
      new TestRenderEmailTemplateCommand({
        TemplateName: params.templateName,
        TemplateData: JSON.stringify(params.templateData),
      })
    );
    return { status: "ok" };
  } catch (error) {
    const err = error as { name?: string; message?: string };
    const message = err.message ?? "Unknown SES error";

    // BadRequestException is SES's "this template cannot render" signal
    // (AWS SDK v3 error names are unreliable — check the message too).
    if (
      err.name === "BadRequestException" ||
      message.includes("BadRequest") ||
      message.includes("Attribute")
    ) {
      return { status: "render-failed", reason: message };
    }

    if (
      err.name === "AccessDeniedException" ||
      message.includes("is not authorized to perform")
    ) {
      return {
        status: "skipped",
        reason:
          "IAM role is missing ses:TestRenderEmailTemplate — run: wraps platform update-role",
      };
    }

    return { status: "skipped", reason: message };
  }
}

/**
 * Deletes an SES template from the customer's AWS account
 */
export async function deleteSESTemplate(
  credentials: SESCredentials,
  region: string,
  templateName: string
): Promise<void> {
  const ses = createSESClient(credentials, region);

  try {
    await ses.send(
      new DeleteEmailTemplateCommand({
        TemplateName: templateName,
      })
    );
  } catch (error) {
    const err = error as { name?: string };
    if (err.name === "NotFoundException") {
      return;
    }
    throw error;
  }
}

/**
 * Generates a consistent SES template name from a Wraps template name
 */
export function generateSESTemplateName(
  _templateId: string,
  templateName: string
): string {
  // Sanitize the template name for SES (alphanumeric, hyphens, underscores only)
  // SES template names can be up to 64 characters
  return templateName
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .substring(0, 64);
}
