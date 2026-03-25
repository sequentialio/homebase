import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { CalendarContent } from "./calendar-content"

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()
  const [
    { data: calendarEvents },
    { data: cleaningDuties },
    { data: googleConn },
    { data: sharedListItems },
  ] = await Promise.all([
    supabase.from("calendar_events").select("*"),
    supabase.from("cleaning_duties").select("id, name, next_due"),
    admin
      .from("google_calendar_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .single(),
    (supabase as any)
      .from("shared_list_items")
      .select("id, title, due_date, checked, list_id, shared_lists(name)")
      .not("due_date", "is", null),
  ])

  return (
    <CalendarContent
      userId={user.id}
      initialEvents={calendarEvents ?? []}
      cleaningDuties={cleaningDuties ?? []}
      hasGoogle={!!googleConn}
      sharedListItems={sharedListItems ?? []}
    />
  )
}
