import { describe, expect, it } from "vitest";
import {
  convertToSMTPPassword,
  getSMTPConnectionDetails,
  getSMTPEndpoint,
} from "./smtp.js";

describe("convertToSMTPPassword", () => {
  it("converts AWS secret key to SMTP password", () => {
    // Test with a known secret key and region
    const secretKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    const region = "us-east-1";

    const smtpPassword = convertToSMTPPassword(secretKey, region);

    // The result should be a base64 encoded string
    expect(smtpPassword).toBeDefined();
    expect(typeof smtpPassword).toBe("string");
    expect(smtpPassword.length).toBeGreaterThan(0);

    // Base64 encoded string should only contain valid base64 characters
    expect(smtpPassword).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("produces different passwords for different regions", () => {
    const secretKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

    const passwordUsEast1 = convertToSMTPPassword(secretKey, "us-east-1");
    const passwordUsWest2 = convertToSMTPPassword(secretKey, "us-west-2");
    const passwordEuWest1 = convertToSMTPPassword(secretKey, "eu-west-1");

    expect(passwordUsEast1).not.toBe(passwordUsWest2);
    expect(passwordUsEast1).not.toBe(passwordEuWest1);
    expect(passwordUsWest2).not.toBe(passwordEuWest1);
  });

  it("produces different passwords for different secret keys", () => {
    const region = "us-east-1";

    const password1 = convertToSMTPPassword("secretKey1", region);
    const password2 = convertToSMTPPassword("secretKey2", region);

    expect(password1).not.toBe(password2);
  });

  it("produces consistent output for the same inputs", () => {
    const secretKey = "consistentTestKey123";
    const region = "us-east-1";

    const password1 = convertToSMTPPassword(secretKey, region);
    const password2 = convertToSMTPPassword(secretKey, region);

    expect(password1).toBe(password2);
  });

  it("produces a 33-byte output (version byte + 32-byte HMAC)", () => {
    const secretKey = "testSecretKey";
    const region = "us-east-1";

    const password = convertToSMTPPassword(secretKey, region);
    const decoded = Buffer.from(password, "base64");

    // Should be 33 bytes: 1 byte version + 32 bytes HMAC-SHA256
    expect(decoded.length).toBe(33);

    // First byte should be version 0x04
    expect(decoded[0]).toBe(0x04);
  });
});

describe("getSMTPEndpoint", () => {
  it("returns correct endpoint for US regions", () => {
    expect(getSMTPEndpoint("us-east-1")).toBe(
      "email-smtp.us-east-1.amazonaws.com"
    );
    expect(getSMTPEndpoint("us-east-2")).toBe(
      "email-smtp.us-east-2.amazonaws.com"
    );
    expect(getSMTPEndpoint("us-west-1")).toBe(
      "email-smtp.us-west-1.amazonaws.com"
    );
    expect(getSMTPEndpoint("us-west-2")).toBe(
      "email-smtp.us-west-2.amazonaws.com"
    );
  });

  it("returns correct endpoint for EU regions", () => {
    expect(getSMTPEndpoint("eu-west-1")).toBe(
      "email-smtp.eu-west-1.amazonaws.com"
    );
    expect(getSMTPEndpoint("eu-west-2")).toBe(
      "email-smtp.eu-west-2.amazonaws.com"
    );
    expect(getSMTPEndpoint("eu-central-1")).toBe(
      "email-smtp.eu-central-1.amazonaws.com"
    );
  });

  it("returns correct endpoint for AP regions", () => {
    expect(getSMTPEndpoint("ap-southeast-1")).toBe(
      "email-smtp.ap-southeast-1.amazonaws.com"
    );
    expect(getSMTPEndpoint("ap-southeast-2")).toBe(
      "email-smtp.ap-southeast-2.amazonaws.com"
    );
    expect(getSMTPEndpoint("ap-northeast-1")).toBe(
      "email-smtp.ap-northeast-1.amazonaws.com"
    );
  });
});

describe("getSMTPConnectionDetails", () => {
  it("returns correct connection details for a region", () => {
    const details = getSMTPConnectionDetails("us-east-1");

    expect(details).toEqual({
      host: "email-smtp.us-east-1.amazonaws.com",
      port: 587,
      secure: false, // STARTTLS
    });
  });

  it("returns port 587 (STARTTLS) for all regions", () => {
    const regions = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];

    for (const region of regions) {
      const details = getSMTPConnectionDetails(region);
      expect(details.port).toBe(587);
      expect(details.secure).toBe(false);
    }
  });

  it("host matches getSMTPEndpoint output", () => {
    const regions = ["us-east-1", "eu-west-1", "ap-northeast-1"];

    for (const region of regions) {
      const details = getSMTPConnectionDetails(region);
      const endpoint = getSMTPEndpoint(region);
      expect(details.host).toBe(endpoint);
    }
  });
});
