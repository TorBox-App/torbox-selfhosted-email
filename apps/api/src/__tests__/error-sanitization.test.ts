import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

/**
 * Tests the error sanitization logic from index.ts onError handler.
 * Uses a standalone Elysia app to avoid importing index.ts (which calls app.listen).
 */
function createTestApp() {
  return new Elysia()
    .onError(({ error, code, set }) => {
      const status =
        code === "NOT_FOUND"
          ? 404
          : code === "VALIDATION"
            ? 400
            : ((set.status as number) ?? 500);

      if (code === "NOT_FOUND") {
        return { error: "Not found" };
      }

      if (code === "VALIDATION") {
        const message = error instanceof Error ? error.message : String(error);
        return { error: "Validation failed", details: message };
      }

      if (status >= 400 && status < 500) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: message };
      }

      return { error: "Internal server error" };
    })
    .get("/throw-500", () => {
      throw new Error("SELECT * FROM secret_table WHERE password = 'leaked'");
    })
    .get("/throw-4xx", ({ set }) => {
      set.status = 403;
      throw new Error("Forbidden: insufficient permissions");
    });
}

describe("API error sanitization", () => {
  it("returns generic message for unhandled 5xx errors", async () => {
    const app = createTestApp();
    const res = await app.handle(new Request("http://localhost/throw-500"));
    const body = await res.json();

    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("secret_table");
    expect(JSON.stringify(body)).not.toContain("leaked");
  });

  it("returns 'Not found' for unknown routes", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/nonexistent-route")
    );
    const body = await res.json();

    expect(body.error).toBe("Not found");
  });

  it("passes through 4xx error messages from routes", async () => {
    const app = createTestApp();
    const res = await app.handle(new Request("http://localhost/throw-4xx"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden: insufficient permissions");
  });
});
