import * as Sentry from "@sentry/aws-serverless";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  includeLocalVariables: true,
  enableLogs: true,

  integrations: [nodeProfilingIntegration()],
  profilesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
