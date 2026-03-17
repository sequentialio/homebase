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
    { data: sections },
    { data: budgets },
    { data: budgetSections },
    { data: debts },
    { data: debtSections },
    { data: expenses },
    { data: expenseSections },
    { data: incomeSources },
    { data: insurancePolicies },
    { data: taxItems },
    { data: taxSections },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .limit(200),
    supabase.from("bank_accounts").select("*").order("section_id").order("position"),
    supabase.from("account_sections").select("*").order("position"),
    supabase.from("budgets").select("*").order("section_id").order("position"),
    supabase.from("budget_sections").select("*").eq("user_id", user.id).order("position"),
    supabase.from("debts").select("*").order("section_id").order("position"),
    supabase.from("debt_sections").select("*").eq("user_id", user.id).order("position"),
    supabase.from("recurring_expenses").select("*").eq("user_id", user.id).order("section_id").order("position"),
    supabase.from("expense_sections").select("*").eq("user_id", user.id).order("position"),
    supabase.from("income_sources").select("*").order("name"),
    supabase.from("insurance_policies").select("*").order("name"),
    supabase.from("tax_items").select("*").eq("user_id", user.id).order("section_id").order("position"),
    supabase.from("tax_sections").select("*").eq("user_id", user.id).order("position"),
  ])

  return (
    <FinancesContent
      userId={user.id}
      initialTransactions={transactions ?? []}
      initialAccounts={accounts ?? []}
      initialSections={sections ?? []}
      initialBudgets={budgets ?? []}
      initialBudgetSections={budgetSections ?? []}
      initialDebts={debts ?? []}
      initialDebtSections={debtSections ?? []}
      initialExpenses={expenses ?? []}
      initialExpenseSections={expenseSections ?? []}
      initialIncomeSources={incomeSources ?? []}
      initialInsurancePolicies={insurancePolicies ?? []}
      initialTaxItems={taxItems ?? []}
      initialTaxSections={taxSections ?? []}
    />
  )
}
