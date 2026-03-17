import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { SessionTimeout } from "@/components/session-timeout"
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
    <AppShell initialProfile={profile}>
      {children}
      <Toaster />
      <SessionTimeout />
    </AppShell>
  )
}
