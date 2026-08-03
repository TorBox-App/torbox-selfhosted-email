import { randomBytes } from "node:crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { del, put } from "@vercel/blob";
import { auth } from "@wraps/auth";
import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import {
  imageUrlToKey,
  isOwnedBlobLogo,
  isOwnedSelfHostedLogo,
  isVercelBlobUrl,
  sanitizeLogoFilename,
} from "@/lib/organization-logo";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const TRAILING_SLASHES = /\/+$/;

// Module scope so warm Lambda invocations reuse the client and its
// connections. Construction is cheap and does no I/O, so creating it even
// when this deployment uses Vercel Blob costs nothing.
const s3 = new S3Client({});

/**
 * Storage backend, resolved per request from the environment:
 * - UPLOADS_BUCKET_NAME set → S3. infra/selfhost.config.ts wires it on the
 *   SelfhostWeb function, so set means self-hosted.
 * - VERCEL set → Vercel Blob (the production platform app).
 * - Neither → uploads unavailable (local dev without either).
 */
function getStorageBackend(): "s3" | "vercel" | null {
  if (process.env.UPLOADS_BUCKET_NAME) {
    return "s3";
  }
  if (process.env.VERCEL) {
    return "vercel";
  }
  return null;
}

/**
 * Turn a storage failure into something the person who hit it can act on. A
 * self-hosted operator owns the bucket, so "failed to upload" tells them
 * nothing — whether it is missing, denied, or unauthenticated is the whole
 * answer. AWS SDK v3 does not reliably populate `name` (it is sometimes just
 * "Error" with the real code only in the message), so both are checked.
 */
function storageErrorMessage(
  error: unknown,
  action: "upload" | "delete"
): string {
  const name = (error as { name?: string }).name ?? "";
  const message = error instanceof Error ? error.message : "";
  const is = (code: string) =>
    name === code || name === `${code}Exception` || message.includes(code);

  if (is("NoSuchBucket")) {
    return `Cannot ${action} image: the uploads bucket does not exist. Check UPLOADS_BUCKET_NAME on this deployment.`;
  }
  if (is("AccessDenied") || is("Forbidden")) {
    return `Cannot ${action} image: this deployment is not allowed to access the uploads bucket.`;
  }
  if (is("CredentialsProviderError") || is("CredentialsError")) {
    return `Cannot ${action} image: no AWS credentials are available to this deployment.`;
  }
  if (is("BLOB_READ_WRITE_TOKEN") || is("BlobAccessError")) {
    return `Cannot ${action} image: blob storage is not configured on this deployment.`;
  }
  return `Failed to ${action} image`;
}

/**
 * Put an object in the self-hosted uploads bucket and return its serving
 * URL. The URL is absolute (not the relative /api/images path) because the
 * logo is embedded into email HTML, where a relative URL resolves against
 * the recipient's mail client, not this deployment.
 */
async function uploadToS3(key: string, file: File): Promise<string> {
  // Checked BEFORE the put: a missing app URL means the response cannot
  // name the object, and throwing after the write would orphan it.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(
    TRAILING_SLASHES,
    ""
  );
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required to build the logo URL — it is backfilled into .env.selfhost by the deploy script"
    );
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.UPLOADS_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    })
  );
  return `${appUrl}/api/images/${key}`;
}

async function deleteFromS3(url: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.UPLOADS_BUCKET_NAME,
      Key: imageUrlToKey(url),
    })
  );
}

/**
 * Write the logo to whichever backend this deployment uses and return its
 * URL. Both backends produce the same key shape (LOGO_KEY_PATTERN), which is
 * what the serving route and the delete guards match on.
 */
async function storeLogo(
  backend: "s3" | "vercel",
  orgId: string,
  file: File
): Promise<string> {
  const baseKey = `organization-logos/${orgId}/${Date.now()}`;
  const safeName = sanitizeLogoFilename(file.name);

  if (backend === "s3") {
    // randomBytes stands in for blob's addRandomSuffix: two uploads of the
    // same filename in the same millisecond must not overwrite each other.
    return await uploadToS3(
      `${baseKey}-${randomBytes(4).toString("hex")}-${safeName}`,
      file
    );
  }

  const blob = await put(`${baseKey}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}

/**
 * Whether this deployment may delete `url` on behalf of `orgId`: it has to
 * live in the backend that is actually active here, and inside that org's
 * namespace. Gating on the backend matters — a self-hosted deployment handed
 * a blob URL would otherwise call del() with no BLOB_READ_WRITE_TOKEN and
 * 500 instead of refusing. Single source of truth for both delete paths.
 */
function isDeletableLogo(
  backend: "s3" | "vercel" | null,
  url: string,
  orgId: string
): boolean {
  if (backend === "s3") {
    return isOwnedSelfHostedLogo(url, orgId);
  }
  if (backend === "vercel") {
    return isVercelBlobUrl(url) && isOwnedBlobLogo(url, orgId);
  }
  return false;
}

async function deleteLogo(backend: "s3" | "vercel", url: string) {
  if (backend === "s3") {
    await deleteFromS3(url);
  } else {
    await del(url);
  }
}

export async function POST(request: Request) {
  const backend = getStorageBackend();
  if (!backend) {
    return NextResponse.json(
      { error: "Image uploads are not configured on this deployment" },
      { status: 501 }
    );
  }

  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const orgSlug = formData.get("orgSlug") as string | null;
    const oldLogoUrl = formData.get("oldLogoUrl") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!orgSlug) {
      return NextResponse.json(
        { error: "Organization slug required" },
        { status: 400 }
      );
    }

    // 3. Verify organization membership and permissions
    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (!["owner", "admin"].includes(orgWithMembership.userRole)) {
      return NextResponse.json(
        { error: "Only owners and admins can update organization logos" },
        { status: 403 }
      );
    }

    // 4. Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PNG, JPEG, and WebP are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // 5. Upload to this deployment's storage
    const url = await storeLogo(backend, orgWithMembership.id, file);

    // 6. Replace succeeded, so the old logo is now unreferenced. A URL we may
    // not delete (another org's, or another backend's) is simply left alone.
    if (
      oldLogoUrl &&
      isDeletableLogo(backend, oldLogoUrl, orgWithMembership.id)
    ) {
      try {
        await deleteLogo(backend, oldLogoUrl);
      } catch (error) {
        // Non-critical error - log but don't fail the request
        const log = createRequestLogger({
          path: "/api/upload/organization-logo",
          method: "POST",
          orgSlug,
        });
        log.warn({ err: error, oldLogoUrl }, "Failed to delete old logo");
      }
    }

    return NextResponse.json({
      url,
      success: true,
    });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/upload/organization-logo",
      method: "POST",
    });
    log.error({ err: error }, "Failed to upload organization logo");
    return NextResponse.json(
      { error: storageErrorMessage(error, "upload") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get URL from request
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const orgSlug = searchParams.get("orgSlug");

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    if (!orgSlug) {
      return NextResponse.json(
        { error: "Organization slug required" },
        { status: 400 }
      );
    }

    // 3. Verify organization membership and permissions
    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (!["owner", "admin"].includes(orgWithMembership.userRole)) {
      return NextResponse.json(
        { error: "Only owners and admins can delete organization logos" },
        { status: 403 }
      );
    }

    // 4. Only delete a URL that lives in this deployment's storage and is
    // owned by this organization
    const backend = getStorageBackend();
    if (!(backend && isDeletableLogo(backend, url, orgWithMembership.id))) {
      return NextResponse.json(
        { error: "URL does not belong to this organization" },
        { status: 403 }
      );
    }

    await deleteLogo(backend, url);

    return NextResponse.json({ success: true });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/upload/organization-logo",
      method: "DELETE",
    });
    log.error({ err: error }, "Failed to delete organization logo");
    return NextResponse.json(
      { error: storageErrorMessage(error, "delete") },
      { status: 500 }
    );
  }
}
