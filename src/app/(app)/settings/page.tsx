import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { SettingsContent } from "./settings-content"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()
  const [{ data: profile }, { data: asanaConn }, { data: googleConn }, { data: plaidItems }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    admin.from("asana_connections").select("workspace_name, workspace_id, created_at").eq("user_id", user.id).single(),
    admin.from("google_calendar_connections").select("email, updated_at").eq("user_id", user.id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from("plaid_items").select("id, institution_name, last_synced_at, created_at").eq("user_id", user.id).order("created_at"),
  ])

  return (
    <SettingsContent
      userId={user.id}
      userEmail={user.email ?? ""}
      profile={profile}
      asanaConnection={asanaConn ?? null}
      googleConnection={googleConn ?? null}
      plaidItems={plaidItems ?? []}
    />
  )
}
