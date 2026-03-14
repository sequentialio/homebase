import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // Validate redirect path to prevent open redirect attacks
  const rawNext = searchParams.get("next") ?? "/dashboard"
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if this is a first-time invited user who needs to set a password.
      // Invited users have the "invited_at" field set and may not have a password yet.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const isInvited = !!user.invited_at
        const signInCount = user.app_metadata?.sign_in_count ?? 0
        // If invited and this is their first sign-in, redirect to set password
        if (isInvited && signInCount <= 1) {
          return NextResponse.redirect(`${origin}/reset-password`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
