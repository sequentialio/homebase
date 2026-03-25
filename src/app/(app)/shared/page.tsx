import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SharedContent } from "./shared-content"

export default async function SharedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: accounts },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("is_shared", true),
    supabase.from("profiles").select("id, full_name"),
  ])

  const { data: responsibilities } = await (supabase as any)
    .from("shared_responsibilities")
    .select("*")

  // Get transactions for shared accounts
  const sharedAccountIds = (accounts ?? []).map((a: any) => a.id)
  const { data: transactions } = sharedAccountIds.length > 0
    ? await supabase
        .from("transactions")
        .select("*")
        .in("account_id", sharedAccountIds)
        .order("date", { ascending: false })
    : { data: [] }

  // Get all accounts for the "mark as shared" toggle
  const { data: allAccounts } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("name")

  return (
    <SharedContent
      userId={user.id}
      initialAccounts={accounts ?? []}
      initialTransactions={transactions ?? []}
      initialResponsibilities={responsibilities ?? []}
      profiles={profiles ?? []}
      allAccounts={allAccounts ?? []}
    />
  )
}
