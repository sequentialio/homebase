import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FinancesContent } from "./finances-content"

export default async function FinancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [
    { data: transactions },
    { data: accounts },
    { data: budgets },
    { data: debts },
    { data: incomeSources },
    { data: insurancePolicies },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .limit(200),
    supabase.from("bank_accounts").select("*").order("name"),
    supabase.from("budgets").select("*").order("category"),
    supabase.from("debts").select("*").order("name"),
    supabase.from("income_sources").select("*").order("name"),
    supabase.from("insurance_policies").select("*").order("name"),
  ])

  return (
    <FinancesContent
      userId={user.id}
      initialTransactions={transactions ?? []}
      initialAccounts={accounts ?? []}
      initialBudgets={budgets ?? []}
      initialDebts={debts ?? []}
      initialIncomeSources={incomeSources ?? []}
      initialInsurancePolicies={insurancePolicies ?? []}
    />
  )
}
