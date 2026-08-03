import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isOwnedSelfHostedLogo,
  LOGO_KEY_PATTERN,
} from "@/lib/organization-logo";

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
const mockDel = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: mockPut,
  del: mockDel,
}));

const mockS3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function (this: { send: typeof mockS3Send }) {
    this.send = mockS3Send;
  }),
  PutObjectCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
  DeleteObjectCommand: vi.fn(function (
    this: { input: unknown },
    input: unknown
  ) {
    this.input = input;
  }),
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

function makeDeleteRequest(url: string, orgSlug = "test-org") {
  return new Request(
    `http://localhost/api/upload/organization-logo?url=${encodeURIComponent(url)}&orgSlug=${orgSlug}`,
    { method: "DELETE" }
  );
}

describe("POST /api/upload/organization-logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL;
    delete process.env.UPLOADS_BUCKET_NAME;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("returns 501 when neither VERCEL nor UPLOADS_BUCKET_NAME is set", async () => {
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
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("uploads to S3 and returns an absolute /api/images URL when UPLOADS_BUCKET_NAME is set", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    process.env.NEXT_PUBLIC_APP_URL = "https://demo.example.com";
    mockS3Send.mockResolvedValueOnce({});

    const { POST } = await import("../route");
    const response = await POST(makeUploadRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toMatch(
      /^https:\/\/demo\.example\.com\/api\/images\/organization-logos\/org-1\/\d+-[0-9a-f]{8}-logo\.png$/
    );
    expect(mockPut).not.toHaveBeenCalled();

    const putInput = mockS3Send.mock.calls[0][0].input as {
      Bucket: string;
      Key: string;
      ContentType: string;
    };
    expect(putInput.Bucket).toBe("selfhost-uploads");
    expect(putInput.Key).toMatch(
      /^organization-logos\/org-1\/\d+-[0-9a-f]{8}-logo\.png$/
    );
    expect(putInput.ContentType).toBe("image/png");
  });

  it("produces a URL the serving route and the delete guard both accept", async () => {
    // The whole design rests on this: what POST writes must satisfy
    // LOGO_KEY_PATTERN, or the logo 404s on read and cannot be replaced.
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    process.env.NEXT_PUBLIC_APP_URL = "https://demo.example.com";
    mockS3Send.mockResolvedValueOnce({});

    const { POST } = await import("../route");
    const data = await (await POST(makeUploadRequest())).json();

    const key = (mockS3Send.mock.calls[0][0].input as { Key: string }).Key;
    expect(LOGO_KEY_PATTERN.test(key)).toBe(true);
    expect(isOwnedSelfHostedLogo(data.url, "org-1")).toBe(true);
    expect(isOwnedSelfHostedLogo(data.url, "org-2")).toBe(false);
  });

  it("strips a trailing slash from NEXT_PUBLIC_APP_URL", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    process.env.NEXT_PUBLIC_APP_URL = "https://demo.example.com/";
    mockS3Send.mockResolvedValueOnce({});

    const { POST } = await import("../route");
    const response = await POST(makeUploadRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toMatch(/^https:\/\/demo\.example\.com\/api\/images\//);
  });

  it("sanitizes the filename in the S3 key", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    process.env.NEXT_PUBLIC_APP_URL = "https://demo.example.com";
    mockS3Send.mockResolvedValueOnce({});

    const formData = new FormData();
    formData.append(
      "file",
      new File(["fake-image"], "../../my logo.PNG", { type: "image/png" })
    );
    formData.append("orgSlug", "test-org");

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/upload/organization-logo", {
        method: "POST",
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const putInput = mockS3Send.mock.calls[0][0].input as { Key: string };
    expect(putInput.Key).toMatch(
      /^organization-logos\/org-1\/\d+-[0-9a-f]{8}-my-logo\.PNG$/
    );
  });

  it("returns 500 when S3 is configured but NEXT_PUBLIC_APP_URL is missing, without writing the object", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";

    const { POST } = await import("../route");
    const response = await POST(makeUploadRequest());

    expect(response.status).toBe(500);
    // The app-URL check runs before the put — a failed upload must not
    // orphan an unreferenceable object in the bucket.
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("names a missing bucket instead of a generic failure", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    process.env.NEXT_PUBLIC_APP_URL = "https://demo.example.com";
    const missing = new Error("The specified bucket does not exist");
    missing.name = "NoSuchBucket";
    mockS3Send.mockRejectedValueOnce(missing);

    const { POST } = await import("../route");
    const response = await POST(makeUploadRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("UPLOADS_BUCKET_NAME");
  });
});

describe("DELETE /api/upload/organization-logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL;
    delete process.env.UPLOADS_BUCKET_NAME;
  });

  it("deletes a self-hosted image URL from S3", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    mockS3Send.mockResolvedValueOnce({});

    const { DELETE } = await import("../route");
    const response = await DELETE(
      makeDeleteRequest(
        "https://demo.example.com/api/images/organization-logos/org-1/123-logo.png"
      )
    );

    expect(response.status).toBe(200);
    const deleteInput = mockS3Send.mock.calls[0][0].input as {
      Bucket: string;
      Key: string;
    };
    expect(deleteInput.Bucket).toBe("selfhost-uploads");
    expect(deleteInput.Key).toBe("organization-logos/org-1/123-logo.png");
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("refuses to delete another org's self-hosted image (IDOR)", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";

    const { DELETE } = await import("../route");
    const response = await DELETE(
      makeDeleteRequest(
        "https://demo.example.com/api/images/organization-logos/org-2/123-logo.png"
      )
    );

    expect(response.status).toBe(403);
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("deletes a Vercel Blob URL owned by the org", async () => {
    process.env.VERCEL = "1";
    mockDel.mockResolvedValueOnce(undefined);

    const { DELETE } = await import("../route");
    const response = await DELETE(
      makeDeleteRequest(
        "https://x.public.blob.vercel-storage.com/organization-logos/org-1/abc-logo.png"
      )
    );

    expect(response.status).toBe(200);
    expect(mockDel).toHaveBeenCalled();
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("403s a Vercel Blob URL on a self-hosted deployment instead of 500ing", async () => {
    // No VERCEL and no BLOB_READ_WRITE_TOKEN here — calling del() would
    // throw. The backend gate must reject first.
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";

    const { DELETE } = await import("../route");
    const response = await DELETE(
      makeDeleteRequest(
        "https://x.public.blob.vercel-storage.com/organization-logos/org-1/abc-logo.png"
      )
    );

    expect(response.status).toBe(403);
    expect(mockDel).not.toHaveBeenCalled();
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("refuses a crafted key that only contains this org's prefix mid-path", async () => {
    // Passes a substring check but names another org's object. The guard is
    // anchored on the derived key so it must not depend on filenames never
    // containing a separator.
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";

    const { DELETE } = await import("../route");
    const response = await DELETE(
      makeDeleteRequest(
        "https://demo.example.com/api/images/organization-logos/org-2/123-organization-logos/org-1/logo.png"
      )
    );

    expect(response.status).toBe(403);
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("reports a denied bucket instead of a generic failure", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    const denied = new Error("User is not authorized: AccessDenied");
    // AWS SDK v3 often leaves `name` as "Error" with the real code only in
    // the message — the mapping has to read both.
    mockS3Send.mockRejectedValueOnce(denied);

    const { DELETE } = await import("../route");
    const response = await DELETE(
      makeDeleteRequest(
        "https://demo.example.com/api/images/organization-logos/org-1/123-logo.png"
      )
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("not allowed to access the uploads bucket");
  });
});
