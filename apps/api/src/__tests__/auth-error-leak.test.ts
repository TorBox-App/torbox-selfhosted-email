/**
 * Auth Error Information Disclosure Tests
 *
 * Verifies that internal errors (DB failures, connection errors) during
 * session validation are NOT leaked to the client in the 401 response.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock database — simulate DB failure during session lookup
const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const makeJoinable = (): Record<string, ReturnType<typeof vi.fn>> => ({
	leftJoin: vi.fn(() => makeJoinable()),
	where: mockWhere,
});

vi.mock("@wraps/db", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => makeJoinable()),
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(),
			})),
		})),
	},
	apiKey: {
		id: "id",
		keyHash: "key_hash",
		organizationId: "organization_id",
		createdBy: "created_by",
		expiresAt: "expires_at",
		lastUsedAt: "last_used_at",
	},
	session: {
		id: "id",
		token: "token",
		userId: "user_id",
		expiresAt: "expires_at",
		activeOrganizationId: "active_organization_id",
	},
	member: {
		userId: "user_id",
		organizationId: "organization_id",
		role: "role",
	},
	subscription: {
		referenceId: "reference_id",
		plan: "plan",
		status: "status",
	},
	eq: vi.fn((a, b) => ({ eq: [a, b] })),
	and: vi.fn((...args) => ({ and: args })),
}));

const mockLogError = vi.fn();
vi.mock("../lib/logger", () => ({
	log: {
		error: mockLogError,
		warn: vi.fn(),
		info: vi.fn(),
	},
}));

describe("Auth error information disclosure", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("still returns specific reason for non-error session failures", async () => {
		// Simulate session not found (empty result)
		mockLimit.mockResolvedValueOnce([]);

		const { authenticate } = await import("../middleware/auth");

		const request = new Request("http://localhost/v1/contacts", {
			headers: { Authorization: "Bearer some-session-token" },
		});

		const result = await authenticate(request);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Unauthorized: session not found");
		}
	});

	it("does not leak DB error details in session auth failure response", async () => {
		// Simulate a database connection error during session validation
		mockLimit.mockRejectedValueOnce(
			new Error(
				'connection to server at "neon-db.us-east-2.aws.neon.tech" failed: FATAL password authentication failed',
			),
		);

		const { authenticate } = await import("../middleware/auth");

		const request = new Request("http://localhost/v1/contacts", {
			headers: { Authorization: "Bearer some-session-token" },
		});

		const result = await authenticate(request);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).not.toContain("neon-db");
			expect(result.error).not.toContain("password authentication");
			expect(result.error).not.toContain("FATAL");
			expect(result.error).not.toContain("connection to server");
			// Should be a generic unauthorized message
			expect(result.error).toBe("Unauthorized");
		}
	});

	it("logs the real DB error server-side for debugging", async () => {
		const dbError = new Error("connection refused: ECONNREFUSED 10.0.0.1:5432");
		mockLimit.mockRejectedValueOnce(dbError);
		mockLogError.mockClear();

		const { authenticate } = await import("../middleware/auth");

		const request = new Request("http://localhost/v1/contacts", {
			headers: { Authorization: "Bearer some-session-token" },
		});

		await authenticate(request);

		// The real error should be logged server-side
		expect(mockLogError).toHaveBeenCalledWith(
			"Session validation failed",
			dbError,
		);
	});
});
