"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import {
  ArrowRight,
  Cloud,
  Mail,
  Shield,
  UserPlus,
  Workflow,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { DocsLayout } from "@/components/docs-layout";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
} from "@/components/ui/shadcn-io/code-block";
import {
  Snippet,
  SnippetCopyButton,
  SnippetHeader,
  SnippetTabsContent,
  SnippetTabsList,
  SnippetTabsTrigger,
} from "@/components/ui/shadcn-io/snippet";

// ── Install ─────────────────────────────────────────────────────────

const installCommands = {
  npm: "npm install @wraps.dev/better-auth",
  pnpm: "pnpm add @wraps.dev/better-auth",
  yarn: "yarn add @wraps.dev/better-auth",
  bun: "bun add @wraps.dev/better-auth",
};

// ── Code Examples ───────────────────────────────────────────────────

const quickStartCode = `import { betterAuth } from 'better-auth';
import { wraps } from '@wraps.dev/better-auth';

export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  plugins: [
    wraps({
      // Contact sync — omit to disable
      apiKey: process.env.WRAPS_API_KEY,

      // Auth emails via your own SES account — omit to disable
      email: {
        from: 'Acme <auth@acme.com>',
        appName: 'Acme',
        brand: {
          logoUrl: 'https://acme.com/logo.png',
          primaryColor: '#4f46e5',
          supportEmail: 'help@acme.com',
        },
      },
    }),
  ],
});`;

const sendersCode = `import { wrapsAuthEmails } from '@wraps.dev/better-auth';
import { emailOTP, magicLink, organization } from 'better-auth/plugins';

const emails = wrapsAuthEmails({
  from: 'Acme <auth@acme.com>',
  appName: 'Acme',
  appUrl: 'https://app.acme.com', // builds the invitation link
});

export const auth = betterAuth({
  plugins: [
    magicLink({ sendMagicLink: emails.magicLink }),
    emailOTP({ sendVerificationOTP: emails.otp }),
    organization({ sendInvitationEmail: emails.invitation }),
  ],
});`;

const credentialsCode = `wraps({
  email: {
    from: 'auth@acme.com',
    ses: {
      region: 'us-east-1',
      // OIDC role assumption on Vercel or GitHub Actions
      roleArn: 'arn:aws:iam::123456789012:role/AcmeMail',
    },
  },
});`;

const templateOverrideCode = `wraps({
  email: {
    from: 'auth@acme.com',
    templates: {
      verification: ({ user, url, appName }) => ({
        subject: \`Confirm your \${appName} account\`,
        html: renderMyEmail({ user, url }),
        text: \`Confirm your email: \${url}\`,
      }),
    },
  },
});`;

const syncRequestsCode = `POST /v1/contacts/
{
  "externalId": "K3mQx...",      // the better-auth user id
  "email": "ada@example.com",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "emailStatus": "active"
}

POST /v1/events/
{
  "name": "user.signed_up",
  "contactId": "con_...",
  "properties": { "method": "oauth", "provider": "google", "source": "better-auth" }
}`;

const topicsCode = `wraps({
  apiKey: process.env.WRAPS_API_KEY,
  // Only set this when your signup form actually asks for consent.
  topicSlugs: ['product-updates'],
});`;

const optionsCode = `wraps({
  // --- contact sync ---
  apiKey: process.env.WRAPS_API_KEY,
  baseUrl: 'https://api.wraps.dev',
  eventName: 'user.signed_up',        // or false to skip the event
  topicSlugs: [],
  emailStatus: 'active',
  properties: (user) => ({ plan: 'free' }),
  shouldSync: (user) => !user.email.endsWith('@internal.acme.com'),
  syncOnUpdate: true,                 // patch the contact on email/name change
  syncOnDelete: false,                // or 'unsubscribe' | 'delete'

  // --- auth emails ---
  email: {
    from: 'Acme <auth@acme.com>',
    appName: 'Acme',
    appUrl: 'https://app.acme.com',
    replyTo: 'support@acme.com',
    configurationSetName: 'acme-auth',
    brand: { logoUrl, primaryColor, supportEmail, footerText },
    templates: { /* per-template overrides */ },
    ses: { /* region, credentials, roleArn, client */ },
  },

  // --- behaviour ---
  waitUntil: (promise) => ctx.waitUntil(promise),
  onContactSynced: ({ userId, contactId, created }) => {},
  onError: (error, { stage }) => logger.warn({ error, stage }),
});`;

const waitUntilCode = `import { waitUntil } from '@vercel/functions';

wraps({
  apiKey: process.env.WRAPS_API_KEY,
  waitUntil,
});`;

const errorCode = `wraps({
  apiKey: process.env.WRAPS_API_KEY,
  onError: (error, { stage, user }) => {
    // stage is 'contact' | 'event' | 'email'
    logger.warn({ err: error, stage, userId: user?.id }, 'wraps sync failed');
  },
});`;

const clientCode = `import { createAuthClient } from 'better-auth/client';
import { wrapsClient } from '@wraps.dev/better-auth/client';

export const authClient = createAuthClient({
  plugins: [wrapsClient()],
});`;

function Example({
  code,
  filename,
  language = "typescript",
}: {
  code: string;
  filename: string;
  language?: string;
}) {
  return (
    <CodeBlock
      className="h-auto"
      data={[{ language, filename, code }]}
      defaultValue={language}
    >
      <CodeBlockHeader>
        <CodeBlockFiles>
          {(item) => (
            <CodeBlockFilename key={item.language} value={item.language}>
              {item.filename}
            </CodeBlockFilename>
          )}
        </CodeBlockFiles>
        <CodeBlockCopyButton />
      </CodeBlockHeader>
      <CodeBlockBody>
        {(item) => (
          <CodeBlockItem
            key={item.language}
            lineNumbers={false}
            value={item.language}
          >
            <CodeBlockContent language={item.language}>
              {item.code}
            </CodeBlockContent>
          </CodeBlockItem>
        )}
      </CodeBlockBody>
    </CodeBlock>
  );
}

export default function BetterAuthPageContent() {
  return (
    <DocsLayout>
      {/* Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Guide
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">Better Auth</h1>
        <p className="text-lg text-muted-foreground">
          Turn signups into contacts, and send every auth email from your own
          AWS SES account. One plugin, two halves — use either on its own.
        </p>
      </div>

      {/* What it does */}
      <section className="mb-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-primary" />
                Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                New users become Wraps contacts and fire a{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  user.signed_up
                </code>{" "}
                event, so your welcome sequences and onboarding workflows run.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Send
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Drop-in senders for verification, password reset, magic link,
                OTP, and org invites — delivered through your SES account. No
                Wraps account needed for this half.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Installation */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Installation</h2>
        <p className="mb-4 text-muted-foreground">
          Install the plugin alongside Better Auth 1.6 or later.
        </p>
        <Snippet defaultValue="npm">
          <SnippetHeader>
            <SnippetTabsList>
              <SnippetTabsTrigger value="npm">npm</SnippetTabsTrigger>
              <SnippetTabsTrigger value="pnpm">pnpm</SnippetTabsTrigger>
              <SnippetTabsTrigger value="yarn">yarn</SnippetTabsTrigger>
              <SnippetTabsTrigger value="bun">bun</SnippetTabsTrigger>
            </SnippetTabsList>
            <SnippetCopyButton value={installCommands.npm} />
          </SnippetHeader>
          {Object.entries(installCommands).map(([key, command]) => (
            <SnippetTabsContent key={key} value={key}>
              {command}
            </SnippetTabsContent>
          ))}
        </Snippet>
        <p className="mt-4 text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5">
            @wraps.dev/email
          </code>{" "}
          is an optional peer dependency, needed only for the email half.
        </p>
      </section>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Quick Start</h2>
        <p className="mb-4 text-muted-foreground">
          Add the plugin to your Better Auth config. That is the whole setup —
          new users sync, and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            sendVerificationEmail
          </code>
          ,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            sendResetPassword
          </code>
          , and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            onPasswordReset
          </code>{" "}
          are wired for you.
        </p>
        <Example code={quickStartCode} filename="auth.ts" />
        <div className="mt-6 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Your config always wins</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Better Auth merges plugin options underneath your own. If you
            already define{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              sendVerificationEmail
            </code>
            , the plugin leaves it alone — the senders it supplies are defaults
            that fill gaps. It also never sets{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              emailAndPassword.enabled
            </code>
            , so configuring the email half cannot switch on password auth for
            an app that did not ask for it.
          </p>
        </div>
      </section>

      {/* Auth Emails */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Auth Emails</h2>
        <p className="mb-4 text-muted-foreground">
          The plugin fills in the senders it can reach on its own. Magic link,
          OTP, and organisation invites belong to other Better Auth plugins, so
          build the senders once and pass them in.
        </p>
        <Example code={sendersCode} filename="auth.ts" />

        <h3 className="mt-8 mb-3 font-medium text-lg">AWS credentials</h3>
        <p className="mb-4 text-muted-foreground">
          Credentials follow the standard{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            @wraps.dev/email
          </code>{" "}
          resolution chain. With nothing set, the AWS credential chain resolves
          as usual — environment variables, shared config, or an instance role.
        </p>
        <Example code={credentialsCode} filename="auth.ts" />

        <h3 className="mt-8 mb-3 font-medium text-lg">Custom templates</h3>
        <p className="mb-4 text-muted-foreground">
          The bundled templates are plain HTML with no React dependency, and
          carry no Wraps branding — they read as coming from your app. Override
          any of them.
        </p>
        <Example code={templateOverrideCode} filename="auth.ts" />
      </section>

      {/* Contact Sync */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Contact Sync</h2>
        <p className="mb-4 text-muted-foreground">
          On user creation the plugin upserts a contact, then fires the signup
          event so matching workflows run.
        </p>
        <Example
          code={syncRequestsCode}
          filename="requests.http"
          language="http"
        />
        <p className="mt-4 text-muted-foreground">
          If the email already belongs to a contact — a newsletter subscriber
          converting, say — the existing contact is patched instead of failing.{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            properties.method
          </code>{" "}
          records how they signed up:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">email</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">oauth</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">passkey</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">magic-link</code>, or{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">otp</code>.
        </p>
      </section>

      {/* Consent */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Consent and Topics</h2>
        <p className="mb-4 text-muted-foreground">
          New contacts are subscribed to <strong>no topics</strong> by default.
          A signup is a transactional relationship, not marketing consent —
          quietly adding every new account to a marketing list is how SES
          reputations get damaged.
        </p>
        <Example code={topicsCode} filename="auth.ts" />
      </section>

      {/* Options */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Options</h2>
        <Example code={optionsCode} filename="auth.ts" />
      </section>

      {/* Serverless */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Cloud className="h-6 w-6 text-primary" />
          Serverless and waitUntil
        </h2>
        <p className="mb-4 text-muted-foreground">
          Sync work is awaited by default. On Lambda the runtime freezes the
          moment the handler returns, so fire-and-forget background work never
          happens. Pass{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">waitUntil</code> when
          your platform has a real background primitive.
        </p>
        <Example code={waitUntilCode} filename="auth.ts" />
      </section>

      {/* Errors */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Shield className="h-6 w-6 text-primary" />
          Error Handling
        </h2>
        <p className="mb-4 text-muted-foreground">
          Every contact write and every send is wrapped. Failures go to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">onError</code> and
          stop there — a Wraps outage or an SES throttle cannot break a signup.
        </p>
        <Example code={errorCode} filename="auth.ts" />
      </section>

      {/* Every signup path */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Zap className="h-6 w-6 text-primary" />
          Every Signup Path Is Covered
        </h2>
        <p className="mb-4 text-muted-foreground">
          The plugin hangs off{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            databaseHooks.user.create.after
          </code>
          , not response-level{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">after</code> hooks.
          Better Auth skips{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">after</code> hooks on
          OAuth redirect responses, so a plugin that matches on{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">/callback/*</code>{" "}
          silently misses every Google and GitHub signup. Database hooks fire
          for all of them, including users created by an admin or by SCIM — and
          plugin hooks are additive, so your own{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">databaseHooks</code>{" "}
          still run.
        </p>
      </section>

      {/* Client */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Client Plugin (optional)</h2>
        <p className="mb-4 text-muted-foreground">
          Type inference only. Everything happens server-side and your API key
          never reaches the browser.
        </p>
        <Example code={clientCode} filename="auth-client.ts" />
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Workflow className="h-5 w-5 text-primary" />
                Building Workflows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Turn the <code>user.signed_up</code> event into a welcome
                sequence with delays, conditions, and channel cascades.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/workflows">
                  Build a workflow
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Domain Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Auth emails need a verified sending domain with DKIM. Set yours
                up before going live.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/domain-verification">
                  Verify a domain
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <h3 className="mb-2 font-bold text-xl">Need Help?</h3>
          <p className="mb-4 text-muted-foreground">
            If you run into any issues, check our GitHub discussions or open an
            issue.
          </p>
          <Button asChild>
            <a
              href="https://github.com/wraps-team/better-auth-wraps/issues"
              rel="noopener noreferrer"
              target="_blank"
            >
              Get Help
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </DocsLayout>
  );
}
