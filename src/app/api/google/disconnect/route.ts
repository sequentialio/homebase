import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", user.id)

  if (error) {
    console.error("Failed to disconnect Google:", error)
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
