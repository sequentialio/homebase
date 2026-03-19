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
type TaxItem = Tables<"tax_items">
type TaxSection = Tables<"tax_sections">
type Investment = Tables<"investments">
type InvestmentSection = Tables<"investment_sections">

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
          <IncomeTab userId={userId} initialIncomeSources={initialIncomeSources} />
        </TabsContent>

        <TabsContent value="insurance" className="mt-4">
          <InsuranceTab userId={userId} initialInsurancePolicies={initialInsurancePolicies} />
        </TabsContent>

        <TabsContent value="taxes" className="mt-4">
          <TaxesTab userId={userId} initialItems={initialTaxItems} initialSections={initialTaxSections} />
        </TabsContent>

        <TabsContent value="investments" className="mt-4">
          <InvestmentsTab
            userId={userId}
            initialInvestments={initialInvestments}
            initialSections={initialInvestmentSections}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
