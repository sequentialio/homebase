import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { UserManagement } from "@/components/admin/user-management"

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  // Only admin can access
  if (profile?.role !== "admin") redirect("/dashboard")

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>
      <UserManagement currentUserId={user.id} />
    </div>
  )
}
