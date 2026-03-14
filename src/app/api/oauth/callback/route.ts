/**
 * Generic OAuth Callback Route
 *
 * Handles the redirect from any OAuth provider after user authorization.
 * Exchanges the authorization code for tokens, encrypts them, and stores
 * them in a connections table.
 *
 * SETUP:
 * 1. Replace [PROVIDER] placeholders with your OAuth provider name (e.g. "asana", "google")
 * 2. Update the token exchange URL and body for your provider
 * 3. Create a `[provider]_connections` table in Supabase:
 *    - user_id (uuid, FK to auth.users)
 *    - access_token_enc (text)     -- AES-256-GCM encrypted
 *    - refresh_token_enc (text)    -- AES-256-GCM encrypted
 *    - token_expires_at (timestamptz)
 *    - connected_at (timestamptz)
 * 4. Set TOKEN_ENCRYPTION_KEY env var (64-char hex)
 * 5. Add env vars: [PROVIDER]_CLIENT_ID, [PROVIDER]_CLIENT_SECRET, [PROVIDER]_REDIRECT_URI
 * 6. Create the connect initiation route at /api/oauth/connect/route.ts
 *    (generates CSRF state + redirects to provider authorize URL)
 *
 * CSRF pattern: randomBytes(32) → stored in httpOnly cookie → verified on callback.
 *
 * Pattern from homebase Asana integration — generalized for reuse.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt } from "@/lib/encrypt"
import { cookies } from "next/headers"

// SETUP: replace with your provider name (used for env var names and DB table)
const PROVIDER = "PROVIDER" // e.g. "ASANA", "GOOGLE"
const PROVIDER_TABLE = "provider_connections" // e.g. "asana_connections"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const redirectBase = `${siteUrl}/settings?oauth=${PROVIDER.toLowerCase()}`

  // Handle errors from the provider
  if (error) {
    console.error(`${PROVIDER} OAuth error:`, error)
    return NextResponse.redirect(`${redirectBase}&status=error&reason=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}&status=error&reason=missing_params`)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get(`${PROVIDER.toLowerCase()}_oauth_state`)?.value

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${redirectBase}&status=error&reason=state_mismatch`)
  }

  cookieStore.delete(`${PROVIDER.toLowerCase()}_oauth_state`)

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`)
  }

  try {
    // Exchange authorization code for tokens
    // SETUP: update URL and body fields for your provider
    const tokenResponse = await fetch("https://provider.example.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env[`${PROVIDER}_CLIENT_ID`]!,
        client_secret: process.env[`${PROVIDER}_CLIENT_SECRET`]!,
        redirect_uri: process.env[`${PROVIDER}_REDIRECT_URI`]!,
        code,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text()
      console.error(`${PROVIDER} token exchange failed:`, text)
      return NextResponse.redirect(`${redirectBase}&status=error&reason=token_exchange`)
    }

    // SETUP: adjust field names to match your provider's token response shape
    const tokens = await tokenResponse.json()
    // Expected shape: { access_token, refresh_token, expires_in, ... }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Encrypt tokens before storing (AES-256-GCM via lib/encrypt.ts)
    const accessTokenEncrypted = encrypt(tokens.access_token)
    const refreshTokenEncrypted = tokens.refresh_token ? encrypt(tokens.refresh_token) : null

    // Upsert using admin client to bypass RLS
    const admin = createAdminClient()
    const { error: upsertError } = await admin
      .from(PROVIDER_TABLE)
      .upsert(
        {
          user_id: user.id,
          access_token_enc: accessTokenEncrypted,
          refresh_token_enc: refreshTokenEncrypted,
          token_expires_at: expiresAt,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (upsertError) {
      console.error(`Failed to save ${PROVIDER} connection:`, upsertError)
      return NextResponse.redirect(`${redirectBase}&status=error&reason=db_error`)
    }

    return NextResponse.redirect(`${redirectBase}&status=connected`)
  } catch (err) {
    console.error(`${PROVIDER} OAuth callback error:`, err)
    return NextResponse.redirect(`${redirectBase}&status=error&reason=unknown`)
  }
}
