import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { CheckCircle2 } from "lucide-react";
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

const awsCredentialsCode = `# Option A: environment variables
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1

# Option B: AWS CLI profile
aws configure

# Option C: AWS SSO
aws sso login`;

export function AwsCredentialsPrereqs({
  extraItems = [],
}: {
  extraItems?: string[];
}) {
  return (
    <Card className="mb-8 border-primary/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Before You Start: AWS Credentials Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Every command below runs against your AWS account. Before running
          anything, make sure you have:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Node.js 20 or later installed</li>
          <li>
            AWS credentials available to the CLI —{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              AWS_ACCESS_KEY_ID
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              AWS_SECRET_ACCESS_KEY
            </code>{" "}
            environment variables, a configured profile via{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              aws configure
            </code>
            , or an active{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              aws sso login
            </code>{" "}
            session
          </li>
          {extraItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <CodeBlock
          className="h-auto"
          data={[
            {
              language: "bash",
              filename: "terminal.sh",
              code: awsCredentialsCode,
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
        <div className="rounded-lg border-yellow-500 border-l-4 bg-yellow-500/10 p-4">
          <p className="font-medium text-sm">
            Missing credentials fail after the first prompt
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            If credentials aren't configured, the CLI still starts and asks its
            telemetry question before failing with a credentials error. Set up
            credentials first to avoid the confusing dead end.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
