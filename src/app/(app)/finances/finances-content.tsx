"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Tables } from "@/types/database"
import { TransactionsTab } from "./transactions-tab"
import { AccountsTab } from "./accounts-tab"
import { BudgetsTab } from "./budgets-tab"
import { DebtsTab } from "./debts-tab"
import { ExpensesTab } from "./expenses-tab"
import { IncomeTab } from "./income-tab"
import { InsuranceTab } from "./insurance-tab"
import { TaxesTab } from "./taxes-tab"
import { InvestmentsTab } from "./investments-tab"
import { CreditsTab } from "./credits-tab"

type Transaction = Tables<"transactions">
type BankAccount = Tables<"bank_accounts">
type Budget = Tables<"budgets">
type Debt = Tables<"debts">
type RecurringExpense = Tables<"recurring_expenses">
type IncomeSource = Tables<"income_sources">
type InsurancePolicy = Tables<"insurance_policies">
type AccountSection = Tables<"account_sections">
type BudgetSection = Tables<"budget_sections">
type DebtSection = Tables<"debt_sections">
type ExpenseSection = Tables<"expense_sections">
type TaxItem = Tables<"tax_items"> & { form_source?: string | null; category?: string | null }
type TaxSection = Tables<"tax_sections">
type Investment = Tables<"investments">
type InvestmentSection = Tables<"investment_sections">
type BusinessEngagement = Tables<"business_engagements">

type CreditAccount = {
  id: string
  user_id: string
  name: string
  type: string
  balance: number
  credit_limit: number | null
  opened_date: string | null
  status: string
  lender: string | null
  notes: string | null
  created_at: string
}

type CreditProfile = {
  id: string
  user_id: string
  score: number | null
  score_source: string | null
  payment_history_pct: number | null
  payment_history_rating: string | null
  credit_card_use_pct: number | null
  credit_card_use_rating: string | null
  derogatory_marks: number | null
  derogatory_marks_rating: string | null
  credit_age_years: number | null
  credit_age_months: number | null
  credit_age_rating: string | null
  total_accounts: number | null
  total_accounts_rating: string | null
  hard_inquiries: number | null
  hard_inquiries_rating: string | null
  last_updated: string | null
  created_at: string
}

interface FinancesContentProps {
  userId: string
  initialTransactions: Transaction[]
  initialAccounts: BankAccount[]
  initialSections: AccountSection[]
  initialBudgets: Budget[]
  initialBudgetSections: BudgetSection[]
  initialDebts: Debt[]
  initialDebtSections: DebtSection[]
  initialExpenses: RecurringExpense[]
  initialExpenseSections: ExpenseSection[]
  initialIncomeSources: IncomeSource[]
  initialInsurancePolicies: InsurancePolicy[]
  initialTaxItems: TaxItem[]
  initialTaxSections: TaxSection[]
  initialInvestments: Investment[]
  initialInvestmentSections: InvestmentSection[]
  initialEngagements: BusinessEngagement[]
  initialCreditAccounts: CreditAccount[]
  initialCreditProfile: CreditProfile | null
}

export function FinancesContent({
  userId,
  initialTransactions,
  initialAccounts,
  initialSections,
  initialBudgets,
  initialBudgetSections,
  initialDebts,
  initialDebtSections,
  initialExpenses,
  initialExpenseSections,
  initialIncomeSources,
  initialInsurancePolicies,
  initialTaxItems,
  initialTaxSections,
  initialInvestments,
  initialInvestmentSections,
  initialEngagements,
  initialCreditAccounts,
  initialCreditProfile,
}: FinancesContentProps) {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Finances</h1>

      <Tabs defaultValue="transactions">
        <TabsList className="!h-auto py-1 gap-1 flex-wrap">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="debts">Debts</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="credits">Credit</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab
            userId={userId}
            initialTransactions={initialTransactions}
            accounts={initialAccounts}
          />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <AccountsTab userId={userId} initialAccounts={initialAccounts} initialSections={initialSections} />
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <BudgetsTab
            userId={userId}
            initialBudgets={initialBudgets}
            initialSections={initialBudgetSections}
            transactions={initialTransactions}
          />
        </TabsContent>

        <TabsContent value="debts" className="mt-4">
          <DebtsTab
            userId={userId}
            initialDebts={initialDebts}
            initialSections={initialDebtSections}
          />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab
            userId={userId}
            initialExpenses={initialExpenses}
            initialSections={initialExpenseSections}
            accounts={initialAccounts}
          />
        </TabsContent>

        <TabsContent value="income" className="mt-4">
          <IncomeTab userId={userId} initialIncomeSources={initialIncomeSources} initialEngagements={initialEngagements} />
        </TabsContent>

        <TabsContent value="insurance" className="mt-4">
          <InsuranceTab userId={userId} initialInsurancePolicies={initialInsurancePolicies} />
        </TabsContent>

        <TabsContent value="taxes" className="mt-4">
          <TaxesTab userId={userId} initialItems={initialTaxItems as any} initialSections={initialTaxSections} />
        </TabsContent>

        <TabsContent value="investments" className="mt-4">
          <InvestmentsTab
            userId={userId}
            initialInvestments={initialInvestments}
            initialSections={initialInvestmentSections}
          />
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <CreditsTab
            userId={userId}
            initialAccounts={initialCreditAccounts}
            initialProfile={initialCreditProfile}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
