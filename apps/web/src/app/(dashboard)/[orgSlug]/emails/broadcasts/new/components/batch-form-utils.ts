import type {
  AudienceType,
  BatchSendWithMeta,
  ContentType,
  VariableMapping,
} from "@/lib/batch";

export type ScheduleType = "now" | "later";

export type CampaignData = {
  name: string;
  subject: string;
  previewText: string;
  fromPrefix: string;
  fromDomain: string;
  fromName: string;
  replyTo: string;
  awsAccountId: string;
  contentType: ContentType;
  templateId: string;
  htmlContent: string;
  variableMappings: VariableMapping[];
  audienceType: AudienceType;
  topicId: string;
  segmentId: string;
  scheduleType: ScheduleType;
  scheduledDate: Date | undefined;
  scheduledTime: string;
};

export function mapBatchToCampaignData(
  batch: BatchSendWithMeta
): Partial<CampaignData> {
  const result: Partial<CampaignData> = {
    contentType: batch.templateId ? "template" : "html",
    scheduleType: "now",
  };

  if (batch.name) result.name = batch.name;
  if (batch.subject) result.subject = batch.subject;
  if (batch.previewText) result.previewText = batch.previewText;
  if (batch.fromName) result.fromName = batch.fromName;
  if (batch.replyTo) result.replyTo = batch.replyTo;
  if (batch.templateId) result.templateId = batch.templateId;
  if (batch.awsAccount?.id) result.awsAccountId = batch.awsAccount.id;

  if (batch.from?.includes("@")) {
    const [prefix, domain] = batch.from.split("@");
    if (prefix) result.fromPrefix = prefix;
    if (domain) result.fromDomain = domain;
  }

  return result;
}
