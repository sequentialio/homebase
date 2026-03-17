import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { CalendarContent } from "./calendar-content"

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: calendarEvents },
    { data: cleaningDuties },
  ] = await Promise.all([
    supabase.from("calendar_events").select("*"),
    supabase.from("cleaning_duties").select("id, name, next_due"),
  ])

  // Check integrations
  const admin = createAdminClient()
  const [{ data: asanaConn }, { data: googleConn }] = await Promise.all([
    admin
      .from("asana_connections")
      .select("workspace_id, workspace_name")
      .eq("user_id", user.id)
      .single(),
    admin
      .from("google_calendar_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .single(),
  ])

  return (
    <CalendarContent
      userId={user.id}
      initialEvents={calendarEvents ?? []}
      cleaningDuties={cleaningDuties ?? []}
      hasAsana={!!asanaConn?.workspace_id}
      hasGoogle={!!googleConn}
    />
  )
}
