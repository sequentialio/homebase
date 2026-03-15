"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Tables } from "@/types/database"
import { TransactionsTab } from "./transactions-tab"
import { AccountsTab } from "./accounts-tab"
import { BudgetsTab } from "./budgets-tab"
import { DebtsTab } from "./debts-tab"
import { IncomeTab } from "./income-tab"
import { InsuranceTab } from "./insurance-tab"

type Transaction = Tables<"transactions">
type BankAccount = Tables<"bank_accounts">
type Budget = Tables<"budgets">
type Debt = Tables<"debts">
type IncomeSource = Tables<"income_sources">
type InsurancePolicy = Tables<"insurance_policies">

interface FinancesContentProps {
  userId: string
  initialTransactions: Transaction[]
  initialAccounts: BankAccount[]
  initialBudgets: Budget[]
  initialDebts: Debt[]
  initialIncomeSources: IncomeSource[]
  initialInsurancePolicies: InsurancePolicy[]
}

export function FinancesContent({
  userId,
  initialTransactions,
  initialAccounts,
  initialBudgets,
  initialDebts,
  initialIncomeSources,
  initialInsurancePolicies,
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
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab
            userId={userId}
            initialTransactions={initialTransactions}
            accounts={initialAccounts}
          />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <AccountsTab userId={userId} initialAccounts={initialAccounts} />
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <BudgetsTab
            initialBudgets={initialBudgets}
            transactions={initialTransactions}
          />
        </TabsContent>

        <TabsContent value="debts" className="mt-4">
          <DebtsTab initialDebts={initialDebts} />
        </TabsContent>

        <TabsContent value="income" className="mt-4">
          <IncomeTab userId={userId} initialIncomeSources={initialIncomeSources} />
        </TabsContent>

        <TabsContent value="insurance" className="mt-4">
          <InsuranceTab initialInsurancePolicies={initialInsurancePolicies} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
