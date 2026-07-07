// Core email client

// Event feed staleness alert
export type {
  EventFeedStaleContent,
  SendEventFeedStaleEmailParams,
} from "./emails/event-feed-stale";
export {
  buildEventFeedStaleEmail,
  sendEventFeedStaleEmail,
} from "./emails/event-feed-stale";
export type { SendEmailParams } from "./lib/client";
export { getWrapsClient, sendEmail } from "./lib/client";

// Confirmation tokens
export type { ConfirmationTokenPayload } from "./lib/confirmation-token";
export {
  generateConfirmationToken,
  generateConfirmationUrl,
  verifyConfirmationToken,
} from "./lib/confirmation-token";
// SES templates
export type {
  SESCredentials,
  SESTemplateParams,
  SESTestRenderOutcome,
} from "./lib/ses-templates";
export {
  deleteSESTemplate,
  generateSESTemplateName,
  templateExists,
  testRenderSESTemplate,
  upsertSESTemplate,
} from "./lib/ses-templates";
// SES variable transformation
export {
  flattenVariablesForSes,
  toSesVariableName,
  transformVariablesForSes,
} from "./lib/ses-variables";
// Subscription service
export type {
  CreateSubscriptionParams,
  CreateSubscriptionResult,
} from "./lib/subscription-service";
export {
  determineSubscriptionStatus,
  sendTopicConfirmationEmail,
} from "./lib/subscription-service";
