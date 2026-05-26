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
  ArrowLeft,
  Check,
  Clock,
  Database,
  Globe,
  Key,
  Server,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { CLICommand } from "@/components/docs/cli-command";
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

const envVarsExample = `DATABASE_URL=postgres://user:pass@your-db.neon.tech/wraps
NEXT_PUBLIC_APP_URL=https://dashboard.yourdomain.com
NEXT_PUBLIC_API_URL=https://abc123.lambda-url.us-east-1.on.aws
CORS_ORIGIN=https://dashboard.yourdomain.com
BETTER_AUTH_SECRET=<generated-secret>
UNSUBSCRIBE_SECRET=<generated-secret>
WRAPS_LICENSE_KEY=v1.scale.2027-01-01.<fingerprint>
AWS_BACKEND_ACCOUNT_ID=123456789012`;

const awsRoleArnExample = `# Add after setting up Vercel OIDC (Step 6):
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/<your-vercel-backend-role>`;

const deployWithDatabaseExample = `# Pass flags directly (non-interactive):
wraps selfhost deploy --database-url "postgres://user:pass@your-db.example.com/wraps"
wraps selfhost deploy --neon-api-key "your-key" --neon-org-id "org-..."

# Or run without flags — the CLI will prompt you to choose:
wraps selfhost deploy`;

export default function SelfHostedPageContent() {
  return (
    <DocsLayout>
      {/* Back Link */}
      <div className="mb-8">
        <Button asChild className="gap-2" variant="ghost">
          <Link href="/docs/guides">
            <ArrowLeft className="h-4 w-4" />
            Back to Guides
          </Link>
        </Button>
      </div>

      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Guide
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Self-Hosted Deployment
        </h1>
        <p className="text-lg text-muted-foreground">
          Deploy the full Wraps control plane to your own AWS account. Your API,
          your dashboard, your database — everything in your infrastructure with
          no Wraps servers in the critical path.
        </p>
        <div className="mt-4 flex items-center gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            30–45 min
          </span>
        </div>
      </div>

      {/* Overview */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Overview</h2>
        <p className="mb-4 text-muted-foreground">
          Self-hosting deploys the Wraps control plane API as an AWS Lambda
          function in your account, backed by your own Postgres database. Your
          team's dashboard runs on Vercel and connects to the Lambda directly —
          no Wraps SaaS in the loop.
        </p>
        <Card>
          <CardContent className="p-6">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Server className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <span className="font-medium">
                    Control plane API on Lambda
                  </span>
                  <p className="text-muted-foreground text-sm">
                    Deployed into your AWS account via Pulumi — you own the
                    function, logs, and billing
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <span className="font-medium">Your Postgres database</span>
                  <p className="text-muted-foreground text-sm">
                    Bring any Postgres-compatible DB (Neon, Supabase, Railway,
                    self-hosted), or let Wraps provision a Neon project
                    automatically
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <span className="font-medium">Dashboard on Vercel</span>
                  <p className="text-muted-foreground text-sm">
                    Deploy{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      apps/web
                    </code>{" "}
                    from the Wraps repo to your own Vercel project
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <span className="font-medium">Zero stored credentials</span>
                  <p className="text-muted-foreground text-sm">
                    Dashboard authenticates to AWS via Vercel OIDC federation —
                    no static keys
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Prerequisites */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Prerequisites</h2>
        <Card>
          <CardContent className="p-6">
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Wraps CLI installed (
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    npm install -g @wraps.dev/cli
                  </code>
                  )
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0 text-green-500" />
                <span>
                  AWS CLI configured with credentials that have IAM, Lambda,
                  DynamoDB, SQS, and EventScheduler permissions
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Postgres database connection string (or a Neon API key to
                  provision one automatically)
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Wraps enterprise license key — contact{" "}
                  <Link
                    className="text-primary underline underline-offset-2"
                    href="/contact"
                  >
                    wraps.dev/contact
                  </Link>{" "}
                  to get one
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Vercel account and a project to deploy the dashboard
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Step 1 */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            1
          </div>
          Deploy the Control Plane API
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run the deploy command. The CLI will walk you through selecting a
          region, connecting a database, and entering your license key. The
          control plane API is deployed as an AWS Lambda with a public function
          URL.
        </p>
        <div className="mb-4">
          <CodeBlock
            className="h-auto"
            data={[
              {
                language: "bash",
                filename: "Terminal",
                code: deployWithDatabaseExample,
              },
            ]}
            defaultValue="bash"
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
        </div>
        <p className="mb-4 text-muted-foreground">The CLI will:</p>
        <ol className="mb-4 list-decimal space-y-2 pl-6 text-muted-foreground">
          <li>Prompt for AWS region if not specified via flag</li>
          <li>
            Prompt for license key, app URL, and any missing database details
          </li>
          <li>Run database migrations on your Postgres instance</li>
          <li>
            Deploy the Lambda function, DynamoDB tables, SQS queues, and
            EventBridge scheduler via Pulumi
          </li>
          <li>
            Print the API URL (e.g.{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              https://abc123.lambda-url.us-east-1.on.aws
            </code>
            )
          </li>
        </ol>
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">App URL</p>
          <p className="mt-2 text-muted-foreground text-sm">
            The{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">--app-url</code>{" "}
            flag (or prompt) should be the URL where you will deploy the
            dashboard — for example{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              https://dashboard.yourdomain.com
            </code>
            . This is used for CORS and auth redirect configuration. You can
            update it later if the URL is not finalised yet.
          </p>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            2
          </div>
          Deploy Email Infrastructure
        </h2>
        <p className="mb-4 text-muted-foreground">
          Initialise email sending with AWS SES. This creates IAM roles,
          configures SES, and sets up event processing for open and click
          tracking.
        </p>
        <div className="mb-4">
          <CLICommand command="wraps email init" />
        </div>
        <p className="text-muted-foreground text-sm">
          If you only need SMS, skip this step and run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            wraps sms init
          </code>{" "}
          instead.
        </p>
      </section>

      {/* Step 3 */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            3
          </div>
          Connect to the Dashboard
        </h2>
        <p className="mb-4 text-muted-foreground">
          Register this AWS account with the Wraps control plane. This creates
          the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            wraps-console-access-role
          </code>{" "}
          IAM role that your dashboard uses to read SES stats, CloudWatch
          metrics, and DynamoDB event history.
        </p>
        <div className="mb-4">
          <CLICommand command="wraps platform connect" />
        </div>
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Single-account deployments</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Because you are self-hosting, the CLI automatically configures the
            trust policy to trust your own AWS account — not the Wraps SaaS
            platform account. You do not need a second account.
          </p>
        </div>
      </section>

      {/* Step 4 */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            4
          </div>
          Get Your Environment Variables
        </h2>
        <p className="mb-4 text-muted-foreground">
          Generate the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">.env</code> block for
          your Vercel dashboard deployment. This reads your local Wraps metadata
          and prints all required variables in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">KEY=value</code>{" "}
          format.
        </p>
        <div className="mb-4">
          <CLICommand command="wraps selfhost env" />
        </div>
        <p className="mb-4 text-muted-foreground">
          The output looks like this — copy it and keep it ready for Step 5:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "bash",
              filename: ".env",
              code: envVarsExample,
            },
          ]}
          defaultValue="bash"
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
      </section>

      {/* Step 5 */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            5
          </div>
          Deploy the Dashboard to Vercel
        </h2>
        <p className="mb-4 text-muted-foreground">
          The Wraps dashboard lives in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">apps/web</code> in
          the Wraps monorepo. Fork or clone the repo and deploy that directory
          to Vercel.
        </p>
        <ol className="mb-4 list-decimal space-y-4 pl-6 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              Fork the Wraps repo
            </span>{" "}
            and connect it to a new Vercel project. Set the root directory to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">apps/web</code>.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Add all environment variables
            </span>{" "}
            from the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              wraps selfhost env
            </code>{" "}
            output into Vercel → Project Settings → Environment Variables. Scope
            them to Production (and Preview if needed).
          </li>
          <li>
            <span className="font-medium text-foreground">
              Trigger a deployment
            </span>{" "}
            — Vercel will build and deploy the dashboard. The first deploy will
            succeed but the dashboard will not be able to call AWS until you
            complete Step 6.
          </li>
        </ol>
      </section>

      {/* Step 6 */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            6
          </div>
          Set Up Vercel OIDC Authentication
        </h2>
        <p className="mb-4 text-muted-foreground">
          The dashboard reads AWS resources (SES stats, CloudWatch, DynamoDB)
          without any stored credentials. It uses Vercel OIDC federation to
          obtain short-lived AWS tokens automatically.
        </p>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Step 6a — Get your Vercel OIDC provider URL
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-3 text-muted-foreground text-sm">
              In Vercel: go to your team's{" "}
              <span className="font-medium text-foreground">
                Settings → Cloud → Configure AWS
              </span>
              . Copy the OIDC provider URL — it looks like{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                https://oidc.vercel.com/your-team-id
              </code>
              .
            </p>
          </CardContent>
        </Card>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Step 6b — Add an OIDC identity provider in AWS
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-3 text-muted-foreground text-sm">
              In the AWS Console, go to{" "}
              <span className="font-medium text-foreground">
                IAM → Identity providers → Add provider
              </span>
              :
            </p>
            <ul className="space-y-1 text-muted-foreground text-sm">
              <li>
                <span className="font-medium text-foreground">
                  Provider type:
                </span>{" "}
                OpenID Connect
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Provider URL:
                </span>{" "}
                paste your Vercel OIDC URL from 6a
              </li>
              <li>
                <span className="font-medium text-foreground">Audience:</span>{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  sts.amazonaws.com
                </code>
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Step 6c — Create an IAM role that trusts the OIDC provider
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-3 text-muted-foreground text-sm">
              Create a new IAM role with a web identity trust policy for the
              provider you just added. The role needs a single permission policy
              allowing it to assume{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                wraps-console-access-role
              </code>
              :
            </p>
            <ul className="space-y-1 text-muted-foreground text-sm">
              <li>
                <span className="font-medium text-foreground">Action:</span>{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  sts:AssumeRole
                </code>
              </li>
              <li>
                <span className="font-medium text-foreground">Resource:</span>{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  arn:aws:iam::YOUR_ACCOUNT_ID:role/wraps-console-access-role
                </code>
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground text-sm">
              Give the role a descriptive name like{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                wraps-vercel-backend-role
              </code>
              . Copy its ARN.
            </p>
          </CardContent>
        </Card>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Step 6d — Set AWS_ROLE_ARN in Vercel
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-3 text-muted-foreground text-sm">
              Add one more environment variable to your Vercel project using the
              role ARN from 6c:
            </p>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "bash",
                  filename: ".env",
                  code: awsRoleArnExample,
                },
              ]}
              defaultValue="bash"
            >
              <CodeBlockHeader>
                <CodeBlockFiles>
                  {(item) => (
                    <CodeBlockFilename
                      key={item.language}
                      value={item.language}
                    >
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
            <p className="mt-3 text-muted-foreground text-sm">
              Redeploy the Vercel project after adding this variable.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Step 7 */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            7
          </div>
          Sign In to Your Instance
        </h2>
        <p className="mb-4 text-muted-foreground">
          Create your account in the browser, then connect the CLI to your
          self-hosted instance.
        </p>
        <ol className="mb-6 list-decimal space-y-4 pl-6 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              Open your dashboard URL
            </span>{" "}
            in a browser and sign up with email and password. Create your
            organization when prompted.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Connect the CLI
            </span>{" "}
            — run the command below. It reads your deployment metadata to find
            the dashboard URL, then opens a browser for device authorization
            against your own instance (not the Wraps SaaS platform).
          </li>
        </ol>
        <div className="mb-4">
          <CLICommand command="wraps selfhost login" />
        </div>
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">
            Why not <code className="rounded bg-muted px-1.5 py-0.5">wraps auth login</code>?
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            The standard login command authenticates against the Wraps SaaS
            platform. <code className="rounded bg-muted px-1.5 py-0.5">wraps selfhost login</code> reads your deployment
            metadata and authenticates against your own dashboard URL instead.
          </p>
        </div>
      </section>

      {/* Step 8 */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            8
          </div>
          Verify Your Deployment
        </h2>
        <p className="mb-4 text-muted-foreground">
          Check the health of your self-hosted control plane from the CLI:
        </p>
        <div className="mb-4">
          <CLICommand command="wraps selfhost status" />
        </div>
        <p className="mb-4 text-muted-foreground">
          A healthy deployment reports the API URL, Lambda ARN, deployed
          version, and database connectivity. Then open your dashboard URL and
          confirm your connected AWS account, SES sending stats, and any email
          or SMS infrastructure you deployed in Steps 2–3 are visible.
        </p>
        <div className="rounded-lg border-green-500 border-l-4 bg-green-500/10 p-4">
          <p className="font-medium text-sm">You are fully self-hosted</p>
          <p className="mt-2 text-muted-foreground text-sm">
            All API calls from the dashboard go directly to your Lambda. No
            Wraps SaaS servers are involved at runtime. Your license is verified
            offline — no phone-home required.
          </p>
        </div>
      </section>

      {/* Upgrades */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Upgrading</h2>
        <p className="mb-4 text-muted-foreground">
          When a new Wraps CLI version is released, upgrade the control plane
          Lambda in place. Migrations run automatically.
        </p>
        <div className="mb-4">
          <CLICommand command="wraps selfhost upgrade" />
        </div>
        <p className="text-muted-foreground text-sm">
          After upgrading the CLI, redeploy your Vercel dashboard project to
          pick up any frontend changes.
        </p>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <Key className="mb-3 h-5 w-5 text-primary" />
              <h3 className="mb-2 font-medium">Verify your domain</h3>
              <p className="mb-3 text-muted-foreground text-sm">
                Add DKIM, SPF, and DMARC records to start sending from your own
                domain.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/docs/guides/domain-verification">
                  Domain verification →
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Shield className="mb-3 h-5 w-5 text-primary" />
              <h3 className="mb-2 font-medium">Request production access</h3>
              <p className="mb-3 text-muted-foreground text-sm">
                SES starts in sandbox mode. Request production access to send to
                any recipient.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/docs/guides/production-access">
                  Production access →
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </DocsLayout>
  );
}
