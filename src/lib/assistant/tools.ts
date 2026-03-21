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
      "Add a new income source or update an existing one. Use when the user mentions salary, freelance income, or any recurring income. If updating, provide the id from get_finances. Amount is the NET (take-home) per pay period.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing income source ID to update (omit to create new)" },
        name: { type: "string", description: "Source name (e.g. 'NSC Salary — Net Pay', 'Freelance')" },
        amount: { type: "number", description: "NET amount per pay period (take-home after deductions)" },
        gross_amount: { type: "number", description: "GROSS amount per pay period (before deductions, optional)" },
        deductions: { type: "number", description: "Deductions per pay period (taxes + benefits, optional — auto-calculated from gross - net if omitted)" },
        bonus_amount: { type: "number", description: "Bonus amount (optional)" },
        bonus_frequency: { type: "string", enum: ["annually", "quarterly", "monthly"], description: "Bonus frequency (default annually)" },
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
        section_id: { type: "string", description: "Section ID to place the expense in. Use get_finances to see available expense_sections. Personal expenses go in the 'Personal' section, business expenses in 'Business'." },
      },
      required: ["name", "amount", "frequency"],
    },
  },
  {
    name: "upsert_business_engagement",
    description:
      "Add or update a business client engagement for Sequential Analytics. Use when the user mentions consulting clients, projects, or business income.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing engagement ID to update (omit to create new)" },
        client: { type: "string", description: "Client/company name" },
        description: { type: "string", description: "Brief description of the engagement" },
        date: { type: "string", description: "Engagement date (YYYY-MM-DD)" },
        amount: { type: "number", description: "Total billed amount in dollars" },
        tax_rate: { type: "number", description: "Tax rate as decimal (default 0.30 = 30%). User may say percentage — convert to decimal." },
        status: { type: "string", enum: ["active", "completed", "paid"], description: "Engagement status" },
      },
      required: ["client", "amount", "date"],
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
    name: "upsert_insurance_policy",
    description:
      "Add a new insurance policy or update an existing one. Use when the user shares insurance details (premium, provider, renewal date). If updating, provide the id from the context snapshot.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing policy ID to update (omit to create new)" },
        name: { type: "string", description: "Policy name (e.g. 'Healthy Paws Pet Insurance')" },
        type: { type: "string", description: "Policy type: auto, health, dental, vision, renters, life, pet, umbrella, other" },
        provider: { type: "string", description: "Insurance company name" },
        policy_number: { type: "string", description: "Policy number (optional)" },
        premium: { type: "number", description: "Premium amount per billing period" },
        premium_frequency: { type: "string", enum: ["monthly", "quarterly", "annually"], description: "How often premium is billed" },
        deductible: { type: "number", description: "Annual deductible amount (optional)" },
        coverage_amount: { type: "number", description: "Total coverage amount (optional)" },
        renewal_date: { type: "string", description: "Next renewal date YYYY-MM-DD (optional)" },
        notes: { type: "string", description: "Additional notes (optional)" },
        active: { type: "boolean", description: "Whether policy is active (default true)" },
      },
      required: ["name", "type", "provider", "premium"],
    },
  },
  {
    name: "upsert_tax_item",
    description:
      "Add a new tax item or update an existing one. Use for income, deductions, credits, payments, or other tax-related items. If updating, provide the id from get_finances. Always set form_source (W-2, 1098-E, 1099-NEC, etc.) and category (wages, federal, state, fica, retirement, student_loan, health, standard, business, other) for proper organization in the Taxes tab.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing tax item ID to update (omit to create new)" },
        name: { type: "string", description: "Item name (e.g. 'W-2 Wages', 'Federal Income Tax Withheld')" },
        amount: { type: "number", description: "Dollar amount" },
        type: { type: "string", enum: ["income", "deduction", "credit", "payment", "other"], description: "Tax item type" },
        tax_year: { type: "number", description: "Tax year (e.g. 2025, 2026)" },
        form_source: { type: "string", description: "Source form: W-2, 1098-E, 1095-C, 1099-NEC, 1099-INT, 1099-DIV, Estimate, Standard, Manual" },
        category: { type: "string", description: "Category for grouping: wages, federal, state, fica, retirement, student_loan, health, standard, business, other" },
        filed: { type: "boolean", description: "Whether this has been filed/claimed (default false)" },
        due_date: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
        notes: { type: "string", description: "Additional notes (optional)" },
      },
      required: ["name", "amount", "type", "tax_year"],
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
  {
    name: "upsert_credit_account",
    description:
      "Add a new credit account (credit card or loan) or update an existing one. Use when the user shares credit report details. If updating, provide the id from get_finances.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing credit account ID to update (omit to create new)" },
        name: { type: "string", description: "Account name (e.g. 'CA COAST CU', 'MOHELA/DOFED')" },
        type: { type: "string", enum: ["credit_card", "student_loan", "personal_loan", "auto_loan", "mortgage", "other"], description: "Account type" },
        balance: { type: "number", description: "Current balance" },
        credit_limit: { type: "number", description: "Credit limit (for credit cards only)" },
        opened_date: { type: "string", description: "Date account was opened YYYY-MM-DD" },
        status: { type: "string", enum: ["open", "closed"], description: "Account status" },
        lender: { type: "string", description: "Lender/institution name (optional)" },
      },
      required: ["name", "type", "balance"],
    },
  },
  {
    name: "update_credit_profile",
    description:
      "Update the user's credit score and all score factors. Use when the user shares their Credit Karma or credit report data. Creates the profile if it doesn't exist.",
    input_schema: {
      type: "object",
      properties: {
        score: { type: "number", description: "Credit score (300-850)" },
        score_source: { type: "string", enum: ["TransUnion", "Equifax", "Experian"], description: "Score source" },
        payment_history_pct: { type: "number", description: "Payment history percentage (0-100)" },
        payment_history_rating: { type: "string", enum: ["Excellent", "Good", "Fair", "Needs work", "Poor"] },
        credit_card_use_pct: { type: "number", description: "Credit card utilization percentage" },
        credit_card_use_rating: { type: "string", enum: ["Excellent", "Good", "Fair", "Needs work", "Poor"] },
        derogatory_marks: { type: "number", description: "Number of derogatory marks" },
        derogatory_marks_rating: { type: "string", enum: ["Excellent", "Good", "Fair", "Needs work", "Poor"] },
        credit_age_years: { type: "number", description: "Credit age in years" },
        credit_age_months: { type: "number", description: "Additional months" },
        credit_age_rating: { type: "string", enum: ["Excellent", "Good", "Fair", "Needs work", "Poor"] },
        total_accounts: { type: "number", description: "Total number of accounts" },
        total_accounts_rating: { type: "string", enum: ["Excellent", "Good", "Fair", "Needs work", "Poor"] },
        hard_inquiries: { type: "number", description: "Number of hard inquiries" },
        hard_inquiries_rating: { type: "string", enum: ["Excellent", "Good", "Fair", "Needs work", "Poor"] },
      },
      required: ["score"],
    },
  },
  {
    name: "search_knowledge_base",
    description:
      "Search the user's knowledge base documents by keyword. Returns matching doc titles, categories, and content snippets. Use this to find relevant reference material (insurance policies, financial advice, tax docs, etc.).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query — matches against title, content, and category" },
        category: { type: "string", description: "Optional category filter" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_document",
    description:
      "Read the full content of a specific knowledge base document by ID. Use after search_knowledge_base to get complete details.",
    input_schema: {
      type: "object",
      properties: {
        doc_id: { type: "string", description: "The document ID from search results" },
      },
      required: ["doc_id"],
    },
  },
  {
    name: "save_to_knowledge_base",
    description:
      "Save a new document to the user's knowledge base, or update an existing one. Use this to preserve important plans, summaries, strategies, or reference material from the conversation so the user can access it later. Always write clean markdown with clear headings. If doc_id is provided, the existing document will be updated.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short descriptive title for the document" },
        content: { type: "string", description: "Full markdown content of the document" },
        category: {
          type: "string",
          description: "Category for the document. Choose from: General, Insurance, Financial Advice, Tax Reference, Legal, Medical, Work, Personal — or provide a custom category.",
        },
        doc_id: { type: "string", description: "Optional: existing document ID to update instead of creating a new one" },
      },
      required: ["title", "content", "category"],
    },
  },
]

// ── Validation helpers ────────────────────────────────────────────────────────

// ── Freshness tracker ─────────────────────────────────────────────────────────

const TOOL_SECTION_MAP: Record<string, string> = {
  log_transaction: "transactions",
  bulk_log_transactions: "transactions",
  import_csv_transactions: "transactions",
  upsert_account: "accounts",
  upsert_budget: "budgets",
  upsert_debt: "debts",
  upsert_income_source: "income",
  upsert_recurring_expense: "expenses",
  upsert_investment: "investments",
  upsert_insurance_policy: "insurance",
  upsert_tax_item: "taxes",
  upsert_business_engagement: "income",
  upsert_credit_account: "credit",
  update_credit_profile: "credit",
}

async function touchFreshness(supabase: SupabaseClient<Database>, userId: string, toolName: string) {
  const section = TOOL_SECTION_MAP[toolName]
  if (!section) return
  await (supabase as any).from("data_freshness").upsert(
    { user_id: userId, section, last_updated: new Date().toISOString() },
    { onConflict: "user_id,section" }
  )
}

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

      case "upsert_business_engagement":
        return await upsertBusinessEngagement(supabase, userId, input)

      case "upsert_insurance_policy":
        return await upsertInsurancePolicy(supabase, userId, input)

      case "upsert_tax_item":
        return await upsertTaxItem(supabase, userId, input)

      case "upsert_credit_account":
        return await upsertCreditAccount(supabase, userId, input)

      case "update_credit_profile":
        return await updateCreditProfile(supabase, userId, input)

      case "save_note":
        return await saveNote(supabase, userId, input)

      case "delete_note":
        return await deleteNote(supabase, userId, input)

      case "add_calendar_event":
        return await addCalendarEvent(supabase, userId, input)

      case "search_knowledge_base":
        return await searchKnowledgeBase(supabase, userId, input)

      case "read_document":
        return await readDocument(supabase, userId, input)

      case "save_to_knowledge_base":
        return await saveToKnowledgeBase(supabase, userId, input)

      default:
        return `Unknown tool: ${name}`
    }
  } catch (err) {
    return `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    // Auto-touch freshness for write operations (fire-and-forget)
    touchFreshness(supabase, userId, name).catch(() => {})
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

  const [accountsRes, txRes, budgetsRes, debtsRes, incomeRes, investmentsRes, recurringRes, expSectionsRes, engagementsRes, insuranceRes, taxRes, creditAccountsRes, creditProfileRes] =
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
      supabase.from("expense_sections").select("*").order("position"),
      supabase.from("business_engagements").select("*").order("date", { ascending: false }),
      supabase.from("insurance_policies").select("*").order("name"),
      supabase.from("tax_items").select("*").order("tax_year", { ascending: false }),
      (supabase as any).from("credit_accounts").select("*").order("name"),
      (supabase as any).from("credit_profile").select("*").limit(1),
    ])

  return JSON.stringify({
    accounts: accountsRes.data ?? [],
    transactions: txRes.data ?? [],
    budgets: budgetsRes.data ?? [],
    debts: debtsRes.data ?? [],
    income_sources: incomeRes.data ?? [],
    investments: investmentsRes.data ?? [],
    recurring_expenses: recurringRes.data ?? [],
    expense_sections: expSectionsRes.data ?? [],
    business_engagements: engagementsRes.data ?? [],
    insurance_policies: insuranceRes.data ?? [],
    tax_items: taxRes.data ?? [],
    credit_accounts: creditAccountsRes.data ?? [],
    credit_profile: creditProfileRes.data?.[0] ?? null,
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
  const grossAmt = input.gross_amount != null ? Number(input.gross_amount) : null
  const netAmt = Number(input.amount)
  const ded = input.deductions != null ? Number(input.deductions) : (grossAmt ? grossAmt - netAmt : null)

  const payload = {
    user_id: userId,
    name: input.name as string,
    amount: netAmt,
    gross_amount: grossAmt,
    deductions: ded,
    bonus_amount: input.bonus_amount != null ? Number(input.bonus_amount) : null,
    bonus_frequency: (input.bonus_frequency as string) ?? null,
    frequency: input.frequency as string,
    next_date: (input.next_date as string) ?? null,
    active: (input.active as boolean) ?? true,
  }
  if (id) {
    const { error, data } = await supabase.from("income_sources").update(payload as never).eq("id", id).select().single()
    if (error) return `Failed to update income source: ${error.message}`
    return `Income source updated: "${data.name}" — net $${data.amount} ${data.frequency}${grossAmt ? `, gross $${grossAmt}` : ""}${ded ? `, deductions $${ded}` : ""}`
  } else {
    const { error, data } = await supabase.from("income_sources").insert(payload as never).select().single()
    if (error) return `Failed to add income source: ${error.message}`
    return `Income source added: "${data.name}" — net $${data.amount} ${data.frequency}${grossAmt ? `, gross $${grossAmt}` : ""}${ded ? `, deductions $${ded}` : ""}`
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
    section_id: (input.section_id as string) ?? null,
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

async function upsertBusinessEngagement(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const id = input.id as string | undefined
  const payload = {
    user_id: userId,
    client: input.client as string,
    description: (input.description as string) ?? null,
    date: input.date as string,
    amount: Number(input.amount),
    tax_rate: input.tax_rate != null ? Number(input.tax_rate) : 0.30,
    status: (input.status as string) ?? "active",
  }
  if (id) {
    const { error, data } = await supabase.from("business_engagements").update(payload as never).eq("id", id).select().single()
    if (error) return `Failed to update engagement: ${error.message}`
    const d = data as Record<string, unknown>
    return `Engagement updated: "${d.client}" — $${d.amount} (taxes: $${d.taxes_owed}, revenue: $${d.revenue})`
  } else {
    const { error, data } = await supabase.from("business_engagements").insert(payload as never).select().single()
    if (error) return `Failed to add engagement: ${error.message}`
    const d = data as Record<string, unknown>
    return `Engagement added: "${d.client}" — $${d.amount} (taxes: $${d.taxes_owed}, revenue: $${d.revenue})`
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

async function upsertInsurancePolicy(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const nameErr = validateString(input.name, "Name")
  if (nameErr) return nameErr

  const payload = {
    user_id: userId,
    name: input.name as string,
    type: (input.type as string) ?? "other",
    provider: (input.provider as string) ?? "",
    policy_number: (input.policy_number as string) ?? null,
    premium: Number(input.premium ?? 0),
    premium_frequency: (input.premium_frequency as string) ?? "monthly",
    deductible: input.deductible != null ? Number(input.deductible) : null,
    coverage_amount: input.coverage_amount != null ? Number(input.coverage_amount) : null,
    renewal_date: (input.renewal_date as string) ?? null,
    notes: (input.notes as string) ?? null,
    active: input.active !== false,
  }

  const id = input.id as string | undefined
  if (id) {
    const { error, data } = await supabase.from("insurance_policies").update(payload as never).eq("id", id).select().single()
    if (error) return `Failed to update insurance policy: ${error.message}`
    return `Insurance policy updated: "${data.name}" (${data.type}) — $${data.premium}/${payload.premium_frequency}`
  } else {
    const { error, data } = await supabase.from("insurance_policies").insert(payload as never).select().single()
    if (error) return `Failed to add insurance policy: ${error.message}`
    return `Insurance policy added: "${data.name}" (${data.type}) — $${data.premium}/${payload.premium_frequency}`
  }
}

async function upsertTaxItem(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const nameErr = validateString(input.name, "Name")
  if (nameErr) return nameErr

  const payload = {
    user_id: userId,
    name: input.name as string,
    amount: Number(input.amount ?? 0),
    type: (input.type as string) ?? "other",
    tax_year: Number(input.tax_year ?? new Date().getFullYear()),
    form_source: (input.form_source as string) ?? null,
    category: (input.category as string) ?? null,
    filed: (input.filed as boolean) ?? false,
    due_date: (input.due_date as string) ?? null,
    notes: (input.notes as string) ?? null,
  }

  const id = input.id as string | undefined
  if (id) {
    const { error, data } = await supabase.from("tax_items").update(payload as never).eq("id", id).select().single()
    if (error) return `Failed to update tax item: ${error.message}`
    return `Tax item updated: "${data.name}" ($${data.amount}) — ${data.type} for ${data.tax_year}${payload.form_source ? ` [${payload.form_source}]` : ""}`
  } else {
    const { error, data } = await supabase.from("tax_items").insert(payload as never).select().single()
    if (error) return `Failed to add tax item: ${error.message}`
    return `Tax item added: "${data.name}" ($${data.amount}) — ${data.type} for ${data.tax_year}${payload.form_source ? ` [${payload.form_source}]` : ""}`
  }
}

async function upsertCreditAccount(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const nameErr = validateString(input.name, "Name")
  if (nameErr) return nameErr

  const payload = {
    user_id: userId,
    name: input.name as string,
    type: (input.type as string) ?? "credit_card",
    balance: Number(input.balance ?? 0),
    credit_limit: input.credit_limit != null ? Number(input.credit_limit) : null,
    opened_date: (input.opened_date as string) ?? null,
    status: (input.status as string) ?? "open",
    lender: (input.lender as string) ?? null,
  }

  const id = input.id as string | undefined
  if (id) {
    const { error, data } = await (supabase as any).from("credit_accounts").update(payload).eq("id", id).select().single()
    if (error) return `Failed to update credit account: ${error.message}`
    return `Credit account updated: "${data.name}" (${data.type}) — balance $${data.balance}${data.credit_limit ? `, limit $${data.credit_limit}` : ""}`
  } else {
    const { error, data } = await (supabase as any).from("credit_accounts").insert(payload).select().single()
    if (error) return `Failed to add credit account: ${error.message}`
    return `Credit account added: "${data.name}" (${data.type}) — balance $${data.balance}${data.credit_limit ? `, limit $${data.credit_limit}` : ""}`
  }
}

async function updateCreditProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const score = Number(input.score)
  if (!Number.isFinite(score) || score < 300 || score > 850) return "Score must be between 300 and 850"

  const payload = {
    user_id: userId,
    score,
    score_source: (input.score_source as string) ?? "TransUnion",
    payment_history_pct: input.payment_history_pct != null ? Number(input.payment_history_pct) : null,
    payment_history_rating: (input.payment_history_rating as string) ?? null,
    credit_card_use_pct: input.credit_card_use_pct != null ? Number(input.credit_card_use_pct) : null,
    credit_card_use_rating: (input.credit_card_use_rating as string) ?? null,
    derogatory_marks: input.derogatory_marks != null ? Number(input.derogatory_marks) : null,
    derogatory_marks_rating: (input.derogatory_marks_rating as string) ?? null,
    credit_age_years: input.credit_age_years != null ? Number(input.credit_age_years) : null,
    credit_age_months: input.credit_age_months != null ? Number(input.credit_age_months) : null,
    credit_age_rating: (input.credit_age_rating as string) ?? null,
    total_accounts: input.total_accounts != null ? Number(input.total_accounts) : null,
    total_accounts_rating: (input.total_accounts_rating as string) ?? null,
    hard_inquiries: input.hard_inquiries != null ? Number(input.hard_inquiries) : null,
    hard_inquiries_rating: (input.hard_inquiries_rating as string) ?? null,
    last_updated: new Date().toISOString().split("T")[0],
  }

  // Upsert: try update first, then insert if not found
  const { data: existing } = await (supabase as any).from("credit_profile").select("id").eq("user_id", userId).single()
  if (existing) {
    const { error } = await (supabase as any).from("credit_profile").update(payload).eq("id", existing.id)
    if (error) return `Failed to update credit profile: ${error.message}`
    return `Credit profile updated: score ${score} (${payload.score_source})`
  } else {
    const { error } = await (supabase as any).from("credit_profile").insert(payload)
    if (error) return `Failed to create credit profile: ${error.message}`
    return `Credit profile created: score ${score} (${payload.score_source})`
  }
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

async function searchKnowledgeBase(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const query = String(input.query ?? "").toLowerCase()
  if (!query) return "Please provide a search query."

  let q = (supabase as any)
    .from("knowledge_docs")
    .select("id, title, category, content")
    .eq("user_id", userId)

  if (input.category) {
    q = q.eq("category", String(input.category))
  }

  const { data, error } = await q.order("title")
  if (error) return `Failed to search: ${error.message}`
  if (!data || data.length === 0) return "No documents found in knowledge base."

  // Client-side text search (simple but effective for small doc counts)
  const matches = data.filter(
    (d: any) =>
      d.title.toLowerCase().includes(query) ||
      d.content.toLowerCase().includes(query) ||
      d.category.toLowerCase().includes(query)
  )

  if (matches.length === 0) return `No documents match "${input.query}".`

  const results = matches.map((d: any) => {
    const idx = d.content.toLowerCase().indexOf(query)
    const snippet =
      idx >= 0
        ? "..." + d.content.slice(Math.max(0, idx - 50), idx + 100).trim() + "..."
        : d.content.slice(0, 120).trim() + (d.content.length > 120 ? "..." : "")
    return `[${d.id}] "${d.title}" (${d.category})\n  ${snippet}`
  })

  return `Found ${matches.length} document(s):\n\n${results.join("\n\n")}`
}

async function readDocument(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const docId = String(input.doc_id ?? "")
  if (!docId) return "Please provide a document ID."

  const { data, error } = await (supabase as any)
    .from("knowledge_docs")
    .select("*")
    .eq("id", docId)
    .eq("user_id", userId)
    .single()

  if (error || !data) return `Document not found or access denied.`

  return `# ${data.title}\n**Category:** ${data.category}\n**Updated:** ${new Date(data.updated_at).toLocaleDateString()}\n\n${data.content}`
}

async function saveToKnowledgeBase(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const title = String(input.title ?? "").trim()
  const content = String(input.content ?? "").trim()
  const category = String(input.category ?? "General").trim()
  const docId = input.doc_id ? String(input.doc_id).trim() : null

  if (!title) return "Title is required."
  if (!content) return "Content is required."

  const now = new Date().toISOString()

  if (docId) {
    // Update existing document
    const { data, error } = await (supabase as any)
      .from("knowledge_docs")
      .update({ title, content, category, updated_at: now })
      .eq("id", docId)
      .eq("user_id", userId)
      .select()
      .single()
    if (error || !data) return `Failed to update document: ${error?.message ?? "not found"}`
    return `Knowledge base document updated: "${data.title}" (${data.category})`
  } else {
    // Create new document
    const { data, error } = await (supabase as any)
      .from("knowledge_docs")
      .insert({ user_id: userId, title, content, category, created_at: now, updated_at: now })
      .select()
      .single()
    if (error || !data) return `Failed to save document: ${error?.message}`
    return `Saved to knowledge base: "${data.title}" (${data.category}) — ID: ${data.id}`
  }
}
