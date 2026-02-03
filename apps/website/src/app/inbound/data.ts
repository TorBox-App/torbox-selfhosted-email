// Pipeline step data - icons are referenced by name, mapped in client components
export const pipelineSteps = [
  {
    id: "sender",
    label: "Sender",
    iconName: "Mail" as const,
    description: "Email arrives at your domain",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
  },
  {
    id: "ses",
    label: "SES",
    iconName: "Cloud" as const,
    description: "AWS receives and validates",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  {
    id: "s3",
    label: "S3",
    iconName: "HardDrive" as const,
    description: "Raw email stored securely",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  {
    id: "lambda",
    label: "Lambda",
    iconName: "Code2" as const,
    description: "Parse headers & attachments",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  {
    id: "eventbridge",
    label: "EventBridge",
    iconName: "Zap" as const,
    description: "Trigger webhooks & rules",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  {
    id: "app",
    label: "Your App",
    iconName: "Database" as const,
    description: "Process and respond",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
  },
];

export const useCases = [
  {
    id: "support",
    iconName: "Headphones" as const,
    title: "Support Inbox",
    description:
      "Auto-create tickets from customer emails. Route by subject, extract order IDs, and assign to teams.",
    code: `// EventBridge handler
const ticket = await linear.createIssue({
  title: email.subject,
  description: email.text,
  teamId: routeToTeam(email.from),
});`,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  {
    id: "orders",
    iconName: "Package" as const,
    title: "Order Processing",
    description:
      "Parse order confirmations, extract tracking numbers, and update your database automatically.",
    code: `// Parse order email
const tracking = extractTracking(email.html);
await db.orders.update({
  where: { email: email.from },
  data: { trackingNumber: tracking },
});`,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  {
    id: "tickets",
    iconName: "FileText" as const,
    title: "Email-to-Ticket",
    description:
      "Integrate with Jira, Linear, GitHub Issues, or any ticketing system via webhooks.",
    code: `// Create GitHub issue
await octokit.issues.create({
  owner: 'your-org',
  repo: 'support',
  title: email.subject,
  body: email.html,
});`,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  {
    id: "autorespond",
    iconName: "Mail" as const,
    title: "Auto-Responders",
    description:
      "Send acknowledgments, out-of-office replies, or follow-up sequences automatically.",
    code: `// Auto-acknowledge
await email.inbox.reply(emailId, {
  from: 'support@yourapp.com',
  html: \`Thanks for reaching out!
We'll respond within 24h.\`,
});`,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  {
    id: "leads",
    iconName: "Users" as const,
    title: "Lead Capture",
    description:
      "Extract contact information from inquiries and sync to your CRM or marketing automation.",
    code: `// Sync to CRM
await hubspot.contacts.create({
  email: email.from.address,
  firstname: email.from.name,
  source: 'inbound_email',
});`,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
  },
  {
    id: "documents",
    iconName: "MessageSquare" as const,
    title: "Document Processing",
    description:
      "Extract attachments, process PDFs, and trigger document workflows with S3 events.",
    code: `// Process attachments
for (const att of email.attachments) {
  const file = await email.inbox
    .getAttachment(emailId, att.id);
  await processDocument(file);
}`,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
  },
];

export const codeExamples = {
  list: {
    label: "List",
    filename: "list-emails.ts",
    code: `import { WrapsEmail } from '@wraps.dev/email';

const email = new WrapsEmail({
  inboundBucket: 'your-bucket-name',
});

// List recent inbound emails
const { emails, cursor } = await email.inbox.list({
  limit: 20,
  from: 'customer@example.com', // optional filter
});

for (const msg of emails) {
  console.log(\`\${msg.from.address}: \${msg.subject}\`);
}`,
  },
  get: {
    label: "Get",
    filename: "get-email.ts",
    code: `// Get full email details
const inbound = await email.inbox.get('inb_a1b2c3d4');

console.log('From:', inbound.from.name, inbound.from.address);
console.log('Subject:', inbound.subject);
console.log('HTML:', inbound.html);
console.log('Text:', inbound.text);

// Access attachments
for (const att of inbound.attachments) {
  console.log(\`Attachment: \${att.filename} (\${att.size} bytes)\`);
}

// Check spam/virus verdicts
if (inbound.spamVerdict === 'PASS') {
  // Safe to process
}`,
  },
  reply: {
    label: "Reply",
    filename: "reply-email.ts",
    code: `// Reply with proper threading headers
await email.inbox.reply('inb_a1b2c3d4', {
  from: 'support@yourapp.com',
  html: \`
    <p>Thanks for reaching out!</p>
    <p>We've received your message and will respond within 24 hours.</p>
    <p>Best,<br/>The Support Team</p>
  \`,
});

// Threading headers (In-Reply-To, References) are
// automatically set to maintain the email chain`,
  },
  forward: {
    label: "Forward",
    filename: "forward-email.ts",
    code: `// Forward to your team
await email.inbox.forward('inb_a1b2c3d4', {
  to: 'team@yourcompany.com',
  from: 'forwarding@yourapp.com',
  note: 'Please review this customer inquiry.',
});

// Original message and attachments are preserved`,
  },
  webhook: {
    label: "Webhook",
    filename: "eventbridge-handler.ts",
    code: `// EventBridge Lambda handler
export const handler = async (event: EventBridgeEvent) => {
  const email = event.detail;

  // Route based on recipient
  if (email.to[0].address.startsWith('support@')) {
    await createSupportTicket(email);
  } else if (email.to[0].address.startsWith('sales@')) {
    await notifySalesTeam(email);
  }

  // Process attachments
  if (email.attachments.length > 0) {
    await processAttachments(email);
  }

  return { statusCode: 200 };
};`,
  },
};

// Architecture nodes for server-side rendering
export const architectureNodesData = [
  {
    id: "ses",
    label: "SES Receipt",
    sublabel: "MX Records",
    iconName: "Cloud" as const,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  {
    id: "s3",
    label: "S3 Bucket",
    sublabel: "Raw Storage",
    iconName: "HardDrive" as const,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  {
    id: "lambda",
    label: "Lambda",
    sublabel: "Parser",
    iconName: "Code2" as const,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  {
    id: "eventbridge",
    label: "EventBridge",
    sublabel: "Webhooks",
    iconName: "Zap" as const,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
];

export type PipelineStep = (typeof pipelineSteps)[number];
export type UseCase = (typeof useCases)[number];
export type CodeExample = (typeof codeExamples)[keyof typeof codeExamples];
export type ArchitectureNode = (typeof architectureNodesData)[number];

// Icon name types for mapping
export type IconName =
  | "Mail"
  | "Cloud"
  | "HardDrive"
  | "Code2"
  | "Zap"
  | "Database"
  | "Headphones"
  | "Package"
  | "FileText"
  | "Users"
  | "MessageSquare";
