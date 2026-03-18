import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AssistantContent } from "./assistant-content"

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: sessions }, { data: profile }] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("id, title, messages, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
  ])

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "there"

  return (
    <AssistantContent
      userId={user.id}
      userName={firstName}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialSessions={(sessions ?? []) as any}
    />
  )
}
