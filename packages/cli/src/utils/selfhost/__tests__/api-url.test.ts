import {
  GetFunctionUrlConfigCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionMetadata } from "../../shared/metadata.js";
import {
  reconcileSelfhostApiUrl,
  resolveSelfhostApiUrl,
  SELFHOST_API_FUNCTION_NAME,
} from "../api-url.js";

const lambdaMock = mockClient(LambdaClient);

const saveConnectionMetadata = vi.fn();
vi.mock("../../shared/metadata.js", () => ({
  saveConnectionMetadata: (metadata: ConnectionMetadata) =>
    saveConnectionMetadata(metadata),
}));

// Lambda Function URLs always come back from AWS with a trailing slash;
// callers must receive the normalized form (no trailing slash) so appended
// paths don't double up.
const FUNCTION_URL = "https://abc123.lambda-url.us-east-1.on.aws/";
const NORMALIZED_URL = "https://abc123.lambda-url.us-east-1.on.aws";

function selfhostMetadata(apiUrl: string): ConnectionMetadata {
  return {
    version: "1.0.0",
    accountId: "886375649429",
    region: "us-east-1",
    provider: "other",
    timestamp: "2026-05-01T00:00:00.000Z",
    services: {
      selfhost: {
        deployedAt: "2026-05-01T00:00:00.000Z",
        pulumiStackName: "wraps-selfhost-886375649429-us-east-1",
        config: {
          databaseUrl: "postgresql://db",
          licenseKey: "v1.scale.key",
          appUrl: "https://self-host.example.com",
          unsubscribeSecret: "u",
          betterAuthSecret: "b",
        },
        apiUrl,
      },
    },
  } as ConnectionMetadata;
}

describe("resolveSelfhostApiUrl", () => {
  beforeEach(() => {
    lambdaMock.reset();
  });

  it("returns the live Function URL for the selfhost Lambda", async () => {
    lambdaMock
      .on(GetFunctionUrlConfigCommand, {
        FunctionName: SELFHOST_API_FUNCTION_NAME,
      })
      .resolves({ FunctionUrl: FUNCTION_URL });

    expect(await resolveSelfhostApiUrl("us-east-1")).toBe(NORMALIZED_URL);
  });

  it("returns null when the function has no URL configured", async () => {
    const err = new Error("not found");
    err.name = "ResourceNotFoundException";
    lambdaMock.on(GetFunctionUrlConfigCommand).rejects(err);

    expect(await resolveSelfhostApiUrl("us-east-1")).toBeNull();
  });

  it("returns null on any AWS error rather than throwing", async () => {
    lambdaMock.on(GetFunctionUrlConfigCommand).rejects(new Error("boom"));

    expect(await resolveSelfhostApiUrl("us-east-1")).toBeNull();
  });
});

describe("reconcileSelfhostApiUrl", () => {
  beforeEach(() => {
    lambdaMock.reset();
    saveConnectionMetadata.mockReset();
  });

  it("returns the cached apiUrl (normalized) without touching AWS or persisting", async () => {
    const metadata = selfhostMetadata(FUNCTION_URL);

    const result = await reconcileSelfhostApiUrl(metadata, "us-east-1");

    expect(result).toBe(NORMALIZED_URL);
    expect(lambdaMock.calls()).toHaveLength(0);
    expect(saveConnectionMetadata).not.toHaveBeenCalled();
  });

  it("recovers an empty apiUrl from AWS and writes it back to metadata", async () => {
    lambdaMock
      .on(GetFunctionUrlConfigCommand)
      .resolves({ FunctionUrl: FUNCTION_URL });
    const metadata = selfhostMetadata("");

    const result = await reconcileSelfhostApiUrl(metadata, "us-east-1");

    expect(result).toBe(NORMALIZED_URL);
    expect(metadata.services.selfhost?.apiUrl).toBe(NORMALIZED_URL);
    expect(saveConnectionMetadata).toHaveBeenCalledWith(metadata);
  });

  it("returns null and persists nothing when no deployment exists in AWS", async () => {
    const err = new Error("not found");
    err.name = "ResourceNotFoundException";
    lambdaMock.on(GetFunctionUrlConfigCommand).rejects(err);
    const metadata = selfhostMetadata("");

    const result = await reconcileSelfhostApiUrl(metadata, "us-east-1");

    expect(result).toBeNull();
    expect(saveConnectionMetadata).not.toHaveBeenCalled();
  });

  it("returns null when metadata has no selfhost service", async () => {
    const metadata = selfhostMetadata(FUNCTION_URL);
    metadata.services.selfhost = undefined;

    const result = await reconcileSelfhostApiUrl(metadata, "us-east-1");

    expect(result).toBeNull();
    expect(lambdaMock.calls()).toHaveLength(0);
  });
});
