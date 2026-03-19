import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type Anthropic from "@anthropic-ai/sdk"

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_finances",
    description:
      "Get detailed financial data: recent transactions, account balances, budget status, debts, income sources.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days of transaction history to fetch (default 30, max 90)",
        },
      },
    },
  },
  {
    name: "get_pantry_and_grocery",
    description:
      "Get the current pantry inventory and shopping list. Returns items in pantry, low-stock alerts, and items on the shopping list.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_cleaning_duties",
    description:
      "Get household cleaning duty schedule: all duties with their frequency, last completion date, and next due date.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_calendar_events",
    description:
      "Get calendar events for a date range. Returns Mita events and synced Asana tasks.",
    input_schema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format (default: today)",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format (default: 30 days from today)",
        },
      },
    },
  },
  {
    name: "log_transaction",
    description:
      "Log a new financial transaction. Use this when the user wants to record income or an expense.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["income", "expense"],
          description: "Transaction type",
        },
        amount: {
          type: "number",
          description: "Transaction amount (positive number)",
        },
        description: {
          type: "string",
          description: "Brief description of the transaction",
        },
        category: {
          type: "string",
          description:
            "Category (e.g. Groceries, Dining, Transport, Utilities, Entertainment, Healthcare, Salary, Freelance)",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format (default: today)",
        },
        scope: {
          type: "string",
          enum: ["personal", "business"],
          description: "Whether this is a personal or business transaction (default: personal)",
        },
        account_id: {
          type: "string",
          description: "UUID of the bank account to associate. Look up the account_id from the '## Bank Accounts' section in your context. Always set this when the user mentions a specific account.",
        },
      },
      required: ["type", "amount", "description"],
    },
  },
  {
    name: "bulk_log_transactions",
    description:
      "Log multiple transactions at once from a list. Use for small batches (under 20 transactions) entered manually.",
    input_schema: {
      type: "object",
      properties: {
        transactions: {
          type: "array",
          description: "Array of transactions to log",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["income", "expense"], description: "Transaction type" },
              amount: { type: "number", description: "Positive amount in dollars" },
              description: { type: "string", description: "Merchant or description" },
              category: { type: "string", description: "Category (e.g. Groceries, Dining, Gas, Transfer, Entertainment)" },
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              scope: { type: "string", enum: ["personal", "business"], description: "personal or business (default: personal)" },
              account_id: { type: "string", description: "UUID of the bank account. Look up from '## Bank Accounts' in context. Always set when user mentions a specific account." },
            },
            required: ["type", "amount", "description"],
          },
        },
      },
      required: ["transactions"],
    },
  },
  {
    name: "import_csv_transactions",
    description:
      "Import transactions directly from a CSV file attached by the user. This parses the CSV server-side — you do NOT need to extract or list the transactions yourself. Just call this tool with the filter parameters. The CSV must have columns: Date, Description, Category, Amount. Negative amounts = expense, positive = income. Use this for ANY CSV upload instead of bulk_log_transactions.",
    input_schema: {
      type: "object",
      properties: {
        exclude_categories: {
          type: "array",
          items: { type: "string" },
          description: "Categories to exclude (e.g. ['Transfer'])",
        },
        start_date: {
          type: "string",
          description: "Only import transactions on or after this date (YYYY-MM-DD). Omit for all dates.",
        },
        end_date: {
          type: "string",
          description: "Only import transactions on or before this date (YYYY-MM-DD). Omit for all dates.",
        },
        scope: {
          type: "string",
          enum: ["personal", "business"],
          description: "Tag all imported transactions as personal or business (default: personal)",
        },
        account_id: {
          type: "string",
          description: "UUID of the bank account to associate with all imported transactions. Look up from '## Bank Accounts' in context.",
        },
      },
    },
  },
  {
    name: "add_to_shopping_list",
    description:
      "Add one or more items to the household shopping list.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "number", description: "Default 1" },
              unit: { type: "string", description: "e.g. kg, L, pcs" },
              category: { type: "string" },
            },
            required: ["name"],
          },
          description: "List of items to add",
        },
      },
      required: ["items"],
    },
  },
  {
    name: "upsert_investment",
    description:
      "Add a new investment account or update an existing one. Use this when the user shares investment details (e.g. from a screenshot or statement). If updating, provide the id of the existing record.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Existing investment ID to update (omit to create new)",
        },
        name: { type: "string", description: "Account name (e.g. 'Principal 403(b)')" },
        institution: { type: "string", description: "Financial institution (e.g. 'Principal')" },
        account_type: {
          type: "string",
          enum: ["401k", "403b", "IRA", "Roth IRA", "Roth 401k", "Brokerage", "HSA", "Crypto", "Pension", "Other"],
          description: "Type of investment account",
        },
        balance: { type: "number", description: "Current balance in dollars" },
        cost_basis: { type: "number", description: "Total amount contributed / cost basis" },
        gain_loss: { type: "number", description: "Total or YTD gain/loss in dollars" },
        rate_of_return: { type: "number", description: "Rate of return as a percentage (e.g. 1.11 for 1.11%)" },
        as_of_date: { type: "string", description: "Date the balance was recorded (YYYY-MM-DD)" },
        account_number: { type: "string", description: "Last 4 digits or masked account number (optional)" },
        notes: { type: "string", description: "Any additional notes" },
      },
      required: ["name", "account_type", "balance"],
    },
  },
  {
    name: "upsert_debt",
    description:
      "Add a new debt or update an existing one (balance, interest rate, min payment, payoff date). Use when the user shares a loan or credit card statement. If updating, provide the id from get_finances.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing debt ID to update (omit to create new)" },
        name: { type: "string", description: "Debt name (e.g. 'SCFCU Personal Loan')" },
        balance: { type: "number", description: "Current outstanding balance" },
        interest_rate: { type: "number", description: "Annual interest rate as a percentage (e.g. 6.5)" },
        min_payment: { type: "number", description: "Minimum monthly payment" },
        payoff_date: { type: "string", description: "Estimated payoff date (YYYY-MM-DD)" },
        notes: { type: "string", description: "Any additional notes" },
      },
      required: ["name", "balance"],
    },
  },
  {
    name: "upsert_account",
    description:
      "Add a new bank account or update an existing one's balance. Use when the user shares account info or a bank statement. If updating, provide the id from get_finances.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing account ID to update (omit to create new)" },
        name: { type: "string", description: "Account name (e.g. 'SCFCU Checking')" },
        balance: { type: "number", description: "Current balance in dollars" },
        currency: { type: "string", description: "Currency code (default: USD)" },
      },
      required: ["name", "balance"],
    },
  },
  {
    name: "upsert_income_source",
    description:
      "Add a new income source or update an existing one. Use when the user mentions salary, freelance income, or any recurring income. If updating, provide the id from get_finances.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing income source ID to update (omit to create new)" },
        name: { type: "string", description: "Source name (e.g. 'Salary', 'Freelance')" },
        amount: { type: "number", description: "Amount per pay period" },
        frequency: {
          type: "string",
          enum: ["weekly", "biweekly", "monthly", "annually", "one-time"],
          description: "How often this income is received",
        },
        next_date: { type: "string", description: "Next expected payment date (YYYY-MM-DD)" },
        active: { type: "boolean", description: "Whether this income source is still active (default true)" },
      },
      required: ["name", "amount", "frequency"],
    },
  },
  {
    name: "upsert_budget",
    description:
      "Add or update a monthly budget for a category. If updating, provide the id from get_finances.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing budget ID to update (omit to create new)" },
        category: { type: "string", description: "Budget category (e.g. Groceries, Dining, Transport)" },
        monthly_limit: { type: "number", description: "Monthly spending limit in dollars" },
        month: { type: "number", description: "Month number 1-12 (default: current month)" },
        year: { type: "number", description: "Year (default: current year)" },
      },
      required: ["category", "monthly_limit"],
    },
  },
  {
    name: "upsert_recurring_expense",
    description:
      "Add a new recurring expense or update an existing one. Use when the user mentions a subscription, bill, or any regular recurring cost. If updating, provide the id from get_finances.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing recurring expense ID to update (omit to create new)" },
        name: { type: "string", description: "Expense name (e.g. 'Netflix', 'Rent', 'Spectrum')" },
        amount: { type: "number", description: "Amount per billing cycle in dollars" },
        category: { type: "string", description: "Category (e.g. Subscriptions, Utilities, Housing, Insurance)" },
        frequency: {
          type: "string",
          enum: ["weekly", "biweekly", "monthly", "quarterly", "annually"],
          description: "How often this expense recurs",
        },
        billing_day: { type: "number", description: "Day of month bill is due (1-31, optional)" },
        auto_pay: { type: "boolean", description: "Whether this is on autopay (default false)" },
        account_id: { type: "string", description: "Bank account ID to associate with this expense (use account_id from get_finances)" },
        notes: { type: "string", description: "Any additional notes" },
        active: { type: "boolean", description: "Whether this expense is currently active (default true)" },
      },
      required: ["name", "amount", "frequency"],
    },
  },
  {
    name: "save_note",
    description:
      "Save a note to persistent memory that will be available in all future conversations. Use this proactively to remember user preferences, patterns, goals, or anything useful. If a note with the same key exists, it will be updated.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Short descriptive key for this note (e.g. 'gas_pattern', 'grocery_preference', 'financial_goal')",
        },
        content: {
          type: "string",
          description: "The note content to remember",
        },
      },
      required: ["key", "content"],
    },
  },
  {
    name: "delete_note",
    description:
      "Delete a saved note by key. Use when information is no longer relevant.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key of the note to delete" },
      },
      required: ["key"],
    },
  },
  {
    name: "add_calendar_event",
    description:
      "Add a new event to the Mita calendar.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title" },
        start_at: {
          type: "string",
          description: "Start datetime in ISO 8601 format (e.g. 2026-03-20T14:00:00)",
        },
        end_at: {
          type: "string",
          description: "End datetime in ISO 8601 format (optional)",
        },
        description: { type: "string", description: "Optional notes" },
        all_day: { type: "boolean", description: "Whether it is an all-day event" },
      },
      required: ["title", "start_at"],
    },
  },
]

// ── Validation helpers ────────────────────────────────────────────────────────

const MAX_AMOUNT = 10_000_000
const MAX_BULK_TRANSACTIONS = 500
const MAX_SHOPPING_ITEMS = 50
const MAX_STRING_LENGTH = 500

function validateAmount(amount: unknown): string | null {
  const n = Number(amount)
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return `Invalid amount (must be 0–${MAX_AMOUNT})`
  return null
}

function validateString(value: unknown, label: string, maxLen = MAX_STRING_LENGTH): string | null {
  if (typeof value !== "string" || value.length === 0) return `${label} is required`
  if (value.length > maxLen) return `${label} too long (max ${maxLen} chars)`
  return null
}

// ── Tool executor ─────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient<Database>,
  userId: string,
  csvContent?: string
): Promise<string> {
  try {
    switch (name) {
      case "get_finances":
        return await getFinances(supabase, input)

      case "get_pantry_and_grocery":
        return await getPantryAndGrocery(supabase)

      case "get_cleaning_duties":
        return await getCleaningDuties(supabase)

      case "get_calendar_events":
        return await getCalendarEvents(supabase, input)

      case "log_transaction":
        return await logTransaction(supabase, userId, input)

      case "bulk_log_transactions":
        return await bulkLogTransactions(supabase, userId, input)

      case "add_to_shopping_list":
        return await addToShoppingList(supabase, input)

      case "upsert_investment":
        return await upsertInvestment(supabase, userId, input)

      case "upsert_debt":
        return await upsertDebt(supabase, userId, input)

      case "upsert_account":
        return await upsertAccount(supabase, userId, input)

      case "upsert_income_source":
        return await upsertIncomeSource(supabase, userId, input)

      case "upsert_budget":
        return await upsertBudget(supabase, userId, input)

      case "upsert_recurring_expense":
        return await upsertRecurringExpense(supabase, userId, input)

      case "import_csv_transactions":
        return await importCsvTransactions(supabase, userId, input, csvContent)

      case "save_note":
        return await saveNote(supabase, userId, input)

      case "delete_note":
        return await deleteNote(supabase, userId, input)

      case "add_calendar_event":
        return await addCalendarEvent(supabase, userId, input)

      default:
        return `Unknown tool: ${name}`
    }
  } catch (err) {
    return `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ── Individual tool implementations ──────────────────────────────────────────

async function getFinances(
  supabase: SupabaseClient<Database>,
  input: Record<string, unknown>
): Promise<string> {
  const days = Math.min(Number(input.days ?? 30), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]

  const [accountsRes, txRes, budgetsRes, debtsRes, incomeRes, investmentsRes, recurringRes] =
    await Promise.all([
      supabase.from("bank_accounts").select("*"),
      supabase
        .from("transactions")
        .select("*")
        .gte("date", since)
        .order("date", { ascending: false }),
      supabase.from("budgets").select("*"),
      supabase.from("debts").select("*"),
      supabase.from("income_sources").select("*").eq("active", true),
      supabase.from("investments").select("*").order("name"),
      supabase.from("recurring_expenses").select("*").eq("active", true).order("position"),
    ])

  return JSON.stringify({
    accounts: accountsRes.data ?? [],
    transactions: txRes.data ?? [],
    budgets: budgetsRes.data ?? [],
    debts: debtsRes.data ?? [],
    income_sources: incomeRes.data ?? [],
    investments: investmentsRes.data ?? [],
    recurring_expenses: recurringRes.data ?? [],
    period_days: days,
  })
}

async function getPantryAndGrocery(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const { data } = await supabase
    .from("grocery_items")
    .select("*")
    .order("name")

  const pantry = (data ?? []).filter((g) => g.in_pantry)
  const shopping = (data ?? []).filter((g) => !g.in_pantry)
  const lowStock = pantry.filter(
    (g) => g.low_threshold !== null && g.quantity <= (g.low_threshold ?? 0)
  )

  return JSON.stringify({ pantry, shopping_list: shopping, low_stock_alerts: lowStock })
}

async function getCleaningDuties(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const { data } = await supabase
    .from("cleaning_duties")
    .select("*")
    .order("next_due", { ascending: true })

  const today = new Date().toISOString().split("T")[0]
  const duties = (data ?? []).map((d) => ({
    ...d,
    status:
      !d.next_due
        ? "no_schedule"
        : d.next_due < today
        ? "overdue"
        : "upcoming",
  }))

  return JSON.stringify({ duties })
}

async function getCalendarEvents(
  supabase: SupabaseClient<Database>,
  input: Record<string, unknown>
): Promise<string> {
  const start =
    (input.start_date as string) ?? new Date().toISOString().split("T")[0]
  const end =
    (input.end_date as string) ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("start_at", start)
    .lte("start_at", end)
    .order("start_at", { ascending: true })

  return JSON.stringify({ events: data ?? [], range: { start, end } })
}

async function logTransaction(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const amtErr = validateAmount(input.amount)
  if (amtErr) return amtErr
  const descErr = validateString(input.description, "Description")
  if (descErr) return descErr
  if (input.type !== "income" && input.type !== "expense") return `Invalid type — must be "income" or "expense".`

  const scope = (input.scope as string) ?? "personal"
  if (scope !== "personal" && scope !== "business") return `Invalid scope — must be "personal" or "business".`

  const { error, data } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: input.type as string,
      amount: Number(input.amount),
      description: input.description as string,
      category: (input.category as string) ?? null,
      date: (input.date as string) ?? new Date().toISOString().split("T")[0],
      scope,
      account_id: (input.account_id as string) ?? null,
    } as never)
    .select()
    .single()

  if (error) return `Failed to log transaction: ${error.message}`
  const acctNote = input.account_id ? ` [account: ${input.account_id}]` : ""
  return `Transaction logged successfully: ${data.type} $${data.amount} — ${data.description} (${data.date}) [${scope}]${acctNote}`
}

async function bulkLogTransactions(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  type TxInput = { type: string; amount: number; description: string; category?: string; date?: string; scope?: string; account_id?: string }
  const txs = input.transactions as TxInput[]
  if (!txs?.length) return "No transactions provided."
  if (txs.length > MAX_BULK_TRANSACTIONS) return `Too many transactions (max ${MAX_BULK_TRANSACTIONS}).`

  for (const t of txs) {
    const amtErr = validateAmount(t.amount)
    if (amtErr) return `Transaction "${t.description}": ${amtErr}`
    const descErr = validateString(t.description, "Description")
    if (descErr) return descErr
    if (t.type !== "income" && t.type !== "expense") return `Invalid type "${t.type}" — must be "income" or "expense".`
  }

  const today = new Date().toISOString().split("T")[0]
  const rows = txs.map((t) => ({
    user_id: userId,
    type: t.type,
    amount: Number(t.amount),
    description: t.description,
    category: t.category ?? null,
    date: t.date ?? today,
    scope: t.scope ?? "personal",
    account_id: t.account_id ?? null,
  }))

  const { error, data } = await supabase.from("transactions").insert(rows as never).select()
  if (error) return `Failed to log transactions: ${error.message}`
  return `Logged ${data.length} transaction${data.length !== 1 ? "s" : ""} successfully.`
}

async function addToShoppingList(
  supabase: SupabaseClient<Database>,
  input: Record<string, unknown>
): Promise<string> {
  type ItemInput = { name: string; quantity?: number; unit?: string; category?: string }
  const items = input.items as ItemInput[]
  if (!items?.length) return "No items provided."
  if (items.length > MAX_SHOPPING_ITEMS) return `Too many items (max ${MAX_SHOPPING_ITEMS}).`
  for (const item of items) {
    const nameErr = validateString(item.name, "Item name", 200)
    if (nameErr) return nameErr
  }

  const rows = items.map((item) => ({
    name: item.name,
    quantity: item.quantity ?? 1,
    unit: item.unit ?? null,
    category: item.category ?? null,
    in_pantry: false,
  }))

  const { error, data } = await supabase
    .from("grocery_items")
    .insert(rows)
    .select()

  if (error) return `Failed to add items: ${error.message}`
  return `Added ${data.length} item(s) to shopping list: ${data.map((d) => d.name).join(", ")}`
}

async function upsertInvestment(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const id = input.id as string | undefined

  const payload = {
    user_id: userId,
    name: input.name as string,
    institution: (input.institution as string) ?? null,
    account_type: input.account_type as string,
    balance: Number(input.balance),
    cost_basis: input.cost_basis != null ? Number(input.cost_basis) : null,
    gain_loss: input.gain_loss != null ? Number(input.gain_loss) : null,
    rate_of_return: input.rate_of_return != null ? Number(input.rate_of_return) : null,
    as_of_date: (input.as_of_date as string) ?? null,
    account_number: (input.account_number as string) ?? null,
    notes: (input.notes as string) ?? null,
  }

  if (id) {
    const { error, data } = await supabase
      .from("investments")
      .update(payload)
      .eq("id", id)
      .select()
      .single()
    if (error) return `Failed to update investment: ${error.message}`
    return `Investment updated: "${data.name}" — balance $${data.balance}${data.as_of_date ? ` as of ${data.as_of_date}` : ""}`
  } else {
    const { error, data } = await supabase
      .from("investments")
      .insert(payload)
      .select()
      .single()
    if (error) return `Failed to add investment: ${error.message}`
    return `Investment added: "${data.name}" (${data.account_type}) — balance $${data.balance}${data.as_of_date ? ` as of ${data.as_of_date}` : ""}`
  }
}

async function upsertDebt(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const id = input.id as string | undefined
  const payload = {
    user_id: userId,
    name: input.name as string,
    balance: Number(input.balance),
    interest_rate: input.interest_rate != null ? Number(input.interest_rate) : null,
    min_payment: input.min_payment != null ? Number(input.min_payment) : null,
    payoff_date: (input.payoff_date as string) ?? null,
    notes: (input.notes as string) ?? null,
  }
  if (id) {
    const { error, data } = await supabase.from("debts").update(payload).eq("id", id).select().single()
    if (error) return `Failed to update debt: ${error.message}`
    return `Debt updated: "${data.name}" — balance $${data.balance}${data.min_payment ? `, min payment $${data.min_payment}` : ""}`
  } else {
    const { error, data } = await supabase.from("debts").insert(payload).select().single()
    if (error) return `Failed to add debt: ${error.message}`
    return `Debt added: "${data.name}" — balance $${data.balance}`
  }
}

async function upsertAccount(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const id = input.id as string | undefined
  const payload = {
    user_id: userId,
    name: input.name as string,
    balance: Number(input.balance),
    currency: (input.currency as string) ?? "USD",
    last_updated: new Date().toISOString().split("T")[0],
  }
  if (id) {
    const { error, data } = await supabase.from("bank_accounts").update(payload).eq("id", id).select().single()
    if (error) return `Failed to update account: ${error.message}`
    return `Account updated: "${data.name}" — balance $${data.balance}`
  } else {
    const { error, data } = await supabase.from("bank_accounts").insert(payload).select().single()
    if (error) return `Failed to add account: ${error.message}`
    return `Account added: "${data.name}" — balance $${data.balance}`
  }
}

async function upsertIncomeSource(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const id = input.id as string | undefined
  const payload = {
    user_id: userId,
    name: input.name as string,
    amount: Number(input.amount),
    frequency: input.frequency as string,
    next_date: (input.next_date as string) ?? null,
    active: (input.active as boolean) ?? true,
  }
  if (id) {
    const { error, data } = await supabase.from("income_sources").update(payload).eq("id", id).select().single()
    if (error) return `Failed to update income source: ${error.message}`
    return `Income source updated: "${data.name}" — $${data.amount} ${data.frequency}`
  } else {
    const { error, data } = await supabase.from("income_sources").insert(payload).select().single()
    if (error) return `Failed to add income source: ${error.message}`
    return `Income source added: "${data.name}" — $${data.amount} ${data.frequency}`
  }
}

async function upsertBudget(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const id = input.id as string | undefined
  const now = new Date()
  const payload = {
    user_id: userId,
    category: input.category as string,
    monthly_limit: Number(input.monthly_limit),
    month: input.month != null ? Number(input.month) : now.getMonth() + 1,
    year: input.year != null ? Number(input.year) : now.getFullYear(),
  }
  if (id) {
    const { error, data } = await supabase.from("budgets").update(payload).eq("id", id).select().single()
    if (error) return `Failed to update budget: ${error.message}`
    return `Budget updated: ${data.category} — $${data.monthly_limit}/mo`
  } else {
    const { error, data } = await supabase.from("budgets").insert(payload).select().single()
    if (error) return `Failed to add budget: ${error.message}`
    return `Budget added: ${data.category} — $${data.monthly_limit}/mo for ${data.month}/${data.year}`
  }
}

async function upsertRecurringExpense(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const id = input.id as string | undefined
  const payload = {
    user_id: userId,
    name: input.name as string,
    amount: Number(input.amount),
    category: (input.category as string) ?? null,
    frequency: input.frequency as string,
    billing_day: input.billing_day != null ? Number(input.billing_day) : null,
    auto_pay: (input.auto_pay as boolean) ?? false,
    account_id: (input.account_id as string) ?? null,
    notes: (input.notes as string) ?? null,
    active: (input.active as boolean) ?? true,
    position: 0,
  }
  if (id) {
    const { error, data } = await supabase.from("recurring_expenses").update(payload).eq("id", id).select().single()
    if (error) return `Failed to update recurring expense: ${error.message}`
    return `Recurring expense updated: "${(data as Record<string,unknown>).name}" — $${(data as Record<string,unknown>).amount} ${(data as Record<string,unknown>).frequency}`
  } else {
    // Set position to end of list
    const { count } = await supabase.from("recurring_expenses").select("*", { count: "exact", head: true }).eq("user_id", userId)
    const { error, data } = await supabase.from("recurring_expenses").insert({ ...payload, position: count ?? 0 }).select().single()
    if (error) return `Failed to add recurring expense: ${error.message}`
    return `Recurring expense added: "${(data as Record<string,unknown>).name}" — $${(data as Record<string,unknown>).amount} ${(data as Record<string,unknown>).frequency}`
  }
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        fields.push(current.trim())
        current = ""
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

async function importCsvTransactions(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>,
  csvContent?: string
): Promise<string> {
  if (!csvContent) return "No CSV file found in the conversation. Ask the user to attach a CSV file."

  const excludeCategories = new Set(
    ((input.exclude_categories as string[]) ?? []).map((c) => c.toLowerCase())
  )
  const startDate = input.start_date as string | undefined
  const endDate = input.end_date as string | undefined
  const scope = (input.scope as string) ?? "personal"
  const accountId = (input.account_id as string) ?? null

  // Parse CSV
  const lines = csvContent.split("\n").filter((l) => l.trim())
  if (lines.length < 2) return "CSV file is empty or has no data rows."

  const header = parseCsvLine(lines[0].replace(/^\uFEFF/, ""))
  const dateIdx = header.findIndex((h) => /date/i.test(h))
  const descIdx = header.findIndex((h) => /description/i.test(h))
  const catIdx = header.findIndex((h) => /category/i.test(h))
  const amtIdx = header.findIndex((h) => /amount/i.test(h))

  if (dateIdx === -1 || descIdx === -1 || amtIdx === -1) {
    return `CSV missing required columns. Found: [${header.join(", ")}]. Need: Date, Description, Amount.`
  }

  // Parse MM/DD/YYYY → YYYY-MM-DD
  function parseDate(raw: string): string | null {
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (match) return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return iso[0]
    return null
  }

  const rows: { user_id: string; type: string; amount: number; description: string; category: string | null; date: string; scope: string; account_id: string | null }[] = []
  let skippedTransfers = 0
  let skippedDateFilter = 0
  let parseErrors = 0

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i])
    if (fields.length <= amtIdx) { parseErrors++; continue }

    const rawDate = fields[dateIdx]
    const desc = fields[descIdx]
    const category = catIdx >= 0 ? fields[catIdx] : null
    const rawAmount = parseFloat(fields[amtIdx].replace(/[$,]/g, ""))

    if (!rawDate || !desc || !Number.isFinite(rawAmount) || rawAmount === 0) { parseErrors++; continue }

    // Skip excluded categories
    if (category && excludeCategories.has(category.toLowerCase())) {
      skippedTransfers++
      continue
    }

    const date = parseDate(rawDate)
    if (!date) { parseErrors++; continue }

    // Date filter
    if (startDate && date < startDate) { skippedDateFilter++; continue }
    if (endDate && date > endDate) { skippedDateFilter++; continue }

    rows.push({
      user_id: userId,
      type: rawAmount < 0 ? "expense" : "income",
      amount: Math.abs(rawAmount),
      description: desc,
      category: category || null,
      date,
      scope,
      account_id: accountId,
    })
  }

  if (rows.length === 0) {
    return `No transactions to import after filtering. Skipped ${skippedTransfers} transfers, ${skippedDateFilter} outside date range, ${parseErrors} parse errors.`
  }

  if (rows.length > MAX_BULK_TRANSACTIONS) {
    return `Too many transactions (${rows.length}) after filtering. Max is ${MAX_BULK_TRANSACTIONS}. Ask the user to narrow the date range.`
  }

  // Insert in batches of 100
  let totalInserted = 0
  const batchSize = 100
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error, data } = await supabase.from("transactions").insert(batch as never).select()
    if (error) return `Failed at batch ${Math.floor(i / batchSize) + 1}: ${error.message}. ${totalInserted} transactions were already saved.`
    totalInserted += data.length
  }

  // Build summary by category
  const byCat: Record<string, { count: number; total: number }> = {}
  for (const r of rows) {
    const cat = r.category || "Uncategorized"
    if (!byCat[cat]) byCat[cat] = { count: 0, total: 0 }
    byCat[cat].count++
    byCat[cat].total += r.amount
  }
  const catSummary = Object.entries(byCat)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, { count, total }]) => `${cat}: ${count} transactions, $${total.toFixed(2)}`)
    .join("\n")

  const dateRange = rows.length > 0
    ? `${rows[rows.length - 1].date} to ${rows[0].date}`
    : "N/A"

  return `Successfully imported ${totalInserted} transactions (${dateRange}).\n\nSkipped: ${skippedTransfers} transfers, ${skippedDateFilter} outside date range, ${parseErrors} parse errors.\n\nBreakdown by category:\n${catSummary}`
}

async function saveNote(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const keyErr = validateString(input.key, "Key", 100)
  if (keyErr) return keyErr
  const contentErr = validateString(input.content, "Content", 1000)
  if (contentErr) return contentErr

  const { error } = await (supabase as any)
    .from("user_notes")
    .upsert(
      {
        user_id: userId,
        key: input.key as string,
        content: input.content as string,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    )

  if (error) return `Failed to save note: ${error.message}`
  return `Noted: [${input.key}] saved to memory.`
}

async function deleteNote(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const { error } = await (supabase as any)
    .from("user_notes")
    .delete()
    .eq("user_id", userId)
    .eq("key", input.key as string)

  if (error) return `Failed to delete note: ${error.message}`
  return `Note [${input.key}] deleted from memory.`
}

async function addCalendarEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const { error, data } = await supabase
    .from("calendar_events")
    .insert({
      user_id: userId,
      title: input.title as string,
      start_at: input.start_at as string,
      end_at: (input.end_at as string) ?? null,
      description: (input.description as string) ?? null,
      all_day: (input.all_day as boolean) ?? false,
      source: "homebase",
    })
    .select()
    .single()

  if (error) return `Failed to add event: ${error.message}`
  return `Event added: "${data.title}" on ${new Date(data.start_at).toLocaleDateString()}`
}
