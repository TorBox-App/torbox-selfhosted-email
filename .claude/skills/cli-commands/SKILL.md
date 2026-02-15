---
name: cli-commands
description: Build CLI commands using Clack prompts and Pulumi. Use when creating or modifying commands in packages/cli.
---

# CLI Commands Skill

You are an expert at building CLI commands for the Wraps CLI using Clack prompts and Pulumi.

## CLI Architecture

The CLI entry point (`packages/cli/src/cli.ts`) uses the `args` package for command routing. Individual commands use `@clack/prompts` for interactive prompts and `picocolors` for styled output. Don't confuse the two: `args` parses `wraps email init`, while `@clack/prompts` handles interactive questions within commands.

## Command Structure

Commands live in `packages/cli/src/commands/` organized by service:
```
commands/
├── email/
│   ├── init.ts
│   ├── connect.ts
│   ├── status.ts
│   ├── domains.ts
│   └── destroy.ts
├── sms/
│   ├── init.ts
│   └── status.ts
└── shared/
    └── dashboard.ts
```

## Standard Command Pattern

```typescript
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { DeploymentProgress } from "../../utils/shared/output.js";
import { handleCLIError, errors } from "../../utils/shared/errors.js";
import { validateAWSCredentials } from "../../utils/shared/aws.js";
import {
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../utils/shared/metadata.js";

export type MyCommandOptions = {
  region?: string;
  domain?: string;
  yes?: boolean;
  force?: boolean;
};

export async function myCommand(options: MyCommandOptions): Promise<void> {
  const startTime = Date.now();

  try {
    // 1. Intro
    clack.intro(pc.bold("My Command Title"));
    const progress = new DeploymentProgress();

    // 2. Validate credentials
    const identity = await progress.execute(
      "Validating AWS credentials",
      async () => validateAWSCredentials()
    );
    progress.info(`Connected to AWS account: ${pc.cyan(identity.accountId)}`);

    // 3. Get configuration (from options or prompts)
    const region = options.region || await clack.select({
      message: "Select AWS region",
      options: [
        { value: "us-east-1", label: "US East (N. Virginia)" },
        { value: "eu-west-1", label: "EU West (Ireland)" },
      ],
    });

    if (clack.isCancel(region)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }

    // 4. Check existing state
    const existing = await loadConnectionMetadata(identity.accountId, region);
    if (existing && !options.force) {
      clack.log.warn("Connection already exists. Use --force to override.");
      process.exit(0);
    }

    // 5. Confirm before destructive actions
    if (!options.yes) {
      const confirmed = await clack.confirm({
        message: "Proceed with deployment?",
      });

      if (clack.isCancel(confirmed) || !confirmed) {
        clack.cancel("Operation cancelled.");
        process.exit(0);
      }
    }

    // 6. Execute main logic with progress
    const result = await progress.execute(
      "Deploying infrastructure",
      async () => {
        // Pulumi deployment or AWS operations
        return { roleArn: "...", region };
      }
    );

    // 7. Save metadata
    await saveConnectionMetadata({
      accountId: identity.accountId,
      region,
      services: { email: { config: {} } },
      // ...
    });

    // 8. Display success
    clack.log.success("Deployment complete!");
    clack.note(
      `Role ARN: ${pc.cyan(result.roleArn)}\nRegion: ${pc.cyan(result.region)}`,
      "Configuration"
    );

    clack.outro(pc.green("Done!"));
  } catch (error) {
    handleCLIError(error);
  }
}
```

## Clack Prompts

### Select
```typescript
const choice = await clack.select({
  message: "Choose an option",
  options: [
    { value: "a", label: "Option A", hint: "Recommended" },
    { value: "b", label: "Option B" },
  ],
});
```

### Text Input
```typescript
const domain = await clack.text({
  message: "Enter domain",
  placeholder: "example.com",
  validate: (value) => {
    if (!value.includes(".")) return "Invalid domain format";
  },
});
```

### Confirm
```typescript
const confirmed = await clack.confirm({
  message: "Are you sure?",
  initialValue: false,
});
```

### Multi-select
```typescript
const features = await clack.multiselect({
  message: "Select features",
  options: [
    { value: "tracking", label: "Open/click tracking" },
    { value: "events", label: "Event streaming" },
  ],
});
```

### Spinner (via DeploymentProgress)
```typescript
const progress = new DeploymentProgress();
const result = await progress.execute("Loading...", async () => {
  return await longRunningTask();
});
```

## Error Handling

### Custom Error Class
```typescript
import { WrapsError } from "../../utils/shared/errors.js";

throw new WrapsError(
  "AWS credentials not found",
  "NO_AWS_CREDENTIALS",
  "Run: aws configure",
  "https://wraps.dev/docs/setup"
);
```

### Pre-defined Errors
```typescript
import { errors } from "../../utils/shared/errors.js";

// Use factory functions
throw errors.noAWSCredentials();
throw errors.stackExists(stackName);
throw errors.invalidRegion(region);
```

### Global Handler
```typescript
export function handleCLIError(error: unknown): never {
  if (error instanceof WrapsError) {
    clack.log.error(error.message);
    if (error.suggestion) {
      console.log(`\n${pc.yellow("Suggestion:")}`);
      console.log(`  ${pc.white(error.suggestion)}\n`);
    }
    process.exit(1);
  }
  // ... handle unknown errors
}
```

## Metadata Storage

```typescript
// Location: ~/.wraps/connections/{accountId}-{region}.json

type ConnectionMetadata = {
  version: string;
  accountId: string;
  region: string;
  provider: "vercel" | "aws" | "railway" | "other";
  timestamp: string;
  vercel?: { teamSlug: string; projectName: string };
  services: {
    email?: { config: EmailConfig; preset: string };
    sms?: { config: SMSConfig; preset: string };
  };
};

// Load
const metadata = await loadConnectionMetadata(accountId, region);

// Save
await saveConnectionMetadata(metadata);
```

## Pulumi Integration

```typescript
import * as pulumi from "@pulumi/pulumi";

const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
  {
    stackName: `wraps-${accountId}-${region}`,
    projectName: "wraps-email",
    program: async () => {
      // Create resources
      const role = new aws.iam.Role("wraps-email-role", { ... });
      return {
        roleArn: role.arn,
      };
    },
  },
  {
    workDir: getPulumiWorkDir(),
    envVars: {
      PULUMI_CONFIG_PASSPHRASE: "",
      AWS_REGION: region,
    },
  }
);

const result = await stack.up({ onOutput: () => {} });
```

## Output Formatting

```typescript
import pc from "picocolors";

// Colors
pc.bold("Bold text");
pc.cyan("Highlighted");
pc.yellow("Warning");
pc.green("Success");
pc.red("Error");
pc.dim("Muted");
pc.blue("Link");

// Clack messages
clack.log.success("Done!");
clack.log.error("Failed!");
clack.log.warn("Warning!");
clack.log.info("Info");
clack.log.step("Step...");
clack.note("Details here", "Title");
```

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | Command routing |
| `src/utils/shared/errors.ts` | Error handling |
| `src/utils/shared/output.ts` | DeploymentProgress |
| `src/utils/shared/prompts.ts` | Prompt helpers |
| `src/utils/shared/metadata.ts` | State persistence |
| `src/utils/shared/aws.ts` | AWS SDK helpers |
| `src/infrastructure/` | Pulumi stacks |

## Common Mistakes

1. **Forgetting `clack.isCancel()`** - Always check for user cancellation
2. **Not using `handleCLIError`** - Wrap main function in try/catch
3. **Missing `--force` flag** - Destructive commands need confirmation
4. **Fire-and-forget** - Await all async operations
