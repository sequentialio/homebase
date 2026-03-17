import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false })

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("email, updated_at")
    .eq("user_id", user.id)
    .single()

  if (!conn) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected: true,
    email: conn.email,
    connected_at: conn.updated_at,
  })
}
