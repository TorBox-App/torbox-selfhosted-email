export const orgSettings = (slug: string) => `/${slug}/settings`;
export const orgBroadcasts = (slug: string) => `/${slug}/emails/broadcasts`;
export const orgBroadcast = (slug: string, batchId: string) =>
  `/${slug}/emails/broadcasts/${batchId}`;
export const orgSegments = (slug: string) => `/${slug}/segments`;
export const orgTopics = (slug: string) => `/${slug}/topics`;
export const orgAutomations = (slug: string) => `/${slug}/automations`;
export const orgAutomation = (slug: string, workflowId: string) =>
  `/${slug}/automations/${workflowId}`;
