import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { asanaFetch, AsanaApiError } from "@/lib/asana/client"
import { checkRateLimit } from "@/lib/rate-limit"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rl = await checkRateLimit(`${user.id}:/api/asana/tasks`, { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from("asana_connections")
    .select("workspace_id")
    .eq("user_id", user.id)
    .single()

  if (!conn?.workspace_id) {
    return NextResponse.json(
      { error: "Asana not connected", code: "not_connected" },
      { status: 401 }
    )
  }

  try {
    const data = await asanaFetch(
      user.id,
      `/workspaces/${conn.workspace_id}/tasks/search?completed=false&opt_fields=name,due_on,completed,permalink_url,memberships.project.name,memberships.project.gid&limit=100`
    )
    return NextResponse.json({ tasks: data.data ?? [] })
  } catch (err) {
    if (err instanceof AsanaApiError) {
      if (err.status === 401) {
        return NextResponse.json(
          { error: "Asana connection expired", code: "auth_expired" },
          { status: 401 }
        )
      }
      if (err.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded", code: "rate_limit" },
          { status: 429 }
        )
      }
    }
    console.error("Asana tasks fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}
