"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { ArrowRight, CheckCircle2, Target } from "lucide-react";
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

const installCommands = {
  npm: "npm install @aws-sdk/client-s3",
  pnpm: "pnpm add @aws-sdk/client-s3",
  yarn: "yarn add @aws-sdk/client-s3",
  bun: "bun add @aws-sdk/client-s3",
};

const uploadCode = `import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize the S3 client
const s3 = new S3Client({ region: 'us-east-1' });

// Upload a file
const result = await s3.send(new PutObjectCommand({
  Bucket: 'wraps-cdn-123456789012', // From 'wraps cdn status'
  Key: 'images/hero.webp',
  Body: buffer,
  ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable',
}));

console.log('Uploaded:', result);

// Access via CDN: https://cdn.yourdomain.com/images/hero.webp`;

const optimizedImageCode = `// Browser-based image optimization
// Just add query params to your CDN URL:

// Original image
const original = 'https://cdn.yourdomain.com/images/hero.webp';

// Resize to 800px width, auto height
const resized = 'https://cdn.yourdomain.com/images/hero.webp?width=800';

// Convert to WebP with quality 80
const optimized = 'https://cdn.yourdomain.com/images/hero.webp?format=webp&quality=80';

// Thumbnail: 200x200, cropped
const thumbnail = 'https://cdn.yourdomain.com/images/hero.webp?width=200&height=200&fit=cover';

// Next.js Image component example
<Image
  src="https://cdn.yourdomain.com/images/hero.webp"
  alt="Hero"
  width={1200}
  height={600}
  loader={({ src, width, quality }) =>
    \`\${src}?width=\${width}&quality=\${quality || 75}&format=webp\`
  }
/>`;

export default function CdnQuickstartPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          CDN Quickstart
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Get Started with CDN
        </h1>
        <p className="text-lg text-muted-foreground">
          Deploy S3 + CloudFront CDN infrastructure to your AWS account in under
          2 minutes. Get global CDN delivery with browser-based image
          optimization.
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4">
          <p className="text-muted-foreground text-sm">
            <strong>Pricing:</strong> Free to use. You pay AWS directly for
            storage (~$0.023/GB/month) and bandwidth (~$0.085/GB). A typical
            setup costs ~$5-7/month for 10GB storage + 50GB bandwidth.
          </p>
        </div>
      </div>

      {/* Outcome Preview */}
      <div className="mb-8 rounded-lg border bg-muted/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">What you'll build</p>
        </div>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
          <li>S3 bucket + CloudFront distribution for global CDN delivery</li>
          <li>Custom domain with an auto-provisioned SSL certificate</li>
          <li>Browser-based image optimization via query parameters</li>
        </ul>
        <p className="text-muted-foreground text-xs">Time: ~5 minutes</p>
      </div>

      {/* Prerequisites */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Prerequisites
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            Before you begin, make sure you have:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Node.js 20 or later installed</li>
            <li>An AWS account with valid credentials configured</li>
            <li>
              AWS CLI installed and configured (or AWS credentials in
              environment variables)
            </li>
            <li>(Optional) A domain for custom CDN URLs</li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Deploy Infrastructure */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          Deploy Infrastructure
        </h2>
        <p className="mb-4 text-muted-foreground">
          Run the Wraps CLI to deploy CDN infrastructure to your AWS account:
        </p>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "bash",
              filename: "terminal.sh",
              code: "npx @wraps.dev/cli cdn init",
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
        <div className="mt-4 rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">What happens during deployment?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>Validates your AWS credentials</li>
            <li>Prompts for custom domain (optional)</li>
            <li>Shows estimated monthly AWS costs</li>
            <li>Creates S3 bucket with CORS configured</li>
            <li>Deploys CloudFront distribution for global CDN</li>
            <li>Sets up Origin Access Control for secure S3 access</li>
            <li>Takes 2-3 minutes to complete</li>
          </ul>
        </div>
      </section>

      {/* Step 2: Add Custom Domain (Optional) */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          Add Custom Domain (Optional)
        </h2>
        <p className="mb-4 text-muted-foreground">
          If you specified a custom domain during init, add the DNS records
          shown by the CLI. Then verify and upgrade:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "bash",
              filename: "terminal.sh",
              code: `# Verify DNS records are configured
npx @wraps.dev/cli cdn verify

# Once verified, add domain to CloudFront
npx @wraps.dev/cli cdn upgrade`,
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
        <p className="text-muted-foreground text-sm">
          Without a custom domain, you can still use the CloudFront URL (e.g.,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            d1234abcd.cloudfront.net
          </code>
          ).
        </p>
      </section>

      {/* Step 3: Install AWS SDK */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          Install AWS SDK
        </h2>
        <p className="mb-4 text-muted-foreground">
          Install the AWS SDK to upload files programmatically:
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
      </section>

      {/* Step 4: Upload Files */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          Upload Files
        </h2>
        <p className="mb-4 text-muted-foreground">
          Upload files to your S3 bucket. They'll be automatically served
          through CloudFront CDN:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "typescript",
              filename: "upload.ts",
              code: uploadCode,
            },
          ]}
          defaultValue="typescript"
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
        <div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
          <p className="font-medium text-sm">Tip: Get your bucket name</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              npx @wraps.dev/cli cdn status
            </code>{" "}
            to see your S3 bucket name, CDN domain, and usage statistics.
          </p>
        </div>
      </section>

      {/* Step 5: Image Optimization */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            5
          </div>
          Use Image Optimization (Optional)
        </h2>
        <p className="mb-4 text-muted-foreground">
          CloudFront includes browser-based image optimization. Just add query
          parameters to your CDN URLs:
        </p>
        <CodeBlock
          className="mb-4 h-auto"
          data={[
            {
              language: "typescript",
              filename: "images.tsx",
              code: optimizedImageCode,
            },
          ]}
          defaultValue="typescript"
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
        <p className="text-muted-foreground text-sm">
          Supported parameters:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">width</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">height</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">quality</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">format</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">fit</code>.
        </p>
      </section>

      {/* Next Steps */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">CDN CLI Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Learn about all CDN commands: init, status, verify, upgrade,
                sync, and destroy.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/cli-reference/cdn">
                  View CLI Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">AWS Setup Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Need help setting up AWS credentials? Check our setup guide.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/guides/aws-setup">
                  View Guide
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
