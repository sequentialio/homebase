import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt } from "@/lib/asana/client"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const settingsUrl = `${siteUrl}/settings?oauth=asana`

  if (error) {
    return NextResponse.redirect(`${settingsUrl}&status=error&reason=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}&status=error&reason=missing_params`)
  }

  const cookieStore = await cookies()
  const storedState = cookieStore.get("asana_oauth_state")?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${settingsUrl}&status=error&reason=state_mismatch`)
  }
  cookieStore.delete("asana_oauth_state")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${siteUrl}/login`)

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://app.asana.com/-/oauth_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ASANA_CLIENT_ID!,
        client_secret: process.env.ASANA_CLIENT_SECRET!,
        redirect_uri: process.env.ASANA_REDIRECT_URI!,
        code,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error("Asana token exchange failed:", text)
      return NextResponse.redirect(`${settingsUrl}&status=error&reason=token_exchange`)
    }

    const tokens = await tokenRes.json()
    const expiresAt = new Date(
      Date.now() + (tokens.expires_in || 3600) * 1000
    ).toISOString()

    // Get default workspace
    let workspaceId: string | null = null
    let workspaceName: string | null = null
    try {
      const wsRes = await fetch(
        "https://app.asana.com/api/1.0/users/me/workspaces",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      )
      if (wsRes.ok) {
        const wsData = await wsRes.json()
        if (wsData.data?.length > 0) {
          workspaceId = wsData.data[0].gid
          workspaceName = wsData.data[0].name
        }
      }
    } catch {
      // workspace is optional — non-fatal
    }

    const admin = createAdminClient()
    const { error: upsertError } = await admin
      .from("asana_connections")
      .upsert(
        {
          user_id: user.id,
          access_token_enc: encrypt(tokens.access_token),
          refresh_token_enc: tokens.refresh_token
            ? encrypt(tokens.refresh_token)
            : encrypt(""),
          expires_at: expiresAt,
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (upsertError) {
      console.error("Failed to save Asana connection:", upsertError)
      return NextResponse.redirect(`${settingsUrl}&status=error&reason=db_error`)
    }

    return NextResponse.redirect(`${settingsUrl}&status=connected`)
  } catch (err) {
    console.error("Asana OAuth callback error:", err)
    return NextResponse.redirect(`${settingsUrl}&status=error&reason=unknown`)
  }
}
