import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false })

  const rl = await checkRateLimit(`${user.id}:/api/asana/status`, { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const admin = createAdminClient()
  const { data } = await admin
    .from("asana_connections")
    .select("workspace_name, workspace_id, created_at")
    .eq("user_id", user.id)
    .single()

  if (!data) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected: true,
    workspace_name: data.workspace_name,
    workspace_id: data.workspace_id,
    connected_at: data.created_at,
  })
}
