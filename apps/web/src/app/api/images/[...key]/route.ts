import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { LOGO_KEY_PATTERN } from "@/lib/organization-logo";

export const runtime = "nodejs";

/**
 * Serves objects from the self-hosted uploads bucket (organization logos).
 * The bucket stays private — this route is the only read path, which is why
 * it exists only when UPLOADS_BUCKET_NAME is set (self-hosted deployments;
 * the platform app on Vercel serves logos from Vercel Blob URLs instead).
 *
 * Public by design, matching the blob URLs it replaces: logos render in
 * emails and the preference center, where no session exists. Unguessability
 * comes from the key (org UUID + timestamp), same as the blob random suffix.
 */

// Module scope so warm Lambda invocations reuse the client.
const s3 = new S3Client({});

type RouteContext = {
  params: Promise<{
    key: string[];
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const bucket = process.env.UPLOADS_BUCKET_NAME;
  if (!bucket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { key } = await context.params;
  const objectKey = key.join("/");
  // Literal S3 keys cannot traverse like a filesystem path — this guard
  // exists so the route can never proxy an arbitrary bucket object, only
  // the logos prefix.
  if (!LOGO_KEY_PATTERN.test(objectKey)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey })
    );
    if (!object.Body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(object.Body.transformToWebStream(), {
      headers: {
        "Content-Type": object.ContentType ?? "application/octet-stream",
        // Keys carry a timestamp, so a replaced logo is a new URL — the old
        // one can be cached forever.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // AWS SDK v3 does not reliably populate `name` — a missing object comes
    // back as NoSuchKey or NotFound depending on the call path, and the code
    // is sometimes only in the message.
    const name = (error as { name?: string }).name ?? "";
    const message = error instanceof Error ? error.message : "";
    if (
      name === "NoSuchKey" ||
      name === "NotFound" ||
      message.includes("NoSuchKey")
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Anything else is this deployment's problem (denied, missing bucket, no
    // credentials) and needs a log line — rethrowing left an opaque 500 with
    // nothing to grep for.
    const log = createRequestLogger({ path: "/api/images", method: "GET" });
    log.error(
      { err: error, objectKey },
      "Failed to read uploads bucket object"
    );
    return NextResponse.json(
      { error: "Failed to load image" },
      { status: 500 }
    );
  }
}
