/**
 * Workflow Processor Worker
 *
 * SQS Lambda handler that processes workflow step executions.
 * Handles different step types and routes to next steps.
 */

import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { toPlainText } from "@react-email/render";
import {
  awsAccount,
  contact,
  contactTopic,
  db,
  eq,
  messageSend,
  organization,
  template,
  type WorkflowStep,
  type WorkflowStepConfig,
  type WorkflowTransition,
  workflow,
  workflowExecution,
  workflowStepExecution,
} from "@wraps/db";
import {
  generateSESTemplateName,
  transformVariablesForSes,
  upsertSESTemplate,
} from "@wraps/email";
import type { SQSEvent, SQSHandler } from "aws-lambda";
import { and, sql } from "drizzle-orm";
import Handlebars from "handlebars";

import { generateUnsubscribeToken } from "../lib/unsubscribe-token";

import { getCredentials } from "../services/credentials";
import {
  deleteScheduledStep,
  enqueueWorkflowStep,
  scheduleWaitTimeout,
  scheduleWorkflowStep,
  type WorkflowJob,
} from "../services/workflow-queue";

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const job: WorkflowJob = JSON.parse(record.body);

    try {
      switch (job.type) {
        case "execute":
          await processStep(job.executionId, job.stepId);
          break;
        case "resume":
          await resumeExecution(job.executionId, job.branch);
          break;
        case "trigger":
          await triggerWorkflow(
            job.workflowId,
            job.contactId,
            job.organizationId,
            job.eventData
          );
          break;
      }
    } catch (error) {
      console.error("Error processing workflow job:", error);
      throw error; // Re-throw to let SQS retry
    }
  }
};

/**
 * Trigger a new workflow execution for a contact
 */
async function triggerWorkflow(
  workflowId: string,
  contactId: string,
  organizationId: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  // Load workflow
  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, workflowId))
    .limit(1);

  if (!wf || wf.status !== "enabled") {
    console.log(`Workflow ${workflowId} not found or not enabled`);
    return;
  }

  // Check reentry delay for completed executions (only when reentry not allowed)
  if (
    !wf.allowReentry &&
    wf.reentryDelaySeconds &&
    wf.reentryDelaySeconds > 0
  ) {
    const recentlyCompleted = await db.query.workflowExecution.findFirst({
      where: and(
        eq(workflowExecution.workflowId, workflowId),
        eq(workflowExecution.contactId, contactId),
        eq(workflowExecution.status, "completed"),
        sql`${workflowExecution.completedAt} > NOW() - INTERVAL '${sql.raw(String(wf.reentryDelaySeconds))} seconds'`
      ),
    });

    if (recentlyCompleted) {
      console.log(
        `Skipping - contact ${contactId} completed workflow recently (reentry delay: ${wf.reentryDelaySeconds}s)`
      );
      return;
    }
  }

  // Check contact cooldown (any workflow in this org)
  if (wf.contactCooldownSeconds && wf.contactCooldownSeconds > 0) {
    const recentExecution = await db.query.workflowExecution.findFirst({
      where: and(
        eq(workflowExecution.organizationId, organizationId),
        eq(workflowExecution.contactId, contactId),
        sql`${workflowExecution.createdAt} > NOW() - INTERVAL '${sql.raw(String(wf.contactCooldownSeconds))} seconds'`
      ),
    });

    if (recentExecution) {
      console.log(
        `Skipping - contact ${contactId} in cooldown period (${wf.contactCooldownSeconds}s)`
      );
      return;
    }
  }

  // Check maxConcurrentExecutions limit
  if (wf.maxConcurrentExecutions && wf.maxConcurrentExecutions > 0) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workflowExecution)
      .where(
        and(
          eq(workflowExecution.workflowId, workflowId),
          sql`${workflowExecution.status} IN ('pending', 'active', 'paused', 'waiting')`
        )
      );

    if (count >= wf.maxConcurrentExecutions) {
      console.log(
        `Skipping - workflow ${workflowId} at max concurrent executions (${count}/${wf.maxConcurrentExecutions})`
      );
      return;
    }
  }

  // Find the trigger step to get the first connected step
  const steps = wf.steps as WorkflowStep[];
  const transitions = wf.transitions as WorkflowTransition[];

  const triggerStep = steps.find((s) => s.type === "trigger");
  if (!triggerStep) {
    console.error(`No trigger step found in workflow ${workflowId}`);
    return;
  }

  // Find the first step after trigger
  const firstTransition = transitions.find(
    (t) => t.fromStepId === triggerStep.id
  );
  const firstStepId = firstTransition?.toStepId;

  if (!firstStepId) {
    console.log(`No steps after trigger in workflow ${workflowId}`);
    return;
  }

  // Create execution record atomically
  // Uses ON CONFLICT DO NOTHING with partial unique index to prevent race conditions
  // when allowReentry=false. The index only applies to active statuses.
  const [execution] = await db
    .insert(workflowExecution)
    .values({
      workflowId,
      contactId,
      organizationId,
      allowReentry: wf.allowReentry, // Denormalized for partial unique index
      status: "active",
      currentStepId: firstStepId,
      triggerData: eventData ?? {},
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  // If no row returned, a conflict occurred (contact already in workflow)
  if (!execution) {
    console.log(
      `Skipping - contact ${contactId} already in workflow ${workflowId} (conflict)`
    );
    return;
  }

  // Update workflow stats
  await db
    .update(workflow)
    .set({
      totalExecutions: sql`${workflow.totalExecutions} + 1`,
      activeExecutions: sql`${workflow.activeExecutions} + 1`,
      lastTriggeredAt: new Date(),
    })
    .where(eq(workflow.id, workflowId));

  // Process first step
  await enqueueWorkflowStep({
    type: "execute",
    executionId: execution.id,
    stepId: firstStepId,
    organizationId,
  });
}

/**
 * Process a single workflow step
 */
async function processStep(executionId: string, stepId: string): Promise<void> {
  // Load execution with workflow and contact
  const execution = await db.query.workflowExecution.findFirst({
    where: eq(workflowExecution.id, executionId),
  });

  if (!execution) {
    console.error(`Execution ${executionId} not found`);
    return;
  }

  if (execution.status === "cancelled" || execution.status === "completed") {
    console.log(`Execution ${executionId} already ${execution.status}`);
    return;
  }

  // Load workflow
  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, execution.workflowId))
    .limit(1);

  if (!wf) {
    console.error(`Workflow ${execution.workflowId} not found`);
    return;
  }

  // Load contact
  const [contactRecord] = await db
    .select()
    .from(contact)
    .where(eq(contact.id, execution.contactId))
    .limit(1);

  if (!contactRecord) {
    console.error(`Contact ${execution.contactId} not found`);
    await failExecution(executionId, "Contact not found", stepId);
    return;
  }

  const steps = wf.steps as WorkflowStep[];
  const step = steps.find((s) => s.id === stepId);

  if (!step) {
    console.error(`Step ${stepId} not found in workflow`);
    await failExecution(executionId, `Step ${stepId} not found`, stepId);
    return;
  }

  // Atomic idempotency check and step execution creation
  // Uses ON CONFLICT to prevent race conditions with duplicate SQS messages
  const idempotencyKey = `${executionId}-${stepId}`;

  const [stepExec] = await db
    .insert(workflowStepExecution)
    .values({
      executionId,
      stepId,
      stepType: step.type,
      status: "executing",
      idempotencyKey,
      startedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: workflowStepExecution.idempotencyKey,
      set: {
        // Only update if not already completed (prevents re-execution)
        status: sql`CASE WHEN ${workflowStepExecution.status} = 'completed' THEN ${workflowStepExecution.status} ELSE 'executing' END`,
        startedAt: sql`CASE WHEN ${workflowStepExecution.status} = 'completed' THEN ${workflowStepExecution.startedAt} ELSE ${new Date().toISOString()}::timestamp END`,
      },
    })
    .returning();

  // If step was already completed, skip execution
  if (stepExec.status === "completed") {
    console.log(`Step ${stepId} already executed for ${executionId}`);
    return;
  }

  // Update execution current step
  await db
    .update(workflowExecution)
    .set({ currentStepId: stepId, status: "active", updatedAt: new Date() })
    .where(eq(workflowExecution.id, executionId));

  // Execute step based on type
  try {
    const result = await executeStep(
      step,
      execution,
      contactRecord,
      wf.organizationId
    );

    // Mark step as completed
    await db
      .update(workflowStepExecution)
      .set({
        status: "completed",
        branch: result.branch,
        result: result.data,
        completedAt: new Date(),
      })
      .where(eq(workflowStepExecution.id, stepExec.id));

    // Handle step result
    if (result.action === "next") {
      await processNextStep(execution, step, wf, result.branch);
    } else if (result.action === "wait") {
      // Step is waiting (e.g., delay scheduled, waiting for event)
      // Execution status already updated by the step handler
    } else if (result.action === "exit") {
      await completeExecution(executionId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Step ${stepId} failed:`, error);

    await db
      .update(workflowStepExecution)
      .set({
        status: "failed",
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(eq(workflowStepExecution.id, stepExec.id));

    await failExecution(executionId, errorMessage, stepId);
  }
}

/**
 * Execute a single step and return the result
 */
type WorkflowBranch =
  | "yes"
  | "no"
  | "timeout"
  | "default"
  | "opened"
  | "clicked"
  | "bounced";

async function executeStep(
  step: WorkflowStep,
  execution: typeof workflowExecution.$inferSelect,
  contactRecord: typeof contact.$inferSelect,
  organizationId: string
): Promise<{
  action: "next" | "wait" | "exit";
  branch?: WorkflowBranch;
  data?: Record<string, unknown>;
}> {
  const config = step.config;

  switch (config.type) {
    case "trigger":
      // Trigger is just an entry point, proceed to next
      return { action: "next" };

    case "send_email":
      return await handleSendEmail(
        config,
        execution,
        contactRecord,
        organizationId
      );

    case "send_sms":
      return await handleSendSms(
        config,
        execution,
        contactRecord,
        organizationId
      );

    case "delay":
      return await handleDelay(config, execution, step.id, organizationId);

    case "condition":
      return handleCondition(config, contactRecord, execution);

    case "update_contact":
      return await handleUpdateContact(config, contactRecord);

    case "webhook":
      return await handleWebhook(config, contactRecord, execution);

    case "wait_for_event":
      return await handleWaitForEvent(
        config,
        execution,
        step.id,
        organizationId
      );

    case "wait_for_email_engagement":
      return await handleWaitForEmailEngagement(
        config,
        execution,
        step.id,
        organizationId
      );

    case "subscribe_topic":
      return await handleSubscribeTopic(config, contactRecord);

    case "unsubscribe_topic":
      return await handleUnsubscribeTopic(config, contactRecord);

    case "exit":
      return { action: "exit" };

    default:
      throw new Error(
        `Unknown step type: ${(config as { type: string }).type}`
      );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleSendEmail(
  config: Extract<WorkflowStepConfig, { type: "send_email" }>,
  execution: typeof workflowExecution.$inferSelect,
  contactRecord: typeof contact.$inferSelect,
  organizationId: string
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  // Check contact has email
  if (!contactRecord.email) {
    console.log(
      `[workflow] Contact ${contactRecord.id} has no email, skipping`
    );
    return {
      action: "next",
      data: {
        skipped: true,
        reason: "no_email",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Check contact email status
  if (
    contactRecord.emailStatus === "unsubscribed" ||
    contactRecord.emailStatus === "bounced" ||
    contactRecord.emailStatus === "complained"
  ) {
    console.log(
      `[workflow] Contact ${contactRecord.id} has email status ${contactRecord.emailStatus}, skipping`
    );
    return {
      action: "next",
      data: {
        skipped: true,
        reason: `email_status_${contactRecord.emailStatus}`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Get the workflow to find the AWS account and sender defaults
  const [wf] = await db
    .select({
      awsAccountId: workflow.awsAccountId,
      defaultFrom: workflow.defaultFrom,
      defaultFromName: workflow.defaultFromName,
      defaultReplyTo: workflow.defaultReplyTo,
    })
    .from(workflow)
    .where(eq(workflow.id, execution.workflowId))
    .limit(1);

  if (!wf?.awsAccountId) {
    console.log(
      `[workflow] Workflow ${execution.workflowId} has no AWS account configured, skipping email`
    );
    return {
      action: "next",
      data: {
        skipped: true,
        reason: "no_aws_account",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Get AWS account region
  const [account] = await db
    .select({ region: awsAccount.region })
    .from(awsAccount)
    .where(eq(awsAccount.id, wf.awsAccountId))
    .limit(1);

  if (!account) {
    throw new Error(`AWS account ${wf.awsAccountId} not found`);
  }

  // Get template
  const [tmpl] = await db
    .select({
      id: template.id,
      name: template.name,
      subject: template.subject,
      compiledHtml: template.compiledHtml,
      emailType: template.emailType,
      sesTemplateName: template.sesTemplateName,
    })
    .from(template)
    .where(eq(template.id, config.templateId))
    .limit(1);

  if (!tmpl) {
    throw new Error(`Template ${config.templateId} not found`);
  }

  if (!tmpl.compiledHtml) {
    throw new Error(`Template ${config.templateId} has no compiled HTML`);
  }

  // Get organization for name
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  // Get credentials for customer's AWS account
  const credentials = await getCredentials(wf.awsAccountId);

  // Create SES client
  const sesClient = new SESv2Client({
    region: account.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  // Build variable replacement data
  const replacementData: Record<string, string> = {
    email: contactRecord.email,
    contactEmail: contactRecord.email,
  };

  const addIfPresent = (key: string, value: string | null | undefined) => {
    if (value) {
      replacementData[key] = value;
    }
  };

  addIfPresent("firstName", contactRecord.firstName);
  addIfPresent("lastName", contactRecord.lastName);
  addIfPresent("company", contactRecord.company);
  addIfPresent("jobTitle", contactRecord.jobTitle);
  addIfPresent("contactFirstName", contactRecord.firstName);
  addIfPresent("contactLastName", contactRecord.lastName);
  addIfPresent("contactCompany", contactRecord.company);
  addIfPresent("contactJobTitle", contactRecord.jobTitle);
  addIfPresent("organizationName", org?.name);

  // Add contact properties
  const properties = contactRecord.properties as Record<string, unknown> | null;
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      const strValue = value != null ? String(value) : null;
      if (strValue) {
        replacementData[key] = strValue;
      }
    }
  }

  // Add trigger data
  const triggerData = execution.triggerData as Record<string, unknown> | null;
  if (triggerData) {
    for (const [key, value] of Object.entries(triggerData)) {
      const strValue = value != null ? String(value) : null;
      if (strValue) {
        replacementData[key] = strValue;
      }
    }
  }

  // Generate unsubscribe URLs for marketing emails
  const isMarketing = tmpl.emailType === "marketing";
  const apiBaseUrl = process.env.API_BASE_URL || "https://api.wraps.dev";
  const appBaseUrl = process.env.APP_BASE_URL || "https://app.wraps.dev";

  let unsubscribeUrl: string | undefined;
  let preferencesUrl: string | undefined;

  if (isMarketing) {
    const unsubscribeToken = await generateUnsubscribeToken(
      contactRecord.id,
      organizationId
    );
    unsubscribeUrl = `${apiBaseUrl}/unsubscribe/${unsubscribeToken}`;
    preferencesUrl = `${appBaseUrl}/preferences/${unsubscribeToken}`;
    replacementData.unsubscribeUrl = unsubscribeUrl;
    replacementData.preferencesUrl = preferencesUrl;
  }

  // Build from address (step config > workflow default > fallback)
  const fromAddress =
    config.from ||
    wf.defaultFrom ||
    `noreply@${process.env.DEFAULT_DOMAIN || "wraps.dev"}`;
  const fromName = config.fromName || wf.defaultFromName;
  const fromDisplay = fromName ? `${fromName} <${fromAddress}>` : fromAddress;
  const replyTo = config.replyTo || wf.defaultReplyTo;

  // Build headers for marketing emails
  const headers: Array<{ Name: string; Value: string }> = [];
  if (isMarketing && unsubscribeUrl) {
    headers.push(
      { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>` },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }
    );
  }

  // Common email tags
  const emailTags = [
    { Name: "workflowId", Value: execution.workflowId },
    { Name: "executionId", Value: execution.id },
    { Name: "organizationId", Value: organizationId },
    { Name: "templateId", Value: config.templateId },
    { Name: "source", Value: "automation" },
  ];

  // Try to use SES template if available
  let sesTemplateName = tmpl.sesTemplateName;

  // Auto-publish if not published to SES (requires compiledHtml)
  if (!sesTemplateName && tmpl.compiledHtml) {
    sesTemplateName = await autoPublishTemplate(
      tmpl as {
        id: string;
        name: string;
        subject: string | null;
        compiledHtml: string;
      },
      credentials,
      account.region
    );
  }

  let result: { MessageId?: string };
  let subject: string;

  if (sesTemplateName) {
    // Use SES template - let SES handle variable substitution
    // Transform subject for SES (handles both simple vars and fallbacks)
    subject = sanitizeEmailSubject(tmpl.subject || "Message");

    result = await sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: fromDisplay,
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        Destination: {
          ToAddresses: [contactRecord.email],
        },
        Content: {
          Template: {
            TemplateName: sesTemplateName,
            TemplateData: JSON.stringify(replacementData),
          },
        },
        ConfigurationSetName: "wraps-email-tracking",
        EmailTags: emailTags,
        ListManagementOptions:
          isMarketing && headers.length > 0 ? undefined : undefined,
      })
    );

    console.log(
      `[workflow] Sent email via SES template ${sesTemplateName} to ${contactRecord.email}`
    );
  } else {
    // Fallback: Apply variable substitution locally and send raw HTML
    const html = substituteVariables(tmpl.compiledHtml, replacementData, {
      escapeHtml: true,
    });

    // Build subject with variable substitution
    const rawSubject = substituteVariables(
      tmpl.subject || "Message",
      replacementData
    );
    subject = sanitizeEmailSubject(rawSubject);

    result = await sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: fromDisplay,
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        Destination: {
          ToAddresses: [contactRecord.email],
        },
        Content: {
          Simple: {
            Subject: { Data: subject },
            Body: {
              Html: { Data: html },
              Text: { Data: htmlToPlainText(html) },
            },
            Headers: headers.length > 0 ? headers : undefined,
          },
        },
        ConfigurationSetName: "wraps-email-tracking",
        EmailTags: emailTags,
      })
    );

    console.log(`[workflow] Sent email via raw HTML to ${contactRecord.email}`);
  }

  const messageId = result.MessageId ?? "";

  // Record the send in messageSend table
  // Note: workflowExecutionId is not yet in schema, will be added later
  await db.insert(messageSend).values({
    organizationId,
    contactId: contactRecord.id,
    awsAccountId: wf.awsAccountId,
    channel: "email",
    sourceType: "workflow",
    recipient: contactRecord.email,
    subject,
    from: fromAddress,
    fromName: fromName || null,
    emailTemplateId: config.templateId,
    messageId,
    status: "sent",
    sentAt: new Date(),
  });

  // Update contact email metrics
  await db
    .update(contact)
    .set({
      lastEmailSentAt: new Date(),
      emailsSent: sql`COALESCE(${contact.emailsSent}, 0) + 1`,
    })
    .where(eq(contact.id, contactRecord.id));

  return {
    action: "next",
    data: {
      messageId,
      templateId: config.templateId,
      recipient: contactRecord.email,
      subject,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Substitute variables in text with values from a data object
 * Uses Handlebars to properly evaluate conditional syntax like:
 *   {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}
 *
 * This is needed because compiledHtml contains SES-compatible Handlebars syntax
 * from transformVariablesForSes, and workflow sends use direct HTML (not SES templates).
 *
 * Handlebars automatically escapes HTML in {{variable}} expressions for safety.
 *
 * @exported for testing
 */
export function substituteVariables(
  text: string,
  data: Record<string, string>,
  _options: { escapeHtml?: boolean } = {}
): string {
  try {
    // Compile and execute the Handlebars template
    const template = Handlebars.compile(text, { noEscape: false });
    return template(data);
  } catch (error) {
    // If Handlebars fails, fall back to simple regex replacement
    console.warn(
      "[workflow] Handlebars compilation failed, using fallback:",
      error
    );
    return text.replace(
      /\{\{\s*(?:contact\.)?([a-zA-Z0-9_]+)\s*\}\}/g,
      (_match, key) => {
        const value = data[key.trim()];
        return value ?? "";
      }
    );
  }
}

/**
 * Sanitize email subject line
 * - Removes newlines to prevent header injection
 * - Collapses whitespace
 * - Truncates to reasonable length (998 chars per RFC 2822)
 */
function sanitizeEmailSubject(subject: string): string {
  return subject
    .replace(/[\r\n]+/g, " ") // Remove newlines (header injection prevention)
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim()
    .slice(0, 998); // RFC 2822 max line length
}

/**
 * Convert HTML to plain text for email fallback
 * Uses react-email's toPlainText for robust HTML-to-text conversion
 */
function htmlToPlainText(html: string): string {
  return toPlainText(html);
}

/**
 * Auto-publish a template to SES if not already published.
 * Uses the existing compiledHtml from the template.
 * Returns the SES template name if successful, or null if publishing fails.
 */
async function autoPublishTemplate(
  tmpl: {
    id: string;
    name: string;
    subject: string | null;
    compiledHtml: string;
  },
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  },
  region: string
): Promise<string | null> {
  try {
    // 1. Transform variables for SES compatibility
    // compiledHtml already has {{contact.firstName}} format
    // We need to transform to {{contactFirstName}} format for SES
    // Also handles fallbacks: {{name|fallback}} → {{#if name}}{{name}}{{else}}fallback{{/if}}
    const sesHtml = transformVariablesForSes(tmpl.compiledHtml);
    const sesText = htmlToPlainText(sesHtml);
    const sesSubject = transformVariablesForSes(tmpl.subject || "Message");

    // 2. Generate template name and publish to SES
    const sesTemplateName = generateSESTemplateName(tmpl.id, tmpl.name);
    await upsertSESTemplate(credentials, region, {
      templateName: sesTemplateName,
      subject: sesSubject,
      htmlPart: sesHtml,
      textPart: sesText,
    });

    // 3. Update template in DB with SES template name
    await db
      .update(template)
      .set({
        sesTemplateName,
        publishedAt: new Date(),
      })
      .where(eq(template.id, tmpl.id));

    console.log(
      `[workflow] Auto-published template ${tmpl.id} as ${sesTemplateName}`
    );
    return sesTemplateName;
  } catch (error) {
    console.error("[workflow] Auto-publish failed:", error);
    return null; // Fall back to raw HTML
  }
}

/**
 * Validate phone number is in E.164 format
 * E.164: +[country code][subscriber number] (e.g., +15551234567)
 */
function isValidE164Phone(phone: string): boolean {
  // E.164 format: + followed by 10-15 digits
  const e164Regex = /^\+[1-9]\d{9,14}$/;
  return e164Regex.test(phone);
}

async function handleSendSms(
  config: Extract<WorkflowStepConfig, { type: "send_sms" }>,
  execution: typeof workflowExecution.$inferSelect,
  contactRecord: typeof contact.$inferSelect,
  _organizationId: string
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  // Get the contact's phone number
  if (!contactRecord.phone) {
    console.log(
      `[workflow] Contact ${contactRecord.id} has no phone number, skipping SMS`
    );
    return {
      action: "next",
      data: {
        skipped: true,
        reason: "no_phone",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Validate phone number format (E.164)
  if (!isValidE164Phone(contactRecord.phone)) {
    console.log(
      `[workflow] Contact ${contactRecord.id} has invalid phone format: ${contactRecord.phone}, skipping SMS`
    );
    return {
      action: "next",
      data: {
        skipped: true,
        reason: "invalid_phone_format",
        phone: contactRecord.phone,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Get the workflow to find the AWS account and sender defaults
  const [wf] = await db
    .select({
      awsAccountId: workflow.awsAccountId,
      defaultSenderId: workflow.defaultSenderId,
    })
    .from(workflow)
    .where(eq(workflow.id, execution.workflowId))
    .limit(1);

  if (!wf?.awsAccountId) {
    console.log(
      `[workflow] Workflow ${execution.workflowId} has no AWS account configured, skipping SMS`
    );
    return {
      action: "next",
      data: {
        skipped: true,
        reason: "no_aws_account",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Get the AWS account region
  const [account] = await db
    .select({ region: awsAccount.region })
    .from(awsAccount)
    .where(eq(awsAccount.id, wf.awsAccountId))
    .limit(1);

  if (!account) {
    throw new Error(`AWS account ${wf.awsAccountId} not found`);
  }

  // Get credentials for the customer's AWS account
  const credentials = await getCredentials(wf.awsAccountId);

  // Create Pinpoint SMS Voice V2 client with assumed credentials
  const smsClient = new PinpointSMSVoiceV2Client({
    region: account.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  // Build message body - use body from config or fetch from template
  const messageBody = config.body || "";
  if (!messageBody) {
    console.log("[workflow] SMS step has no message body configured, skipping");
    return {
      action: "next",
      data: {
        skipped: true,
        reason: "no_message_body",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Build sender ID (step config > workflow default)
  const senderId = config.senderId || wf.defaultSenderId;

  // Send SMS
  const command = new SendTextMessageCommand({
    DestinationPhoneNumber: contactRecord.phone,
    MessageBody: messageBody,
    ConfigurationSetName: "wraps-sms-config",
    MessageType: "TRANSACTIONAL",
    ...(senderId && { OriginationIdentity: senderId }),
  });

  const response = await smsClient.send(command);

  console.log(
    `[workflow] Sent SMS to ${contactRecord.phone}, messageId: ${response.MessageId}`
  );

  // Update contact SMS metrics
  await db
    .update(contact)
    .set({
      lastSmsSentAt: new Date(),
      smsSent: sql`COALESCE(${contact.smsSent}, 0) + 1`,
    })
    .where(eq(contact.id, contactRecord.id));

  return {
    action: "next",
    data: {
      messageId: response.MessageId,
      recipient: contactRecord.phone,
      body: messageBody,
      timestamp: new Date().toISOString(),
    },
  };
}

async function handleDelay(
  config: Extract<WorkflowStepConfig, { type: "delay" }>,
  execution: typeof workflowExecution.$inferSelect,
  stepId: string,
  organizationId: string
): Promise<{ action: "wait" }> {
  // Calculate delay in seconds
  let delaySeconds = config.amount;
  switch (config.unit) {
    case "minutes":
      delaySeconds *= 60;
      break;
    case "hours":
      delaySeconds *= 3600;
      break;
    case "days":
      delaySeconds *= 86_400;
      break;
    case "weeks":
      delaySeconds *= 604_800;
      break;
  }

  // Find the next step after delay
  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, execution.workflowId))
    .limit(1);

  const transitions = wf?.transitions as WorkflowTransition[] | undefined;
  const nextTransition = transitions?.find((t) => t.fromStepId === stepId);

  if (!nextTransition) {
    // No next step - complete execution
    await completeExecution(execution.id);
    return { action: "wait" };
  }

  // Schedule the next step
  const schedulerName = await scheduleWorkflowStep({
    executionId: execution.id,
    stepId: nextTransition.toStepId,
    organizationId,
    delaySeconds,
  });

  // Update execution status
  await db
    .update(workflowExecution)
    .set({
      status: "paused",
      nextStepScheduledAt: new Date(Date.now() + delaySeconds * 1000),
      delaySchedulerName: schedulerName,
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, execution.id));

  return { action: "wait" };
}

function handleCondition(
  config: Extract<WorkflowStepConfig, { type: "condition" }>,
  contactRecord: typeof contact.$inferSelect,
  execution: typeof workflowExecution.$inferSelect
): { action: "next"; branch: "yes" | "no" } {
  // Get the field value from contact properties
  const properties = contactRecord.properties as Record<string, unknown> | null;
  const triggerData = execution.triggerData as Record<string, unknown> | null;

  // Try contact fields first, then contact.properties, then trigger data
  let fieldValue: unknown;
  if (config.field in contactRecord) {
    fieldValue = contactRecord[config.field as keyof typeof contactRecord];
  } else if (properties && config.field in properties) {
    fieldValue = properties[config.field];
  } else if (triggerData && config.field in triggerData) {
    fieldValue = triggerData[config.field];
  }

  // Evaluate condition
  const conditionMet = evaluateCondition(
    fieldValue,
    config.operator,
    config.value
  );

  return {
    action: "next",
    branch: conditionMet ? "yes" : "no",
  };
}

function evaluateCondition(
  fieldValue: unknown,
  operator: string,
  compareValue: unknown
): boolean {
  const strFieldValue = String(fieldValue ?? "");
  const strCompareValue = String(compareValue ?? "");

  switch (operator) {
    case "equals":
      return strFieldValue === strCompareValue;
    case "not_equals":
      return strFieldValue !== strCompareValue;
    case "contains":
      return strFieldValue.includes(strCompareValue);
    case "not_contains":
      return !strFieldValue.includes(strCompareValue);
    case "starts_with":
      return strFieldValue.startsWith(strCompareValue);
    case "ends_with":
      return strFieldValue.endsWith(strCompareValue);
    case "greater_than":
      return Number(fieldValue) > Number(compareValue);
    case "less_than":
      return Number(fieldValue) < Number(compareValue);
    case "is_set":
      return (
        fieldValue !== null && fieldValue !== undefined && fieldValue !== ""
      );
    case "is_not_set":
      return (
        fieldValue === null || fieldValue === undefined || fieldValue === ""
      );
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

async function handleUpdateContact(
  config: Extract<WorkflowStepConfig, { type: "update_contact" }>,
  contactRecord: typeof contact.$inferSelect
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  const updates = config.updates || [];
  const currentProperties =
    (contactRecord.properties as Record<string, unknown>) || {};
  const newProperties = { ...currentProperties };

  for (const update of updates) {
    switch (update.operation) {
      case "set":
        newProperties[update.field] = update.value;
        break;
      case "unset":
        delete newProperties[update.field];
        break;
      case "increment":
        newProperties[update.field] =
          (Number(newProperties[update.field]) || 0) + Number(update.value);
        break;
      case "decrement":
        newProperties[update.field] =
          (Number(newProperties[update.field]) || 0) - Number(update.value);
        break;
      case "append": {
        const arr = Array.isArray(newProperties[update.field])
          ? newProperties[update.field]
          : [];
        (arr as unknown[]).push(update.value);
        newProperties[update.field] = arr;
        break;
      }
      case "remove":
        if (Array.isArray(newProperties[update.field])) {
          newProperties[update.field] = (
            newProperties[update.field] as unknown[]
          ).filter((v) => v !== update.value);
        }
        break;
    }
  }

  await db
    .update(contact)
    .set({ properties: newProperties, updatedAt: new Date() })
    .where(eq(contact.id, contactRecord.id));

  return {
    action: "next",
    data: { updatedFields: updates.map((u) => u.field) },
  };
}

async function handleWebhook(
  config: Extract<WorkflowStepConfig, { type: "webhook" }>,
  contactRecord: typeof contact.$inferSelect,
  execution: typeof workflowExecution.$inferSelect
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  const body = {
    contact: {
      id: contactRecord.id,
      email: contactRecord.email,
      properties: contactRecord.properties,
    },
    execution: {
      id: execution.id,
      workflowId: execution.workflowId,
      triggerData: execution.triggerData,
    },
    ...(config.body || {}),
  };

  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        ...(config.headers || {}),
      },
      body: config.method !== "GET" ? JSON.stringify(body) : undefined,
    });

    return {
      action: "next",
      data: {
        status: response.status,
        ok: response.ok,
      },
    };
  } catch (error) {
    console.error("Webhook failed:", error);
    return {
      action: "next",
      data: {
        error: error instanceof Error ? error.message : "Webhook failed",
      },
    };
  }
}

async function handleWaitForEvent(
  config: Extract<WorkflowStepConfig, { type: "wait_for_event" }>,
  execution: typeof workflowExecution.$inferSelect,
  stepId: string,
  organizationId: string
): Promise<{ action: "wait" }> {
  const timeoutSeconds = config.timeoutSeconds || 86_400; // Default 24 hours
  const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000);

  // Schedule timeout
  const schedulerName = await scheduleWaitTimeout({
    executionId: execution.id,
    stepId,
    organizationId,
    timeoutSeconds,
  });

  // Update execution to waiting state
  await db
    .update(workflowExecution)
    .set({
      status: "waiting",
      waitingForEvent: config.eventName,
      waitTimeoutAt: timeoutAt,
      waitTimeoutSchedulerName: schedulerName,
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, execution.id));

  return { action: "wait" };
}

async function handleWaitForEmailEngagement(
  config: Extract<WorkflowStepConfig, { type: "wait_for_email_engagement" }>,
  execution: typeof workflowExecution.$inferSelect,
  stepId: string,
  organizationId: string
): Promise<{ action: "wait" }> {
  const timeoutSeconds = config.timeoutSeconds || 259_200; // Default 3 days
  const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000);

  // Find the previous send_email step execution to get the message ID
  const previousStepExecs = await db
    .select()
    .from(workflowStepExecution)
    .where(
      and(
        eq(workflowStepExecution.executionId, execution.id),
        eq(workflowStepExecution.stepType, "send_email"),
        eq(workflowStepExecution.status, "completed")
      )
    )
    .orderBy(sql`${workflowStepExecution.completedAt} DESC`)
    .limit(1);

  const lastEmailStep = previousStepExecs[0];
  const messageId = lastEmailStep?.result
    ? (lastEmailStep.result as Record<string, unknown>).messageId
    : undefined;

  // Schedule timeout
  const schedulerName = await scheduleWaitTimeout({
    executionId: execution.id,
    stepId,
    organizationId,
    timeoutSeconds,
  });

  // Update execution to waiting state
  // We use 'email_engagement' as a special event name prefix
  await db
    .update(workflowExecution)
    .set({
      status: "waiting",
      waitingForEvent: `email_engagement:${messageId || "unknown"}`,
      waitTimeoutAt: timeoutAt,
      waitTimeoutSchedulerName: schedulerName,
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, execution.id));

  return { action: "wait" };
}

async function handleSubscribeTopic(
  config: Extract<WorkflowStepConfig, { type: "subscribe_topic" }>,
  contactRecord: typeof contact.$inferSelect
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  // Upsert contact-topic subscription
  await db
    .insert(contactTopic)
    .values({
      contactId: contactRecord.id,
      topicId: config.topicId,
      status: "subscribed",
      subscribedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [contactTopic.contactId, contactTopic.topicId],
      set: {
        status: "subscribed",
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
    });

  return {
    action: "next",
    data: {
      topicId: config.topicId,
      channel: config.channel,
      action: "subscribed",
    },
  };
}

async function handleUnsubscribeTopic(
  config: Extract<WorkflowStepConfig, { type: "unsubscribe_topic" }>,
  contactRecord: typeof contact.$inferSelect
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  // Update subscription to unsubscribe
  await db
    .update(contactTopic)
    .set({
      status: "unsubscribed",
      unsubscribedAt: new Date(),
    })
    .where(
      and(
        eq(contactTopic.contactId, contactRecord.id),
        eq(contactTopic.topicId, config.topicId)
      )
    );

  return {
    action: "next",
    data: {
      topicId: config.topicId,
      channel: config.channel,
      action: "unsubscribed",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION FLOW HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process the next step in the workflow
 */
async function processNextStep(
  execution: typeof workflowExecution.$inferSelect,
  currentStep: WorkflowStep,
  wf: typeof workflow.$inferSelect,
  branch?: WorkflowBranch
): Promise<void> {
  const transitions = wf.transitions as WorkflowTransition[];

  // Find matching transition
  let nextTransition: WorkflowTransition | undefined;

  if (branch) {
    // Look for transition with matching branch
    nextTransition = transitions.find(
      (t) => t.fromStepId === currentStep.id && t.condition?.branch === branch
    );
  }

  // Fallback to any transition from this step
  if (!nextTransition) {
    nextTransition = transitions.find(
      (t) => t.fromStepId === currentStep.id && !t.condition
    );
  }

  if (!nextTransition) {
    // No next step - complete execution
    await completeExecution(execution.id);
    return;
  }

  // Enqueue next step for processing
  await enqueueWorkflowStep({
    type: "execute",
    executionId: execution.id,
    stepId: nextTransition.toStepId,
    organizationId: wf.organizationId,
  });
}

/**
 * Resume a paused/waiting execution
 */
async function resumeExecution(
  executionId: string,
  branch: WorkflowBranch
): Promise<void> {
  const execution = await db.query.workflowExecution.findFirst({
    where: eq(workflowExecution.id, executionId),
  });

  if (!execution) {
    console.error(`Execution ${executionId} not found`);
    return;
  }

  if (execution.status !== "waiting") {
    console.log(
      `Execution ${executionId} not in waiting state (${execution.status})`
    );
    return;
  }

  // Load workflow
  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, execution.workflowId))
    .limit(1);

  if (!wf) {
    console.error(`Workflow ${execution.workflowId} not found`);
    return;
  }

  const steps = wf.steps as WorkflowStep[];
  const currentStep = steps.find((s) => s.id === execution.currentStepId);

  if (!currentStep) {
    console.error(`Current step ${execution.currentStepId} not found`);
    return;
  }

  // Clear wait state
  await db
    .update(workflowExecution)
    .set({
      status: "active",
      waitingForEvent: null,
      waitTimeoutAt: null,
      waitTimeoutSchedulerName: null,
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, executionId));

  // If it was a timeout, try to cancel the timeout scheduler
  if (branch !== "timeout" && execution.waitTimeoutSchedulerName) {
    await deleteScheduledStep(execution.waitTimeoutSchedulerName);
  }

  // Record step completion with branch
  await db
    .update(workflowStepExecution)
    .set({
      status: "completed",
      branch,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(workflowStepExecution.executionId, executionId),
        eq(workflowStepExecution.stepId, currentStep.id)
      )
    );

  // Process next step based on branch
  await processNextStep(execution, currentStep, wf, branch);
}

/**
 * Mark execution as completed
 */
async function completeExecution(executionId: string): Promise<void> {
  const [execution] = await db
    .update(workflowExecution)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, executionId))
    .returning();

  if (execution) {
    await db
      .update(workflow)
      .set({
        activeExecutions: sql`GREATEST(0, ${workflow.activeExecutions} - 1)`,
        completedExecutions: sql`${workflow.completedExecutions} + 1`,
      })
      .where(eq(workflow.id, execution.workflowId));
  }
}

/**
 * Mark execution as failed
 */
async function failExecution(
  executionId: string,
  error: string,
  stepId: string
): Promise<void> {
  const [execution] = await db
    .update(workflowExecution)
    .set({
      status: "failed",
      error,
      errorStepId: stepId,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, executionId))
    .returning();

  if (execution) {
    await db
      .update(workflow)
      .set({
        activeExecutions: sql`GREATEST(0, ${workflow.activeExecutions} - 1)`,
        failedExecutions: sql`${workflow.failedExecutions} + 1`,
      })
      .where(eq(workflow.id, execution.workflowId));
  }
}
