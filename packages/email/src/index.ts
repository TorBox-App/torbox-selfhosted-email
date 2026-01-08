// Core email client
export type { SendEmailParams } from "./lib/client";
export { getWrapsClient, sendEmail } from "./lib/client";

// Confirmation tokens
export type { ConfirmationTokenPayload } from "./lib/confirmation-token";
export {
  generateConfirmationToken,
  generateConfirmationUrl,
  verifyConfirmationToken,
} from "./lib/confirmation-token";

// Subscription service
export type {
  CreateSubscriptionParams,
  CreateSubscriptionResult,
} from "./lib/subscription-service";
export {
  determineSubscriptionStatus,
  sendTopicConfirmationEmail,
} from "./lib/subscription-service";

// SES templates
export type { SESCredentials, SESTemplateParams } from "./lib/ses-templates";
export {
  generateSESTemplateName,
  upsertSESTemplate,
  deleteSESTemplate,
  templateExists,
} from "./lib/ses-templates";

// SES variable transformation
export {
  toSesVariableName,
  transformVariablesForSes,
  flattenVariablesForSes,
} from "./lib/ses-variables";
