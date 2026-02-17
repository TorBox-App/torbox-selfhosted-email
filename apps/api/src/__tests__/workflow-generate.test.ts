/**
 * Workflow Generate API Route Tests
 *
 * Tests the POST /v1/workflows/generate endpoint:
 * 1. Successful generation with valid description
 * 2. Missing API key returns 503
 * 3. Rate limit (429) pass-through
 * 4. Anthropic API error returns 502
 * 5. Missing content in response returns 502
 * 6. Invalid generated code (no defineWorkflow) returns 502
 * 7. Code extraction from fenced blocks
 * 8. Slug generation from description
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../middleware/auth";

// Mock auth middleware
vi.mock("../middleware/auth", () => ({
  createAuthenticatedRoutes: vi.fn((prefix: string) => {
    // Return a minimal Elysia-like chain that captures route handlers
    const routes: Record<string, Function> = {};
    const chain = {
      post: vi.fn((path: string, handler: Function, schema: unknown) => {
        routes[`POST ${prefix}${path}`] = handler;
        return chain;
      }),
      _routes: routes,
    };
    return chain;
  }),
}));

const authContext: AuthContext = {
  apiKeyId: "key-1",
  organizationId: "org-1",
  userId: "user-1",
  planId: "starter",
};

// Capture the original fetch before mocking
const originalFetch = globalThis.fetch;

describe("workflow-generate route", () => {
  let routeHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset module registry to re-evaluate the route
    vi.resetModules();

    // Set the API key
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";

    // Import the module to trigger route registration
    const mod = await import("../routes/workflow-generate");

    // Extract the route handler from the mock
    const { createAuthenticatedRoutes } = await import("../middleware/auth");
    const mockCall = vi.mocked(createAuthenticatedRoutes).mock.results[0];
    const chain = mockCall?.value;
    const postCall = chain?.post.mock.calls[0];
    routeHandler = postCall?.[1];
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: process.env requires delete to fully remove keys (assignment sets to string "undefined")
    delete process.env.ANTHROPIC_API_KEY;
    globalThis.fetch = originalFetch;
  });

  function createCtx(body: Record<string, unknown>) {
    return {
      body,
      auth: authContext,
      set: { status: 200 },
    } as unknown as {
      body: typeof body;
      auth: AuthContext;
      set: { status: number };
    };
  }

  it("should return generated code on success", async () => {
    const generatedCode = `import { defineWorkflow, sendEmail } from '@wraps.dev/client';
export default defineWorkflow({
  name: 'Welcome',
  trigger: { type: 'contact_created' },
  steps: [sendEmail('send-welcome', { template: 'welcome' })],
});`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: generatedCode }],
        }),
    });

    const ctx = createCtx({
      description: "Welcome series on signup",
      slug: "welcome-series",
    });
    const result = await routeHandler(ctx);

    expect(result.code).toBe(generatedCode);
    expect(result.slug).toBe("welcome-series");
  });

  it("should call Anthropic API with correct parameters", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [
            {
              type: "text",
              text: "import { defineWorkflow } from '@wraps.dev/client'; export default defineWorkflow({ name: 'X', trigger: { type: 'manual' }, steps: [] });",
            },
          ],
        }),
    });

    const ctx = createCtx({
      description: "Test workflow",
      slug: "test",
    });
    await routeHandler(ctx);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-anthropic-key",
          "anthropic-version": "2023-06-01",
        }),
      })
    );

    // Verify body contains the description
    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.messages[0].content).toContain("Test workflow");
    expect(body.model).toBe("claude-sonnet-4-20250514");
    expect(body.system).toContain("defineWorkflow");
  });

  it("should return 503 when ANTHROPIC_API_KEY is not set", async () => {
    // Need to re-import with no key set
    vi.resetModules();
    // biome-ignore lint/performance/noDelete: process.env requires delete to fully remove keys (assignment sets to string "undefined")
    delete process.env.ANTHROPIC_API_KEY;

    await import("../routes/workflow-generate");

    const { createAuthenticatedRoutes } = await import("../middleware/auth");
    const calls = vi.mocked(createAuthenticatedRoutes).mock.results;
    const chain = calls.at(-1)?.value;
    const postCall = chain?.post.mock.calls[0];
    const handler = postCall?.[1];

    const ctx = createCtx({ description: "test" });
    const result = await handler(ctx);

    expect(ctx.set.status).toBe(503);
    expect(result.error).toContain("not configured");
  });

  it("should return 429 on rate limit from Anthropic", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });

    const ctx = createCtx({
      description: "Test",
      slug: "test",
    });
    const result = await routeHandler(ctx);

    expect(ctx.set.status).toBe(429);
    expect(result.error).toContain("Rate limit");
  });

  it("should return 502 on Anthropic API error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal error"),
    });

    const ctx = createCtx({
      description: "Test",
      slug: "test",
    });
    const result = await routeHandler(ctx);

    expect(ctx.set.status).toBe(502);
    expect(result.error).toBe("Failed to generate workflow");
  });

  it("should return 502 when response has no text content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "image", source: {} }],
        }),
    });

    const ctx = createCtx({
      description: "Test",
      slug: "test",
    });
    const result = await routeHandler(ctx);

    expect(ctx.set.status).toBe(502);
    expect(result.error).toBe("No content returned from AI");
  });

  it("should return 502 when generated code is missing defineWorkflow", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: "console.log('hello');" }],
        }),
    });

    const ctx = createCtx({
      description: "Test",
      slug: "test",
    });
    const result = await routeHandler(ctx);

    expect(ctx.set.status).toBe(502);
    expect(result.error).toContain("missing defineWorkflow");
  });

  it("should extract code from TypeScript fenced code blocks", async () => {
    const fencedResponse = `Here's the workflow:

\`\`\`typescript
import { defineWorkflow } from '@wraps.dev/client';
export default defineWorkflow({ name: 'Test', trigger: { type: 'manual' }, steps: [] });
\`\`\`

Hope this helps!`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: fencedResponse }],
        }),
    });

    const ctx = createCtx({
      description: "Test",
      slug: "test",
    });
    const result = await routeHandler(ctx);

    // Should extract only the code inside the fence
    expect(result.code).not.toContain("Here's the workflow");
    expect(result.code).not.toContain("Hope this helps");
    expect(result.code).toContain("defineWorkflow");
  });

  it("should extract code from generic fenced code blocks", async () => {
    const fencedResponse = `\`\`\`
import { defineWorkflow } from '@wraps.dev/client';
export default defineWorkflow({ name: 'Test', trigger: { type: 'manual' }, steps: [] });
\`\`\``;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: fencedResponse }],
        }),
    });

    const ctx = createCtx({
      description: "Test",
      slug: "test",
    });
    const result = await routeHandler(ctx);

    expect(result.code).toContain("defineWorkflow");
    expect(result.code).not.toContain("```");
  });

  it("should slugify the description when no slug is provided", async () => {
    const code =
      "import { defineWorkflow } from '@wraps.dev/client'; export default defineWorkflow({ name: 'X', trigger: { type: 'manual' }, steps: [] });";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: code }],
        }),
    });

    const ctx = createCtx({
      description: "Welcome series for new users!",
    });
    const result = await routeHandler(ctx);

    expect(result.slug).toBe("welcome-series-for-new-users");
  });

  it("should use provided slug over generated one", async () => {
    const code =
      "import { defineWorkflow } from '@wraps.dev/client'; export default defineWorkflow({ name: 'X', trigger: { type: 'manual' }, steps: [] });";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: code }],
        }),
    });

    const ctx = createCtx({
      description: "Welcome series for new users!",
      slug: "my-custom-slug",
    });
    const result = await routeHandler(ctx);

    expect(result.slug).toBe("my-custom-slug");
  });
});
