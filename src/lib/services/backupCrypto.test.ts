import { describe, it, expect } from "vitest";
import { encryptPayload, decryptPayload } from "./backupCrypto";

describe("backupCrypto - AES-256-GCM Encryption / Decryption", () => {
  const sampleData = Buffer.from("CREATE TABLE accounts (id text); SELECT 42;", "utf-8");

  it("should return plaintext unchanged when no passphrase provided", () => {
    const res = encryptPayload(sampleData, "");
    expect(res).toEqual(sampleData);

    const decrypted = decryptPayload(sampleData, "");
    expect(decrypted).toEqual(sampleData);
  });

  it("should encrypt and decrypt payload successfully with correct passphrase", () => {
    const encrypted = encryptPayload(sampleData, "test-passphrase-123");
    expect(encrypted.length).toBeGreaterThan(sampleData.length);
    expect(encrypted.subarray(0, 8).toString("utf-8")).toBe("BLABENC1");

    const decrypted = decryptPayload(encrypted, "test-passphrase-123");
    expect(decrypted.toString("utf-8")).toBe(sampleData.toString("utf-8"));
  });

  it("should throw error if attempting to decrypt with incorrect passphrase", () => {
    const encrypted = encryptPayload(sampleData, "correct-passphrase");
    expect(() => decryptPayload(encrypted, "wrong-passphrase")).toThrow(
      "Failed to decrypt backup. Invalid decryption passphrase or corrupted archive."
    );
  });

  it("should throw error if attempting to decrypt without passphrase when payload is encrypted", () => {
    const encrypted = encryptPayload(sampleData, "correct-passphrase");
    expect(() => decryptPayload(encrypted, "")).toThrow(
      "Backup payload is encrypted but no decryption passphrase was provided."
    );
  });
});
