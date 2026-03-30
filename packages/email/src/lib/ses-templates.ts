import {
  CreateEmailTemplateCommand,
  DeleteEmailTemplateCommand,
  GetEmailTemplateCommand,
  SESv2Client,
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
    await ses.send(
      new GetEmailTemplateCommand({ TemplateName: templateName })
    );
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
    const err = error as { name?: string };
    if (err.name === "AlreadyExistsException") {
      await ses.send(
        new UpdateEmailTemplateCommand({
          TemplateName: templateName,
          TemplateContent: templateContent,
        })
      );
    } else {
      throw error;
    }
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
