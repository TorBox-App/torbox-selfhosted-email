import {
  GetFunctionUrlConfigCommand,
  LambdaClient,
  ListFunctionsCommand,
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

  // The Pulumi stack names its Lambda `wraps-selfhost-api` exactly, but the SST
  // stack lets SST derive the physical name from app + stage + logical name
  // plus a random suffix — `wraps-selfhost-production-SelfhostApiFunction-xxxx`.
  // It therefore has to be found by listing, not by a name guess.
  describe("SST variant fallback", () => {
    const SST_FUNCTION = "wraps-selfhost-production-SelfhostApiAbc123";
    const SST_URL = "https://sst456.lambda-url.us-east-1.on.aws/";
    const SST_NORMALIZED_URL = "https://sst456.lambda-url.us-east-1.on.aws";

    function notFound(): Error {
      const err = new Error("not found");
      err.name = "ResourceNotFoundException";
      return err;
    }

    it("prefers the Pulumi lookup and never lists functions when it succeeds", async () => {
      lambdaMock
        .on(GetFunctionUrlConfigCommand, {
          FunctionName: SELFHOST_API_FUNCTION_NAME,
        })
        .resolves({ FunctionUrl: FUNCTION_URL });
      lambdaMock
        .on(ListFunctionsCommand)
        .resolves({ Functions: [{ FunctionName: SST_FUNCTION }] });

      expect(await resolveSelfhostApiUrl("us-east-1")).toBe(NORMALIZED_URL);
      expect(lambdaMock.commandCalls(ListFunctionsCommand)).toHaveLength(0);
    });

    it("falls back to the SST function when the Pulumi Lambda is absent", async () => {
      lambdaMock
        .on(GetFunctionUrlConfigCommand, {
          FunctionName: SELFHOST_API_FUNCTION_NAME,
        })
        .rejects(notFound());
      lambdaMock
        .on(ListFunctionsCommand)
        .resolves({ Functions: [{ FunctionName: SST_FUNCTION }] });
      lambdaMock
        .on(GetFunctionUrlConfigCommand, { FunctionName: SST_FUNCTION })
        .resolves({ FunctionUrl: SST_URL });

      expect(await resolveSelfhostApiUrl("us-east-1")).toBe(SST_NORMALIZED_URL);
    });

    it("walks every page of ListFunctions to find the function", async () => {
      // A busy account puts the target well past page one. An unpaginated call
      // passes every other test here and fails only against real AWS.
      const pagedFunction =
        "wraps-selfhost-production-SelfhostApiFunction-mtsxvhkr";
      lambdaMock
        .on(GetFunctionUrlConfigCommand, {
          FunctionName: SELFHOST_API_FUNCTION_NAME,
        })
        .rejects(notFound());
      lambdaMock
        .on(ListFunctionsCommand)
        .resolvesOnce({
          Functions: [{ FunctionName: "some-unrelated-function" }],
          NextMarker: "page-2",
        })
        .resolves({ Functions: [{ FunctionName: pagedFunction }] });
      lambdaMock
        .on(GetFunctionUrlConfigCommand, { FunctionName: pagedFunction })
        .resolves({ FunctionUrl: SST_URL });

      expect(await resolveSelfhostApiUrl("us-east-1")).toBe(SST_NORMALIZED_URL);
      expect(lambdaMock.commandCalls(ListFunctionsCommand)).toHaveLength(2);
    });

    it("returns null rather than guessing when several functions match", async () => {
      // The recovered URL is where the CLI POSTs the customer's control-plane
      // API key. Picking one of two candidates could send it to the wrong host.
      const other = "wraps-selfhost-production-SelfhostApiXyz789";
      lambdaMock
        .on(GetFunctionUrlConfigCommand, {
          FunctionName: SELFHOST_API_FUNCTION_NAME,
        })
        .rejects(notFound());
      lambdaMock.on(ListFunctionsCommand).resolves({
        Functions: [{ FunctionName: SST_FUNCTION }, { FunctionName: other }],
      });
      lambdaMock
        .on(GetFunctionUrlConfigCommand, { FunctionName: SST_FUNCTION })
        .resolves({ FunctionUrl: SST_URL });
      lambdaMock
        .on(GetFunctionUrlConfigCommand, { FunctionName: other })
        .resolves({ FunctionUrl: SST_URL });

      expect(await resolveSelfhostApiUrl("us-east-1")).toBeNull();
      const urlLookups = lambdaMock
        .commandCalls(GetFunctionUrlConfigCommand)
        .map((call) => call.args[0].input.FunctionName);
      expect(urlLookups).toEqual([SELFHOST_API_FUNCTION_NAME]);
    });

    // `sst.aws.Nextjs("SelfhostWeb")` creates several Lambdas under the very
    // same `wraps-selfhost-production-` prefix, so the prefix alone does not
    // identify the API — only the `SelfhostApi` logical name does.
    //
    // Each web Lambda is asserted on its own rather than as one list of two.
    // With two of them present the ambiguity guard would return null whether or
    // not the logical-name filter exists, so the filter would go untested. A
    // lone web Lambda is both the discriminating case and the dangerous one:
    // without the filter it is the single match and the CLI would hand the
    // customer's control-plane API key to the web app's URL.
    it.each([
      "wraps-selfhost-production-SelfhostWebServer123",
      "wraps-selfhost-production-SelfhostWebImageOptimizer456",
    ])("does not match the Nextjs app's Lambda %s", async (webFunction) => {
      lambdaMock
        .on(GetFunctionUrlConfigCommand, {
          FunctionName: SELFHOST_API_FUNCTION_NAME,
        })
        .rejects(notFound());
      lambdaMock
        .on(ListFunctionsCommand)
        .resolves({ Functions: [{ FunctionName: webFunction }] });
      lambdaMock
        .on(GetFunctionUrlConfigCommand, { FunctionName: webFunction })
        .resolves({ FunctionUrl: SST_URL });

      expect(await resolveSelfhostApiUrl("us-east-1")).toBeNull();
    });

    it("returns null when neither variant is deployed", async () => {
      lambdaMock.on(GetFunctionUrlConfigCommand).rejects(notFound());
      lambdaMock.on(ListFunctionsCommand).resolves({ Functions: [] });

      expect(await resolveSelfhostApiUrl("us-east-1")).toBeNull();
    });
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
