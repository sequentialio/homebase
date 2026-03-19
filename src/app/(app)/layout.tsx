import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { SessionTimeout } from "@/components/session-timeout"
import { AssistantProvider } from "@/lib/assistant/assistant-provider"
import type { Tables } from "@/types/database"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Tables<"profiles"> | null = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
    profile = data
  }

  return (
    <AssistantProvider
      userId={user?.id ?? ""}
      userName={profile?.full_name?.split(" ")[0]}
      userAvatarUrl={profile?.avatar_url}
    >
      <AppShell initialProfile={profile}>
        {children}
        <Toaster />
        <SessionTimeout />
      </AppShell>
    </AssistantProvider>
  )
}
