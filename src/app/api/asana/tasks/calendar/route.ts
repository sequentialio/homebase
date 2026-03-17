import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { asanaFetch, AsanaApiError } from "@/lib/asana/client"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const monthParam = request.nextUrl.searchParams.get("month") // YYYY-MM
  const now = new Date()
  const [year, monthNum] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1]

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from("asana_connections")
    .select("workspace_id")
    .eq("user_id", user.id)
    .single()

  if (!conn?.workspace_id) return NextResponse.json({ tasks: [] })

  try {
    const pad = (n: number) => String(n).padStart(2, "0")
    const startDate = `${year}-${pad(monthNum)}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const endDate = `${year}-${pad(monthNum)}-${lastDay}`

    // Search for tasks assigned to me with due dates in the month
    const data = await asanaFetch(
      user.id,
      `/workspaces/${conn.workspace_id}/tasks/search?due_on.after=${startDate}&due_on.before=${endDate}&completed=false&opt_fields=name,due_on,completed,permalink_url&limit=100`
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
    console.error("Asana calendar fetch error:", err)
    return NextResponse.json({ tasks: [] })
  }
}
