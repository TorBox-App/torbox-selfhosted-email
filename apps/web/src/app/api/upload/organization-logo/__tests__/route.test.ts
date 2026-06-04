import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "user-1", email: "test@example.com", name: "Test" },
      })),
    },
  },
}));

vi.mock("@/lib/organization", () => ({
  getOrganizationWithMembership: vi.fn(async () => ({
    id: "org-1",
    name: "Test Org",
    slug: "test-org",
    userRole: "owner",
  })),
}));

const mockPut = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: mockPut,
  del: vi.fn(),
}));

function makeUploadRequest(orgSlug = "test-org") {
  const formData = new FormData();
  const file = new File(["fake-image"], "logo.png", { type: "image/png" });
  formData.append("file", file);
  formData.append("orgSlug", orgSlug);
  return new Request("http://localhost/api/upload/organization-logo", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload/organization-logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL;
  });

  it("returns 501 when VERCEL env is not set (self-hosted mode)", async () => {
    const { POST } = await import("../route");
    const response = await POST(makeUploadRequest());
    const data = await response.json();

    expect(response.status).toBe(501);
    expect(data.error).toBeDefined();
  });

  it("proceeds to upload when VERCEL env is set", async () => {
    process.env.VERCEL = "1";
    mockPut.mockResolvedValueOnce({
      url: "https://example.vercel-storage.com/logo.png",
    });

    const { POST } = await import("../route");
    const response = await POST(makeUploadRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toBe("https://example.vercel-storage.com/logo.png");
    expect(mockPut).toHaveBeenCalled();
  });
});
