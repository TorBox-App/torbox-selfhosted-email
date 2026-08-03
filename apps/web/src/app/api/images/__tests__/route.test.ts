import { beforeEach, describe, expect, it, vi } from "vitest";

const mockS3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function (this: { send: typeof mockS3Send }) {
    this.send = mockS3Send;
  }),
  GetObjectCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

function makeContext(key: string[]) {
  return { params: Promise.resolve({ key }) };
}

describe("GET /api/images/[...key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UPLOADS_BUCKET_NAME;
  });

  it("returns 404 when UPLOADS_BUCKET_NAME is not set (platform app)", async () => {
    const { GET } = await import("../[...key]/route");
    const response = await GET(
      new Request("http://localhost/api/images/organization-logos/org-1/a.png"),
      makeContext(["organization-logos", "org-1", "a.png"])
    );

    expect(response.status).toBe(404);
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("returns 404 for keys outside the organization-logos prefix", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";

    const { GET } = await import("../[...key]/route");
    const response = await GET(
      new Request("http://localhost/api/images/secrets/api-key.txt"),
      makeContext(["secrets", "api-key.txt"])
    );

    expect(response.status).toBe(404);
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("streams the object with content type and immutable caching", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToWebStream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("fake-image"));
              controller.close();
            },
          }),
      },
      ContentType: "image/png",
    });

    const { GET } = await import("../[...key]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/images/organization-logos/org-1/123-logo.png"
      ),
      makeContext(["organization-logos", "org-1", "123-logo.png"])
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("fake-image");

    const getInput = mockS3Send.mock.calls[0][0].input as {
      Bucket: string;
      Key: string;
    };
    expect(getInput.Bucket).toBe("selfhost-uploads");
    expect(getInput.Key).toBe("organization-logos/org-1/123-logo.png");
  });

  it("returns 500 rather than rethrowing when the bucket read is denied", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    // AWS SDK v3 often leaves `name` as "Error" — a denied read is this
    // deployment's misconfiguration, not a missing logo, and must be logged
    // and answered rather than escaping as an opaque 500.
    mockS3Send.mockRejectedValueOnce(new Error("AccessDenied"));

    const { GET } = await import("../[...key]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/images/organization-logos/org-1/123-logo.png"
      ),
      makeContext(["organization-logos", "org-1", "123-logo.png"])
    );

    expect(response.status).toBe(500);
  });

  it("returns 404 when the object does not exist", async () => {
    process.env.UPLOADS_BUCKET_NAME = "selfhost-uploads";
    const noSuchKey = new Error("The specified key does not exist.");
    noSuchKey.name = "NoSuchKey";
    mockS3Send.mockRejectedValueOnce(noSuchKey);

    const { GET } = await import("../[...key]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/images/organization-logos/org-1/missing.png"
      ),
      makeContext(["organization-logos", "org-1", "missing.png"])
    );

    expect(response.status).toBe(404);
  });
});
