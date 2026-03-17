import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AssistantContent } from "./assistant-content"

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, title, messages, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)

  return (
    <AssistantContent
      userId={user.id}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialSessions={(sessions ?? []) as any}
    />
  )
}
