/**
 * Plaid API client + AES-256-GCM encryption for access tokens.
 * Server-only — never import from client components.
 */
import "server-only"

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid"
import { randomBytes, createCipheriv, createDecipheriv } from "crypto"

// ── Encryption ────────────────────────────────────────────────────────────────

const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.PLAID_TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64)
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEY must be a 64-char hex string")
  return Buffer.from(hex, "hex")
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptToken(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, "base64")
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

// ── Plaid client ──────────────────────────────────────────────────────────────

const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments

const config = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
})

export const plaid = new PlaidApi(config)
