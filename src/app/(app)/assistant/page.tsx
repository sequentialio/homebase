import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AssistantPageContent } from "./assistant-page-content"

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [profileRes, knowledgeRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
    (supabase as any)
      .from("knowledge_docs")
      .select("*")
      .eq("user_id", user.id)
      .order("title"),
  ])

  const firstName = profileRes.data?.full_name?.trim().split(/\s+/)[0] ?? "there"

  return (
    <AssistantPageContent
      userName={firstName}
      userId={user.id}
      initialDocs={knowledgeRes.data ?? []}
    />
  )
}
