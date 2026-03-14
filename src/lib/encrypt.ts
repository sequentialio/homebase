/**
 * AES-256-GCM Encryption Utility
 *
 * Used for encrypting sensitive values before storing them in the database
 * (e.g. OAuth access/refresh tokens, API keys, secrets).
 *
 * SETUP:
 * 1. Generate a 64-char hex key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * 2. Add it to your .env: TOKEN_ENCRYPTION_KEY=<64-char hex>
 * 3. Update the env var name in getKey() below if you want a more specific name.
 *
 * Format: base64(iv[12] + authTag[16] + ciphertext)
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto"

const IV_LENGTH = 12
const TAG_LENGTH = 16

// ── Config ───────────────────────────────────────────────────────

/**
 * SETUP: change the env var name to match your use case.
 * e.g. ASANA_TOKEN_ENCRYPTION_KEY, OAUTH_TOKEN_ENCRYPTION_KEY, etc.
 */
const ENV_VAR = "TOKEN_ENCRYPTION_KEY"

function getKey(): Buffer {
  const hex = process.env[ENV_VAR]
  if (!hex || hex.length !== 64) {
    throw new Error(
      `${ENV_VAR} must be a 64-character hex string (32 bytes). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    )
  }
  return Buffer.from(hex, "hex")
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64(iv + authTag + ciphertext).
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted])
  return combined.toString("base64")
}

/**
 * Decrypt a base64-encoded string produced by encrypt().
 * Throws if the data is malformed or the key is wrong.
 */
export function decrypt(encoded: string): string {
  const key = getKey()
  const combined = Buffer.from(encoded, "base64")

  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short.")
  }

  const iv = combined.subarray(0, IV_LENGTH)
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}
