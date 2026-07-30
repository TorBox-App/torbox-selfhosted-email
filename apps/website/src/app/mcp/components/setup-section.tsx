"use client";

import Link from "next/link";
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

const claudeCodeConfig = `{
  "mcpServers": {
    "wraps": {
      "command": "npx",
      "args": ["-y", "@wraps.dev/mcp"],
      "env": {
        "AWS_REGION": "us-east-1"
      }
    }
  }
}`;

const claudeDesktopConfig = `{
  "mcpServers": {
    "wraps": {
      "command": "npx",
      "args": ["-y", "@wraps.dev/mcp"],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_PROFILE": "your-aws-profile"
      }
    }
  }
}`;

function ConfigBlock({ filename, code }: { filename: string; code: string }) {
  return (
    <CodeBlock
      className="h-auto"
      data={[{ language: "json", filename, code }]}
      defaultValue="json"
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

export function McpSetupSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-3xl">
          <h2 className="mb-3 font-bold text-3xl tracking-tight sm:text-4xl">
            One config block. No API key.
          </h2>
          <p className="text-lg text-muted-foreground">
            The server resolves AWS credentials from your environment — the same
            chain the AWS CLI uses. One difference from the CLI: the server
            reads the region from its own environment, so set{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              AWS_REGION
            </code>{" "}
            (or{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              AWS_DEFAULT_REGION
            </code>
            ) in the MCP config or it won't start.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Claude Code — project root
            </h3>
            <ConfigBlock code={claudeCodeConfig} filename=".mcp.json" />
            <p className="mt-3 text-muted-foreground text-sm">
              Claude Code inherits your shell's AWS environment, so credentials
              carry over. Region doesn't come from your AWS profile, so pin it
              here.
            </p>
          </div>

          <div>
            <h3 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Claude Desktop, Cursor, Windsurf
            </h3>
            <ConfigBlock
              code={claudeDesktopConfig}
              filename="claude_desktop_config.json"
            />
            <p className="mt-3 text-muted-foreground text-sm">
              GUI clients don't inherit your shell, so pass the region and
              profile explicitly. Full per-client setup lives in{" "}
              <Link
                className="text-orange-500 underline decoration-orange-500/30 underline-offset-4 hover:decoration-orange-500/60"
                href="/docs/mcp-reference"
              >
                the MCP reference
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
