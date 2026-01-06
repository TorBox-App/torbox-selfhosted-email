---
name: testing-patterns
description: Write tests using Vitest patterns for the Wraps codebase. Use when creating or editing test files.
---

# Testing Patterns Skill

You are an expert at writing tests for the Wraps codebase using Vitest.

## Test Organization

```
src/
├── utils/
│   ├── metadata.ts
│   └── __tests__/
│       ├── metadata.test.ts
│       └── setup.ts          # Shared fixtures
└── commands/
    └── __tests__/
        └── init.test.ts
```

## Vitest Configuration

### CLI Package (Pure Unit Tests)
```typescript
// packages/cli/vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      thresholds: { lines: 70, functions: 70 },
    },
  },
});
```

### API/Web Package (Database Integration)
```typescript
// apps/api/vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    // CRITICAL: Sequential for shared database
    fileParallelism: false,
  },
});
```

## Mocking Patterns

### AWS SDK Mocking

```typescript
import { mockClient } from "aws-sdk-client-mock";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const stsMock = mockClient(STSClient);
const sesMock = mockClient(SESClient);

beforeEach(() => {
  stsMock.reset();
  sesMock.reset();
});

it("validates AWS credentials", async () => {
  stsMock.on(GetCallerIdentityCommand).resolves({
    Account: "123456789012",
    UserId: "AIDAI123",
    Arn: "arn:aws:iam::123456789012:user/test",
  });

  const result = await validateAWSCredentials();
  expect(result.accountId).toBe("123456789012");
});

it("handles invalid credentials", async () => {
  stsMock.on(GetCallerIdentityCommand).rejects(new Error("Invalid"));

  await expect(validateAWSCredentials()).rejects.toThrow(WrapsError);
});
```

### Module Mocking

```typescript
// Mocks MUST be before imports
vi.mock("@pulumi/pulumi");
vi.mock("@clack/prompts");
vi.mock("../../utils/shared/metadata.js");

// Import AFTER mocks
import { init } from "../email/init.js";
import * as metadata from "../../utils/shared/metadata.js";

it("loads existing metadata", async () => {
  vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue({
    accountId: "123",
    // ...
  });

  await init({});

  expect(metadata.loadConnectionMetadata).toHaveBeenCalled();
});
```

### Spies

```typescript
it("exits with code 1 on error", () => {
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(() => handleCLIError(new Error("test"))).toThrow("exit");
  expect(exitSpy).toHaveBeenCalledWith(1);

  exitSpy.mockRestore();
  consoleSpy.mockRestore();
});
```

## Database Testing (Integration)

### Setup File
```typescript
// __tests__/setup.ts
import { db, user, organization, member } from "@wraps/db";
import { eq } from "drizzle-orm";

// Use unique prefix to avoid conflicts
const TEST_PREFIX = "api-batch-test";

export const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "Test User",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testOrganization = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Test Org",
  slug: `${TEST_PREFIX}-org`,
  createdAt: new Date(),
};

beforeAll(async () => {
  // Idempotent upsert
  await db
    .insert(user)
    .values([testUser])
    .onConflictDoUpdate({
      target: user.id,
      set: { updatedAt: new Date() },
    });

  await db
    .insert(organization)
    .values([testOrganization])
    .onConflictDoUpdate({
      target: organization.id,
      set: { updatedAt: new Date() },
    });
});

afterAll(async () => {
  // Clean up in reverse dependency order
  await db.delete(member).where(eq(member.userId, testUser.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});
```

### Integration Test
```typescript
import { testUser, testOrganization } from "./setup";

describe("Contacts API", () => {
  it("creates a contact", async () => {
    const response = await app.post("/v1/contacts", {
      body: JSON.stringify({
        email: "new@example.com",
        organizationId: testOrganization.id,
      }),
    });

    expect(response.status).toBe(201);

    // Verify in database
    const [contact] = await db
      .select()
      .from(contact)
      .where(eq(contact.email, "new@example.com"));

    expect(contact).toBeDefined();
    expect(contact.organizationId).toBe(testOrganization.id);
  });
});
```

## Test Data Factories

```typescript
// Factory function for complex objects
function createTestWorkflow(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    organizationId: testOrganization.id,
    name: "Test Workflow",
    status: "draft",
    triggerType: "event",
    triggerConfig: { eventName: "test_event" },
    steps: [],
    transitions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Use in tests
it("enables a workflow", async () => {
  const workflow = createTestWorkflow({ status: "draft" });
  await db.insert(workflow).values([workflow]);

  const result = await enableWorkflow(workflow.id);
  expect(result.status).toBe("enabled");
});
```

## Fake Timers

```typescript
it("updates timestamp on config change", () => {
  const oldTimestamp = metadata.timestamp;

  vi.useFakeTimers();
  vi.advanceTimersByTime(1000);

  updateConfig(metadata, { newField: true });

  vi.useRealTimers();

  expect(metadata.timestamp).not.toBe(oldTimestamp);
});
```

## Test Commands

```bash
# Run all tests
pnpm test

# Run specific package
pnpm --filter @wraps/cli test
pnpm --filter @wraps/api test

# Run specific file
pnpm --filter @wraps/api test:coverage src/__tests__/contacts.test.ts

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Key Patterns

1. **Mocks before imports** - vi.mock() must be at top of file
2. **Reset mocks in beforeEach** - Prevent state leaking
3. **Use TEST_PREFIX** - Avoid conflicts in shared database
4. **Idempotent setup** - onConflictDoUpdate for reliability
5. **Clean up in afterAll** - Delete in reverse dependency order
6. **Sequential for DB tests** - `fileParallelism: false`
7. **Restore spies** - Call mockRestore() after assertions

## Common Mistakes

1. **Importing before mocking** - Mocks won't work
2. **Parallel DB tests** - Race conditions
3. **Not cleaning up test data** - Tests pollute each other
4. **Forgetting await** - Tests pass but don't actually run
5. **Hardcoded IDs** - Conflicts between test files
