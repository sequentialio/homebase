import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { googleCalendarFetch, GoogleApiError } from "@/lib/google/client"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const monthParam = request.nextUrl.searchParams.get("month") // YYYY-MM
  const now = new Date()
  const [year, monthNum] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1]

  // Check connection exists
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("user_id")
    .eq("user_id", user.id)
    .single()

  if (!conn) {
    return NextResponse.json(
      { error: "Google Calendar not connected", code: "not_connected" },
      { status: 401 }
    )
  }

  try {
    const pad = (n: number) => String(n).padStart(2, "0")
    const timeMin = `${year}-${pad(monthNum)}-01T00:00:00Z`
    // Last moment of the month
    const lastDay = new Date(year, monthNum, 0).getDate()
    const timeMax = `${year}-${pad(monthNum)}-${pad(lastDay)}T23:59:59Z`

    // Fetch events from all calendars the user can see
    const data = await googleCalendarFetch(
      user.id,
      `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`
    )

    const events = (data.items ?? []).map((item: any) => ({
      id: item.id,
      summary: item.summary ?? "(No title)",
      start: item.start?.dateTime ?? item.start?.date ?? null,
      end: item.end?.dateTime ?? item.end?.date ?? null,
      allDay: !!item.start?.date,
      htmlLink: item.htmlLink ?? null,
    }))

    return NextResponse.json({ events })
  } catch (err) {
    if (err instanceof GoogleApiError) {
      if (err.status === 401) {
        return NextResponse.json(
          { error: "Google connection expired", code: "auth_expired" },
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
    console.error("Google Calendar fetch error:", err)
    return NextResponse.json({ events: [] })
  }
}
