import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AssistantContent } from "./assistant-content"

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single()

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "there"

  return <AssistantContent userName={firstName} />
}
