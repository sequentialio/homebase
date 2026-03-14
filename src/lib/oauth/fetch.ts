/**
 * OAuth Authenticated Fetch Wrapper
 *
 * Handles token expiry + automatic refresh before making API calls.
 * Provides a typed error class for OAuth-specific failures (401, 429).
 *
 * SETUP:
 * 1. Replace PROVIDER_TABLE and PROVIDER_TOKEN_URL with your provider's values
 * 2. Update the token refresh body fields (grant_type, client_id, etc.) for your provider
 * 3. Use oauthFetch() instead of raw fetch() anywhere you call a protected API
 *
 * Pattern from homebase Asana integration — generalized for reuse.
 */

import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt, decrypt } from "@/lib/encrypt"

// ── Config — replace with your provider ──────────────────────────

const PROVIDER_TABLE = "provider_connections"    // e.g. "asana_connections"
const PROVIDER_BASE_URL = "https://api.example.com/v1"
const PROVIDER_TOKEN_URL = "https://api.example.com/oauth/token"
const PROVIDER_ENV_PREFIX = "PROVIDER"           // e.g. "ASANA" → uses ASANA_CLIENT_ID etc.

// ── Error types ───────────────────────────────────────────────────

export class OAuthApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "OAuthApiError"
    this.status = status
  }
}

export class OAuthRateLimitError extends OAuthApiError {
  retryAfter: number
  constructor(message: string, retryAfter: number) {
    super(message, 429)
    this.name = "OAuthRateLimitError"
    this.retryAfter = retryAfter
  }
}

// ── Token management ──────────────────────────────────────────────

/**
 * Refresh the access token using the stored refresh token.
 * Persists the new tokens (encrypted) back to the database.
 */
async function refreshAccessToken(userId: string): Promise<string> {
  const admin = createAdminClient()

  const { data: conn, error } = await admin
    .from(PROVIDER_TABLE)
    .select("refresh_token_enc")
    .eq("user_id", userId)
    .single()

  if (error || !conn) {
    throw new OAuthApiError("OAuth connection not found", 401)
  }

  const refreshToken = decrypt(conn.refresh_token_enc)

  // SETUP: update body fields for your provider
  const res = await fetch(PROVIDER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env[`${PROVIDER_ENV_PREFIX}_CLIENT_ID`]!,
      client_secret: process.env[`${PROVIDER_ENV_PREFIX}_CLIENT_SECRET`]!,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    throw new OAuthApiError("Failed to refresh token", res.status)
  }

  const data = await res.json()
  const newAccessToken: string = data.access_token
  const newRefreshToken: string = data.refresh_token || refreshToken
  const expiresIn: number = data.expires_in || 3600

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  await admin
    .from(PROVIDER_TABLE)
    .update({
      access_token_enc: encrypt(newAccessToken),
      refresh_token_enc: encrypt(newRefreshToken),
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  return newAccessToken
}

/**
 * Get a valid (non-expired) access token for a user.
 * Refreshes automatically if within 60 seconds of expiry.
 */
async function getAccessToken(userId: string): Promise<string> {
  const admin = createAdminClient()

  const { data: conn, error } = await admin
    .from(PROVIDER_TABLE)
    .select("access_token_enc, token_expires_at")
    .eq("user_id", userId)
    .single()

  if (error || !conn) {
    throw new OAuthApiError("OAuth connection not found", 401)
  }

  // Refresh if expired or expiring within 60 seconds
  const isExpired = new Date(conn.token_expires_at) <= new Date(Date.now() + 60_000)

  if (isExpired) {
    return refreshAccessToken(userId)
  }

  return decrypt(conn.access_token_enc)
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Authenticated fetch wrapper for a protected API.
 * Injects the Bearer token, handles 429 rate limit errors,
 * and throws typed errors for non-2xx responses.
 *
 * @param userId  Supabase user ID — used to look up/refresh the token
 * @param path    Relative path (e.g. "/users/me") or absolute URL
 * @param init    Standard RequestInit options (method, body, headers, etc.)
 *
 * @example
 * const data = await oauthFetch(user.id, "/projects", { method: "GET" })
 */
export async function oauthFetch(
  userId: string,
  path: string,
  init?: RequestInit
): Promise<any> {
  const token = await getAccessToken(userId)
  const url = path.startsWith("http") ? path : `${PROVIDER_BASE_URL}${path}`

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") || "60")
    throw new OAuthRateLimitError("Rate limit exceeded", retryAfter)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new OAuthApiError(`API error: ${res.status} ${body}`, res.status)
  }

  // Some APIs return 200 with empty body (e.g. DELETE)
  const text = await res.text()
  if (!text) return { data: null }

  return JSON.parse(text)
}

// ── Token revocation ──────────────────────────────────────────────

/**
 * Revoke the user's access token with the provider.
 * Best-effort — errors are logged but not thrown (safe to call on logout/disconnect).
 *
 * SETUP: update PROVIDER_REVOKE_URL and body fields for your provider.
 */
export async function revokeToken(userId: string): Promise<void> {
  const PROVIDER_REVOKE_URL = "https://api.example.com/oauth/revoke"

  try {
    const admin = createAdminClient()
    const { data: conn } = await admin
      .from(PROVIDER_TABLE)
      .select("access_token_enc")
      .eq("user_id", userId)
      .single()

    if (!conn) return

    const accessToken = decrypt(conn.access_token_enc)

    await fetch(PROVIDER_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env[`${PROVIDER_ENV_PREFIX}_CLIENT_ID`]!,
        client_secret: process.env[`${PROVIDER_ENV_PREFIX}_CLIENT_SECRET`]!,
        token: accessToken,
      }).toString(),
    })
  } catch (err) {
    console.error("Failed to revoke token (best-effort):", err)
  }
}
