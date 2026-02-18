import { describe, expect, it } from "vitest";

/**
 * Tests verifying that better-auth encrypts TOTP secrets and backup codes
 * before storing them in the database.
 *
 * Bug report: "2FA Secrets and Backup Codes Stored in Plaintext"
 * Finding: better-auth DOES encrypt both fields using XChaCha20-Poly1305
 * symmetric encryption, keyed by BETTER_AUTH_SECRET. This is NOT a vulnerability.
 *
 * Evidence from better-auth@1.4.17 source (dist/plugins/two-factor/index.mjs):
 *   - TOTP secret: symmetricEncrypt({ key: ctx.context.secret, data: secret })
 *   - Backup codes: storeBackupCodes defaults to "encrypted", which triggers
 *     symmetricEncrypt({ data: JSON.stringify(backupCodes), key: secret })
 *
 * The symmetricEncrypt function (dist/crypto/index.mjs) uses:
 *   xchacha20poly1305 from @noble/ciphers with managed nonce
 *   Key is derived via SHA-256 hash of BETTER_AUTH_SECRET
 *   Output is hex-encoded ciphertext
 */

// Import the actual crypto functions that better-auth uses internally
// to verify encryption produces non-plaintext output
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

describe("Two-Factor Encryption (better-auth behavior)", () => {
  it("should encrypt TOTP secret using symmetricEncrypt (not stored as plaintext)", async () => {
    const testSecret = "BETTER_AUTH_SECRET_VALUE_FOR_TEST";
    const totpSeed = "JBSWY3DPEHPK3PXP"; // Example TOTP secret (base32)

    const encrypted = await symmetricEncrypt({
      key: testSecret,
      data: totpSeed,
    });

    // The encrypted value must NOT be the same as the plaintext
    expect(encrypted).not.toBe(totpSeed);

    // The encrypted value should be a hex string (XChaCha20-Poly1305 output)
    expect(encrypted).toMatch(/^[0-9a-f]+$/);

    // The encrypted value should be significantly longer than the input
    // (nonce + ciphertext + auth tag)
    expect(encrypted.length).toBeGreaterThan(totpSeed.length * 2);

    // Verify roundtrip: decryption should recover the original secret
    const decrypted = await symmetricDecrypt({
      key: testSecret,
      data: encrypted,
    });
    expect(decrypted).toBe(totpSeed);
  });

  it("should encrypt backup codes using symmetricEncrypt (not stored as plaintext)", async () => {
    const testSecret = "BETTER_AUTH_SECRET_VALUE_FOR_TEST";
    const backupCodes = [
      "abc12-defgh",
      "ijklm-nopqr",
      "stuvw-xyz01",
      "23456-78901",
      "abcde-fghij",
    ];
    const backupCodesJson = JSON.stringify(backupCodes);

    const encrypted = await symmetricEncrypt({
      key: testSecret,
      data: backupCodesJson,
    });

    // Encrypted output must not contain any plaintext backup code
    expect(encrypted).not.toContain("abc12");
    expect(encrypted).not.toContain("defgh");
    expect(encrypted).not.toBe(backupCodesJson);

    // Should be hex-encoded ciphertext
    expect(encrypted).toMatch(/^[0-9a-f]+$/);

    // Verify roundtrip
    const decrypted = await symmetricDecrypt({
      key: testSecret,
      data: encrypted,
    });
    expect(JSON.parse(decrypted)).toEqual(backupCodes);
  });

  it("should produce different ciphertext for the same input (managed nonce)", async () => {
    const testSecret = "BETTER_AUTH_SECRET_VALUE_FOR_TEST";
    const data = "SAME_INPUT_DATA";

    const encrypted1 = await symmetricEncrypt({ key: testSecret, data });
    const encrypted2 = await symmetricEncrypt({ key: testSecret, data });

    // XChaCha20-Poly1305 with managed nonce should produce different ciphertext
    // each time, preventing frequency analysis attacks
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should fail decryption with wrong key", async () => {
    const correctKey = "correct-secret-key-for-encryption";
    const wrongKey = "wrong-secret-key-for-decryption!!";
    const data = "sensitive-totp-secret";

    const encrypted = await symmetricEncrypt({ key: correctKey, data });

    // Decryption with the wrong key should throw (auth tag verification fails)
    await expect(
      symmetricDecrypt({ key: wrongKey, data: encrypted })
    ).rejects.toThrow();
  });

  it("should have twoFactor plugin configured with default encrypted backup codes", async () => {
    // The twoFactor plugin in better-auth defaults storeBackupCodes to "encrypted"
    // This is set in the plugin initialization:
    //   const backupCodeOptions = { storeBackupCodes: "encrypted", ...options?.backupCodeOptions };
    //
    // Our auth config (packages/auth/src/index.ts) does NOT override this default:
    //   twoFactor({ issuer: "Wraps" })
    //
    // Therefore backup codes are encrypted by default.
    const { auth } = await import("../index");

    const twoFactorPlugin = auth.options.plugins?.find(
      (plugin: any) => plugin?.id === "two-factor"
    );

    expect(twoFactorPlugin).toBeDefined();
    expect(twoFactorPlugin?.id).toBe("two-factor");

    // The plugin options should NOT explicitly disable encryption
    // (no backupCodeOptions.storeBackupCodes override means default "encrypted" is used)
    const pluginOptions = (twoFactorPlugin as any)?.options;
    const backupCodeSetting =
      pluginOptions?.backupCodeOptions?.storeBackupCodes;

    // Either undefined (using default "encrypted") or explicitly "encrypted"
    expect(
      backupCodeSetting === undefined || backupCodeSetting === "encrypted"
    ).toBe(true);
  });
});
