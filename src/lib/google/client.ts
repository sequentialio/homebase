/**
 * Google Calendar API client — token management, encryption, authenticated fetch.
 * Uses GOOGLE_TOKEN_ENCRYPTION_KEY for AES-256-GCM token storage.
 * Server-only: never import from client components.
 */

import "server-only"

import { randomBytes, createCipheriv, createDecipheriv } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

// ── Crypto ──────────────────────────────────────────────────────────

const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-char hex string")
  }
  return Buffer.from(hex, "hex")
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decrypt(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, "base64")
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

// ── Errors ──────────────────────────────────────────────────────────

export class GoogleApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "GoogleApiError"
    this.status = status
  }
}

// ── Token management ────────────────────────────────────────────────

async function refreshAccessToken(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("refresh_token_enc")
    .eq("user_id", userId)
    .single()

  if (!conn) throw new GoogleApiError("Google connection not found", 401)

  const refreshToken = decrypt(conn.refresh_token_enc)

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new GoogleApiError(`Failed to refresh Google token: ${text}`, res.status)
  }

  const data = await res.json()
  const newAccessToken: string = data.access_token
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()

  await admin
    .from("google_calendar_connections")
    .update({
      access_token_enc: encrypt(newAccessToken),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  return newAccessToken
}

async function getAccessToken(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("access_token_enc, expires_at")
    .eq("user_id", userId)
    .single()

  if (!conn) throw new GoogleApiError("Google connection not found", 401)

  const isExpired = new Date(conn.expires_at) <= new Date(Date.now() + 60_000)
  if (isExpired) return refreshAccessToken(userId)

  return decrypt(conn.access_token_enc)
}

// ── Public API ───────────────────────────────────────────────────────

export async function googleCalendarFetch(
  userId: string,
  path: string,
  init?: RequestInit
): Promise<any> {
  const token = await getAccessToken(userId)
  const url = path.startsWith("http")
    ? path
    : `https://www.googleapis.com/calendar/v3${path}`

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (res.status === 429) throw new GoogleApiError("Rate limit exceeded", 429)
  if (!res.ok) {
    const body = await res.text()
    throw new GoogleApiError(`Google API ${res.status}: ${body}`, res.status)
  }

  const text = await res.text()
  if (!text) return {}
  return JSON.parse(text)
}
