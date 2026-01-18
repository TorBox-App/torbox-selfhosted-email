"use client";

import { ArrowLeft, ArrowRight, Terminal } from "lucide-react";
import { DocsLayout } from "@/components/docs-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function CLICommand({ command }: { command: string }) {
  return (
    <CodeBlock
      className="h-auto"
      data={[{ language: "bash", filename: "terminal.sh", code: command }]}
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
  );
}

export default function CLIReferenceCdnPageContent() {
  return (
    <DocsLayout>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Button asChild className="gap-2" size="sm" variant="ghost">
          <a href="/docs/cli-reference">
            <ArrowLeft className="h-4 w-4" />
            CLI Reference
          </a>
        </Button>
      </div>

      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          CLI Reference / CDN
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">CDN Commands</h1>
        <p className="text-lg text-muted-foreground">
          Deploy S3 + CloudFront CDN infrastructure to your AWS account with
          browser-based image optimization.
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4">
          <p className="text-muted-foreground text-sm">
            <strong>Pricing:</strong> Free to use. You pay AWS directly for
            storage (~$0.023/GB/month) and bandwidth (~$0.085/GB). A typical
            setup costs ~$5-7/month for 10GB storage + 50GB bandwidth.
          </p>
        </div>
      </div>

      {/* wraps cdn init */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps cdn init
        </h2>
        <p className="mb-4 text-muted-foreground">
          Deploy CDN infrastructure (S3 bucket + CloudFront CDN) to your AWS
          account. Optionally configure a custom domain for your CDN.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli cdn init [options]" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  -r, --region &lt;region&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  AWS region to deploy infrastructure (default: same as email,
                  or us-east-1)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  -d, --domain &lt;domain&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Custom CDN domain (e.g., cdn.yourdomain.com). If you have
                  email configured, the CLI will suggest a subdomain based on
                  your email domain.
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  -p, --provider &lt;provider&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Hosting provider: vercel, aws, railway, or other
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">--preview</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Preview infrastructure changes without deploying
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">-y, --yes</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Skip confirmation prompts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">What It Creates</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>
                S3 bucket (
                <code className="rounded bg-muted px-1 py-0.5">
                  wraps-cdn-{"{accountId}"}
                </code>
                ) with CORS configured
              </li>
              <li>CloudFront distribution for global CDN delivery</li>
              <li>ACM SSL certificate (if custom domain specified)</li>
              <li>IAM permissions for console/dashboard uploads</li>
              <li>Origin Access Control for secure S3 access</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-muted-foreground text-sm">
                Interactive setup:
              </p>
              <CLICommand command="npx @wraps.dev/cli cdn init" />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-muted-foreground text-sm">
                With custom domain:
              </p>
              <CLICommand command="npx @wraps.dev/cli cdn init --domain cdn.yourdomain.com" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* wraps cdn status */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps cdn status
        </h2>
        <p className="mb-4 text-muted-foreground">
          Display the current status of your CDN infrastructure, including CDN
          domain, S3 bucket, and usage statistics.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli cdn status" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Displays</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>CDN domain (custom or CloudFront default)</li>
              <li>S3 bucket name and region</li>
              <li>Storage usage (GB)</li>
              <li>Bandwidth usage (GB)</li>
              <li>File count</li>
              <li>Estimated monthly AWS cost</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps cdn verify */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps cdn verify
        </h2>
        <p className="mb-4 text-muted-foreground">
          Verify DNS configuration and certificate status for your custom
          domain. Use this after adding DNS records to confirm everything is
          working.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli cdn verify" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">
                  -r, --region &lt;region&gt;
                </code>
                <p className="mt-2 text-muted-foreground text-sm">
                  AWS region where CDN is deployed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>CloudFront distribution status (deployed and enabled)</li>
              <li>ACM certificate status (issued and valid)</li>
              <li>Certificate validation DNS records</li>
              <li>Custom domain CNAME pointing to CloudFront</li>
              <li>CloudFront alias configuration</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps cdn upgrade */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps cdn upgrade
        </h2>
        <p className="mb-4 text-muted-foreground">
          Add a custom domain to your CDN after the SSL certificate has been
          validated. Run this after{" "}
          <code className="rounded bg-muted px-1 py-0.5">cdn verify</code> shows
          the certificate is issued.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli cdn upgrade" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Does</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Adds the custom domain alias to CloudFront distribution</li>
              <li>Associates the validated SSL certificate</li>
              <li>Updates infrastructure state to mark domain as active</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps cdn sync */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps cdn sync
        </h2>
        <p className="mb-4 text-muted-foreground">
          Synchronize your local configuration with deployed infrastructure.
          Useful after CLI updates to apply fixes or when infrastructure state
          is out of sync.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli cdn sync" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Does</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>Re-runs Pulumi deployment with current configuration</li>
              <li>Updates CloudFront, S3, and IAM resources as needed</li>
              <li>Refreshes infrastructure state and stack outputs</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* wraps cdn destroy */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <Terminal className="h-6 w-6 text-primary" />
          wraps cdn destroy
        </h2>
        <p className="mb-4 text-muted-foreground">
          Remove all CDN infrastructure from your AWS account. This is a
          destructive operation.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CLICommand command="npx @wraps.dev/cli cdn destroy [options]" />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <code className="rounded bg-muted px-2 py-1">-f, --force</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Skip confirmation prompt (use with caution)
                </p>
              </div>
              <div>
                <code className="rounded bg-muted px-2 py-1">--preview</code>
                <p className="mt-2 text-muted-foreground text-sm">
                  Preview what would be destroyed without making changes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What It Removes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
              <li>S3 bucket and all stored files</li>
              <li>CloudFront distribution</li>
              <li>ACM certificate (if custom domain was configured)</li>
              <li>IAM permissions for CDN access</li>
              <li>Local metadata and Pulumi state</li>
            </ul>
            <p className="mt-4 text-muted-foreground text-sm">
              <strong>Note:</strong> You'll need to manually remove DNS records
              (CNAME) pointing to CloudFront.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Programmatic Uploads */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Programmatic Uploads</h2>
        <p className="mb-4 text-muted-foreground">
          For server-side uploads, use the AWS SDK directly. Your OIDC role or
          IAM credentials already have the necessary permissions.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Example: Upload from Node.js
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock
              className="h-auto"
              data={[
                {
                  language: "typescript",
                  filename: "upload.ts",
                  code: `import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });

// Upload a file
await s3.send(new PutObjectCommand({
  Bucket: 'wraps-cdn-123456789012', // From wraps cdn status
  Key: 'images/hero.webp',
  Body: buffer,
  ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable',
}));

// CDN URL: https://cdn.yourdomain.com/images/hero.webp`,
                },
              ]}
              defaultValue="typescript"
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
                  <CodeBlockItem key={item.language} value={item.language}>
                    <CodeBlockContent language={item.language}>
                      {item.code}
                    </CodeBlockContent>
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
          </CardContent>
        </Card>
      </section>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button asChild variant="outline">
          <a href="/docs/cli-reference/email">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Email Commands
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href="/docs/cli-reference">
            Back to CLI Reference
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    </DocsLayout>
  );
}
