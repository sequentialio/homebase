import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt } from "@/lib/google/client"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const settingsUrl = `${siteUrl}/settings?oauth=google`

  if (error) {
    return NextResponse.redirect(`${settingsUrl}&status=error&reason=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}&status=error&reason=missing_params`)
  }

  const cookieStore = await cookies()
  const storedState = cookieStore.get("google_oauth_state")?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${settingsUrl}&status=error&reason=state_mismatch`)
  }
  cookieStore.delete("google_oauth_state")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${siteUrl}/login`)

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        code,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error("Google token exchange failed:", text)
      return NextResponse.redirect(`${settingsUrl}&status=error&reason=token_exchange`)
    }

    const tokens = await tokenRes.json()

    if (!tokens.refresh_token) {
      // This happens if the user already granted access and didn't get a fresh refresh token.
      // The prompt=consent in connect should prevent this, but handle it gracefully.
      console.error("No refresh token returned from Google")
      return NextResponse.redirect(`${settingsUrl}&status=error&reason=no_refresh_token`)
    }

    const expiresAt = new Date(
      Date.now() + (tokens.expires_in || 3600) * 1000
    ).toISOString()

    // Get the user's email from Google
    let email: string | null = null
    try {
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        email = profile.email ?? null
      }
    } catch {
      // non-fatal
    }

    const admin = createAdminClient()
    const { error: upsertError } = await admin
      .from("google_calendar_connections")
      .upsert(
        {
          user_id: user.id,
          access_token_enc: encrypt(tokens.access_token),
          refresh_token_enc: encrypt(tokens.refresh_token),
          expires_at: expiresAt,
          email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (upsertError) {
      console.error("Failed to save Google connection:", upsertError)
      return NextResponse.redirect(`${settingsUrl}&status=error&reason=db_error`)
    }

    return NextResponse.redirect(`${settingsUrl}&status=connected`)
  } catch (err) {
    console.error("Google OAuth callback error:", err)
    return NextResponse.redirect(`${settingsUrl}&status=error&reason=unknown`)
  }
}
