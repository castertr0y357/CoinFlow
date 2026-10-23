import crypto from "crypto";

export const ENCRYPTION_MAGIC = Buffer.from("BLABENC1", "utf-8");

/**
 * Encrypt payload using AES-256-GCM with PBKDF2-HMAC-SHA256 key derivation.
 * Standardized to match the multi-app encryption signature:
 * MAGIC (8 bytes) + salt (16 bytes) + nonce (12 bytes) + ciphertext + tag (16 bytes)
 */
export function encryptPayload(data: Buffer, passphrase?: string | null): Buffer {
  if (!passphrase || passphrase.trim() === "") {
    return data;
  }

  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(passphrase.trim(), salt, 200000, 32, "sha256");
  const nonce = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([ENCRYPTION_MAGIC, salt, nonce, ciphertext, tag]);
}

/**
 * Decrypt an AES-256-GCM encrypted payload, or return as-is if unencrypted.
 */
export function decryptPayload(data: Buffer, passphrase?: string | null): Buffer {
  if (data.length < 8 || !data.subarray(0, 8).equals(ENCRYPTION_MAGIC)) {
    return data;
  }

  if (!passphrase || passphrase.trim() === "") {
    throw new Error("Backup payload is encrypted but no decryption passphrase was provided.");
  }

  if (data.length < 8 + 16 + 12 + 16) {
    throw new Error("Corrupted encrypted backup: file is too small.");
  }

  const salt = data.subarray(8, 24);
  const nonce = data.subarray(24, 36);
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(36, data.length - 16);

  const key = crypto.pbkdf2Sync(passphrase.trim(), salt, 200000, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error("Failed to decrypt backup. Invalid decryption passphrase or corrupted archive.");
  }
}
