import { describe, expect, it } from "vitest";
import { AssumeRoleError, classifyAssumeRoleError } from "../assume-role";

describe("classifyAssumeRoleError", () => {
  it("classifies AccessDenied by error name", () => {
    const err = new Error("some message");
    err.name = "AccessDenied";
    expect(classifyAssumeRoleError(err)).toBe("ACCESS_DENIED");
  });

  it("classifies INVALID_TRUST_POLICY when message contains 'is not authorized to perform' (name is 'Error')", () => {
    const err = new Error(
      "User: arn:aws:sts::123456789012:assumed-role/wraps/session is not authorized to perform: sts:AssumeRole"
    );
    // name stays "Error" — the SDK v3 regression this plan fixes
    expect(err.name).toBe("Error");
    expect(classifyAssumeRoleError(err)).toBe("INVALID_TRUST_POLICY");
  });

  it("classifies INVALID_BACKEND_CREDENTIALS when message contains InvalidClientTokenId", () => {
    const err = new Error(
      "InvalidClientTokenId: the security token is invalid"
    );
    expect(classifyAssumeRoleError(err)).toBe("INVALID_BACKEND_CREDENTIALS");
  });

  it("classifies UNKNOWN for an unrecognised error", () => {
    expect(classifyAssumeRoleError(new Error("something totally random"))).toBe(
      "UNKNOWN"
    );
  });

  it("classifies UNKNOWN for a non-Error value", () => {
    expect(classifyAssumeRoleError("a plain string")).toBe("UNKNOWN");
  });
});

describe("AssumeRoleError", () => {
  it("sets code, name, and is instanceof Error", () => {
    const err = new AssumeRoleError("ACCESS_DENIED", "Access denied message");
    expect(err.code).toBe("ACCESS_DENIED");
    expect(err.name).toBe("AssumeRoleError");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Access denied message");
  });
});
