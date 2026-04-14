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
  Database,
  Layers,
  Lock,
  MessageSquare,
  Phone,
  Shield,
  ShieldCheck,
  Tag,
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

const architectureDiagram = `# SMS Event Processing Pipeline
#
# End User Messaging --> EventBridge --> SQS --> Lambda --> DynamoDB
#
# 1. AWS End User Messaging Social sends SMS via phone number
# 2. Delivery status events emitted to EventBridge
# 3. SQS buffers events for reliable processing
# 4. Lambda processes delivery receipts
# 5. DynamoDB stores message history and delivery status`;

export default function InfrastructureSmsPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Infrastructure / SMS
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          What Gets Deployed: SMS
        </h1>
        <p className="text-lg text-muted-foreground">
          Every AWS resource Wraps creates when you run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">wraps sms init</code>
          .
        </p>
      </div>

      {/* Overview */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Layers className="h-6 w-6 text-primary" />
          Overview
        </h2>
        <p className="mb-4 text-muted-foreground">
          Wraps SMS uses AWS End User Messaging Social (formerly Pinpoint SMS)
          to send text messages from your own AWS account. Like email, you own
          the infrastructure and pay AWS directly at transparent per-message
          pricing.
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "bash",
              filename: "architecture.txt",
              code: architectureDiagram,
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

      {/* Core Resources */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Shield className="h-6 w-6 text-primary" />
          Core Resources
        </h2>
        <p className="mb-6 text-muted-foreground">
          These resources are created regardless of which preset you choose.
        </p>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-primary" />
                IAM Role
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm">
                  wraps-sms-role
                </code>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>
                  OIDC trust policy for Vercel (or IAM trust for AWS-native
                  providers)
                </li>
                <li>
                  End User Messaging permissions for sending and managing SMS
                </li>
                <li>Scoped to Wraps-managed resources only</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5 text-primary" />
                Phone Number
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>
                  Simulator phone number (Starter) or toll-free number
                  (Production+)
                </li>
                <li>Provisioned through AWS End User Messaging</li>
                <li>
                  Toll-free numbers support higher throughput and carrier trust
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Opt-Out List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>
                  Automatic opt-out management (recipients can reply STOP)
                </li>
                <li>Maintained by AWS, ensuring TCPA compliance</li>
                <li>
                  Wraps automatically respects opt-out status before sending
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
                Event Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>
                  Delivery status tracking (sent, delivered, failed, opted-out)
                </li>
                <li>Carrier response codes captured</li>
                <li>
                  Events routed through EventBridge for Production+ presets
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Starter Preset */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Zap className="h-6 w-6 text-primary" />
          Starter Preset
          <Badge variant="secondary">~$1/mo</Badge>
        </h2>
        <p className="mb-4 text-muted-foreground">
          The Starter preset provides a simulator phone number for testing and
          basic SMS sending capabilities.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Included Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Simulator phone number for development and testing</li>
              <li>Basic send and receive capabilities</li>
              <li>Opt-out list management</li>
              <li>Delivery status tracking (synchronous)</li>
            </ul>
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Best for</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Development, testing, and prototyping. The simulator number lets you
            test your SMS integration without incurring per-message charges.
          </p>
        </div>
      </section>

      {/* Production Preset */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Layers className="h-6 w-6 text-primary" />
          Production Preset
          <Badge variant="secondary">~$2-10/mo</Badge>
        </h2>
        <p className="mb-4 text-muted-foreground">
          The Production preset includes a toll-free phone number, real-time
          event tracking, and opt-out management for live applications.
        </p>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Toll-Free Phone Number</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>Dedicated toll-free number (~$2/mo)</li>
                <li>Higher carrier trust and deliverability</li>
                <li>Supports both transactional and promotional messages</li>
                <li>Two-way messaging (recipients can reply to your number)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Event Processing Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>EventBridge rule capturing delivery status events</li>
                <li>
                  SQS queue with dead-letter queue for reliable processing
                </li>
                <li>Lambda function processing events into DynamoDB</li>
                <li>DynamoDB table for message history (90-day TTL)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Opt-Out Management</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>Automatic STOP keyword handling</li>
                <li>
                  Opt-out status checked before every send (prevents accidental
                  messages)
                </li>
                <li>Dashboard view of opt-out statistics</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">
            Recommended for most applications
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            The Production preset gives you a real phone number, delivery
            tracking, and compliance-ready opt-out management for live SMS
            sending.
          </p>
        </div>
      </section>

      {/* Enterprise Preset */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Shield className="h-6 w-6 text-primary" />
          Enterprise Preset
          <Badge variant="secondary">~$10-50/mo</Badge>
        </h2>
        <p className="mb-4 text-muted-foreground">
          The Enterprise preset includes everything in Production plus link
          tracking, dedicated throughput, and extended history.
        </p>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Link Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>Automatic URL shortening and click tracking in messages</li>
                <li>Click-through rate analytics in the dashboard</li>
                <li>Custom short domain support</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dedicated Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>Higher messages-per-second rate for bulk sending</li>
                <li>Dedicated throughput allocation from AWS</li>
                <li>Consistent delivery performance under load</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Extended History</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
                <li>365-day message history retention (vs 90 days)</li>
                <li>Full delivery audit trail</li>
                <li>Useful for compliance and reporting requirements</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Cost Breakdown */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Database className="h-6 w-6 text-primary" />
          Cost Breakdown
        </h2>
        <p className="mb-4 text-muted-foreground">
          Estimated monthly costs by message volume. All costs are billed
          directly by AWS to your account.
        </p>

        <Card className="mb-4">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-left font-medium">Volume</th>
                    <th className="p-4 text-left font-medium">Starter</th>
                    <th className="p-4 text-left font-medium">Production</th>
                    <th className="p-4 text-left font-medium">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4 font-medium">1K/mo</td>
                    <td className="p-4 text-muted-foreground">~$9</td>
                    <td className="p-4 text-muted-foreground">~$11</td>
                    <td className="p-4 text-muted-foreground">~$19</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 font-medium">10K/mo</td>
                    <td className="p-4 text-muted-foreground">~$81</td>
                    <td className="p-4 text-muted-foreground">~$83</td>
                    <td className="p-4 text-muted-foreground">~$91</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 font-medium">100K/mo</td>
                    <td className="p-4 text-muted-foreground">~$801</td>
                    <td className="p-4 text-muted-foreground">~$805</td>
                    <td className="p-4 text-muted-foreground">~$815</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">AWS SMS pricing</p>
          <p className="mt-1 text-muted-foreground text-sm">
            SMS pricing is ~$0.00581 per message segment for US destinations.
            Messages over 160 characters are split into multiple segments.
            Toll-free numbers cost ~$2/mo. Infrastructure costs (DynamoDB,
            Lambda, SQS) are additional but minimal.
          </p>
        </div>
      </section>

      {/* Resource Tags */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Tag className="h-6 w-6 text-primary" />
          Resource Tags
        </h2>
        <p className="mb-4 text-muted-foreground">
          All SMS resources are tagged for identification and cost tracking.
        </p>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-left font-medium">Tag Key</th>
                    <th className="p-4 text-left font-medium">Tag Value</th>
                    <th className="p-4 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4">
                      <code className="rounded bg-muted px-1 py-0.5">
                        ManagedBy
                      </code>
                    </td>
                    <td className="p-4">
                      <code className="rounded bg-muted px-1 py-0.5">
                        wraps-cli
                      </code>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      Identifies resources managed by Wraps
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">SMS CLI Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                All available SMS CLI commands and options.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/cli-reference/sms">
                  View CLI Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">SMS SDK Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Send text messages with the TypeScript SDK after deploying.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/sms-sdk-reference">
                  View SDK Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Infrastructure as Code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Deploy SMS infrastructure with{" "}
                <Link
                  className="text-primary underline"
                  href="/docs/cdk-reference"
                >
                  CDK
                </Link>{" "}
                or{" "}
                <Link
                  className="text-primary underline"
                  href="/docs/pulumi-reference"
                >
                  Pulumi
                </Link>{" "}
                instead of the CLI.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/cdk-reference">
                  View CDK Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <h3 className="mb-2 font-bold text-xl">Need Help?</h3>
          <p className="mb-4 text-muted-foreground">
            If you run into any issues, check our GitHub discussions or open an
            issue.
          </p>
          <Button asChild>
            <a
              href="https://github.com/wraps-team/wraps/discussions"
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
