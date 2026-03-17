import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomBytes } from "crypto"
import { cookies } from "next/headers"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  if (!user) return NextResponse.redirect(`${siteUrl}/login`)

  const state = randomBytes(32).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set("asana_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ASANA_CLIENT_ID!,
    redirect_uri: process.env.ASANA_REDIRECT_URI!,
    state,
  })

  return NextResponse.redirect(
    `https://app.asana.com/-/oauth_authorize?${params}`
  )
}
