// Core email client
export type { SendEmailParams } from "./lib/client";
export { getWrapsClient, sendEmail } from "./lib/client";

// Confirmation tokens
export type { ConfirmationTokenPayload } from "./lib/confirmation-token";
export {
  generateConfirmationToken,
  verifyConfirmationToken,
  generateConfirmationUrl,
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
