import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rl = await checkRateLimit(`${user.id}:/api/asana/disconnect`, { limit: 5, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const admin = createAdminClient()
  await admin.from("asana_connections").delete().eq("user_id", user.id)

  return NextResponse.json({ success: true })
}
