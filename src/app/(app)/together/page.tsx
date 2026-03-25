import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TogetherContent } from "./together-content"

export default async function TogetherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: messages },
    { data: lists },
    { data: profiles },
  ] = await Promise.all([
    (supabase as any)
      .from("household_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(100),
    (supabase as any)
      .from("shared_lists")
      .select("*, shared_list_items(*)")
      .order("position", { ascending: true }),
    supabase.from("profiles").select("id, full_name, avatar_url"),
  ])

  return (
    <TogetherContent
      userId={user.id}
      initialMessages={messages ?? []}
      initialLists={lists ?? []}
      profiles={profiles ?? []}
    />
  )
}
