"use client";

import { SectionKicker } from "@/app/landing/components/section-kicker";
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

export function NoEnterpriseSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <SectionKicker>BYOC without the enterprise contract</SectionKicker>
          <h2 className="mb-6 font-heading font-semibold text-2xl tracking-tight sm:text-3xl">
            Most BYOC means a sales call and a cluster to babysit.
          </h2>
          <p className="mb-6 text-muted-foreground">
            Most BYOC platforms gate the pattern behind a sales call, an
            enterprise plan, and a Kubernetes cluster you have to run yourself:
            Helm charts, EKS, Terraform. Wraps is a CLI command and serverless
            AWS resources. No cluster, no private beta, no procurement process.
          </p>

          <CodeBlock
            className="h-auto"
            data={[
              {
                language: "bash",
                filename: "terminal",
                code: "npx @wraps.dev/cli email init",
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
      </div>
    </section>
  );
}
