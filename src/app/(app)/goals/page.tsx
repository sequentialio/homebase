import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { GoalsContent } from "./goals-content"

export default async function GoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: goals } = await (supabase as any)
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })

  const { data: devRequests } = await (supabase as any)
    .from("dev_requests")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "done")
    .neq("status", "wont_fix")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })

  return <GoalsContent initialGoals={goals ?? []} initialDevRequests={devRequests ?? []} userId={user.id} />
}
