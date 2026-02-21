---
name: email-templates
description: Work with email template system using TipTap, React Email, and AWS SES. Use when editing or creating email templates.
---

# Email Templates Skill

You are an expert at working with the email template system built on TipTap, React Email, and AWS SES.

## Architecture

1. **Editor**: TipTap with custom extensions (variables, conditionals)
2. **Storage**: TipTap JSON in PostgreSQL JSONB
3. **Rendering**: TipTap → React Email → HTML/Text
4. **Sending**: AWS SES with Handlebars templating

## Variable System

### Available Variables

**Contact Context**:
- `{{contact.email}}`, `{{contact.firstName}}`, `{{contact.lastName}}`
- `{{contact.company}}`, `{{contact.jobTitle}}`

**System Variables**:
- `{{unsubscribeUrl}}` - One-click unsubscribe (RFC 8058)
- `{{preferencesUrl}}` - Email preferences center

**Organization**:
- `{{organization.name}}`

**Topic Context** (for confirmations):
- `{{topic.name}}`, `{{topic.description}}`
- `{{confirmationUrl}}` - REQUIRED for double opt-in

### Variable Syntax

```html
<!-- Simple variable -->
{{contact.firstName}}

<!-- With fallback -->
{{contact.firstName|there}}
<!-- Renders as "John" or "there" if empty -->
```

### SES Variable Transformation

SES uses flat variable names. The system automatically transforms:

```typescript
// Editor format → SES format
"{{contact.firstName}}" → "{{contactFirstName}}"
"{{contact.firstName|there}}" → "{{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}"
```

**Location**: `@wraps/email` package (exported from `packages/email/`)

## Unsubscribe Links

### Required for Marketing Emails

```typescript
// Generate unsubscribe URL
const url = await generateUnsubscribeUrl(contactId, orgId, topicId?);
// Result: https://api.wraps.dev/unsubscribe/{jwt-token}
```

### Token Structure
```typescript
type UnsubscribeTokenPayload = {
  cid: string;  // contactId
  oid: string;  // organizationId
  tid?: string; // topicId (optional, for topic-specific unsubscribe)
  type: "unsub";
};
```

## Template Rendering Pipeline

### 1. TipTap to React Email
```typescript
import { tiptapToReactEmail } from "@/lib/serializers/tiptap-to-react-email";

const component = tiptapToReactEmail(
  templateContent,  // TipTap JSON
  testData,         // Variables for preview
  {
    keepVariablesAsPlaceholders: true, // For SES
    previewText: "Preview text here",
    brandKit: { primaryColor: "#000" },
  }
);
```

### 2. React Email to HTML
```typescript
import { render } from "@react-email/render";

const html = await render(component);
const text = toPlainText(html);
```

### 3. SES Variable Transform
```typescript
import { transformVariablesForSes } from "@wraps/email";

const sesHtml = transformVariablesForSes(html);
const sesSubject = transformVariablesForSes(subject);
```

## Publishing to SES

```typescript
// apps/web/src/app/api/.../publish/route.ts

// 1. Render template with keepVariablesAsPlaceholders: true
// 2. Transform variables for SES
// 3. Create/update SES template
await upsertSESTemplate(credentials, region, {
  templateName: "wraps-template-name",
  subject: sesSubject,
  htmlPart: sesHtml,
  textPart: sesText,
});

// 4. Update DB
await db.update(template).set({
  status: "PUBLISHED",
  sesTemplateName,
  publishedAt: new Date(),
});
```

## Sending Emails

```typescript
import { WrapsEmail } from "@wraps.dev/email";

const wraps = new WrapsEmail({
  region: "us-east-1",
  roleArn: process.env.WRAPS_EMAIL_ROLE_ARN,
});

await wraps.send({
  from: "noreply@example.com",
  to: "recipient@example.com",
  subject: "Subject with {{contactFirstName}}",
  html: sesFormattedHtml,
  text: sesFormattedText,
  templateData: {
    contactFirstName: "John",
    contactEmail: "john@example.com",
    unsubscribeUrl: "https://...",
  },
});
```

## Template Types

| Type | Unsubscribe Required | Use Case |
|------|---------------------|----------|
| `marketing` | Yes | Newsletters, promotions |
| `transactional` | No | Order confirmations, receipts |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/[org]/emails/templates` | GET/POST | List/create templates |
| `/api/[org]/emails/templates/[id]` | GET/PUT/DELETE | CRUD |
| `/api/[org]/emails/templates/[id]/publish` | POST/DELETE | Publish/unpublish |
| `/api/[org]/emails/templates/[id]/send-test` | POST | Send test email |

## Key Files

| File | Purpose |
|------|---------|
| `lib/serializers/tiptap-to-react-email.tsx` | TipTap → React Email |
| `@wraps/email` (`transformVariablesForSes`) | Variable transformation |
| `lib/unsubscribe-token.ts` | JWT tokens |
| `components/template-editor/` | Editor UI |
| `components/template-editor/variables/variable-definitions.ts` | Available variables |

## Common Mistakes

1. **Forgetting unsubscribe link** in marketing emails
2. **Using dot notation in SES** - transform first!
3. **Not handling fallbacks** - empty variables show nothing
4. **Missing confirmationUrl** in double opt-in templates
