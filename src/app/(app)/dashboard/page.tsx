import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

/**
 * Dashboard — replace with your app's main view.
 *
 * This server component fetches the current user and passes data to
 * a client content component. See the "Server Component + Client Content
 * Pattern" section in PLAYBOOK.md for the full pattern.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile.full_name || profile.email}
        </p>
      </div>

      {/* Add your dashboard content here */}
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
        Your dashboard content goes here
      </div>
    </div>
  )
}
