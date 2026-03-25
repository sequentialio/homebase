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
      "Get calendar events for a date range. Returns Mita events, Google Calendar events, and shared list items.",
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
        force_insert: { type: "boolean", description: "Set to true to bypass duplicate detection and force-insert the transaction" },
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
      "Add a new debt or update an existing one (balance, interest rate, min payment, payoff date, status, employer contribution). Use when the user shares a loan or credit card statement. If updating, provide the id from get_finances.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing debt ID to update (omit to create new)" },
        name: { type: "string", description: "Debt name (e.g. 'SCFCU Personal Loan')" },
        balance: { type: "number", description: "Current outstanding balance" },
        interest_rate: { type: "number", description: "Annual interest rate as a percentage (e.g. 6.5)" },
        min_payment: { type: "number", description: "Minimum monthly payment" },
        payoff_date: { type: "string", description: "Estimated payoff date (YYYY-MM-DD)" },
        status: { type: "string", enum: ["active", "forbearance", "deferment", "paid_off"], description: "Loan status (default: active). Use forbearance/deferment for student loans not in repayment." },
        employer_contribution: { type: "number", description: "Monthly employer contribution toward this debt (e.g. employer student loan repayment benefit)" },
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
    name: "bulk_update_account_balances",
    description:
      "Update multiple bank account balances at once. Use when the user shares a screenshot or statement showing several account balances. Much more efficient than calling upsert_account repeatedly.",
    input_schema: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          description: "Array of account updates",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Account ID from get_finances (required)" },
              balance: { type: "number", description: "New balance in dollars" },
            },
            required: ["id", "balance"],
          },
        },
      },
      required: ["updates"],
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
      "Add or update a biweekly budget for a category. Budgets are standing limits that apply every pay period. If updating, provide the id from get_finances.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing budget ID to update (omit to create new)" },
        category: { type: "string", description: "Budget category (e.g. Groceries, Dining, Transport)" },
        period_limit: { type: "number", description: "Biweekly spending limit per pay period in dollars" },
      },
      required: ["category", "period_limit"],
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
        linked_debt_id: { type: "string", description: "ID of a debt record to link to this credit account. When linked, balance updates propagate bidirectionally between credit_accounts and debts." },
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
  {
    name: "get_budget_forecast",
    description:
      "Project pay-period-end spending per budget category based on current spend and days elapsed. Returns forecasted overage or underage for each category. Use when the user asks about budget projections, spending pace, or whether they'll blow their budget this pay period.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "check_recurring_reconciliation",
    description:
      "Compare active recurring expenses against actual transactions for a given month to identify missing charges. Useful for catching skipped autopays, subscription lapses, or bills that haven't posted yet. Returns matched, missing, and pending recurring items.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month 1-12 (default: current month)" },
        year: { type: "number", description: "Year (default: current year)" },
      },
    },
  },
  {
    name: "snapshot_net_worth",
    description:
      "Save a net worth snapshot for today based on current bank accounts, investments, and debts. One snapshot per day — calling again on the same day updates it. Call proactively after the user updates their balances or asks about net worth trends. This enables historical tracking and trend charts.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_net_worth_history",
    description:
      "Retrieve historical net worth snapshots to show trends over time. Returns snapshots with net worth, assets, liabilities, and breakdown. Use when the user asks about progress, trends, or 'how am I doing vs last month'.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of snapshots to retrieve (default 12, max 52)" },
      },
    },
  },
  {
    name: "simulate_budget_change",
    description:
      "Run a what-if scenario: model hypothetical changes to income or expenses and show the impact on monthly cash flow, savings rate, and (optionally) debt payoff timeline. Pure computation — nothing is saved. Use when the user asks 'what if I cut X', 'what if rent goes up', or 'what if my income changes'.",
    input_schema: {
      type: "object",
      properties: {
        income_change: { type: "number", description: "Monthly income change in dollars (positive = increase, negative = decrease). 0 if no change." },
        expense_changes: {
          type: "array",
          description: "List of expense adjustments by category",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              delta: { type: "number", description: "Change in dollars per month (positive = more spending, negative = less)" },
            },
            required: ["category", "delta"],
          },
        },
        extra_debt_payment: { type: "number", description: "Additional monthly debt payment to model (optional)" },
        target_debt_name: { type: "string", description: "Name of the debt to apply extra payment toward (optional)" },
        months_to_project: { type: "number", description: "How many months to project into the future (default 12)" },
      },
      required: ["expense_changes"],
    },
  },
  {
    name: "calculate_withholding_adjustment",
    description:
      "Calculate recommended per-paycheck withholding adjustment to break even or hit a target refund by year-end. Uses 2025 federal tax brackets. Call get_finances first to get tax items if use_stored_tax_data is true.",
    input_schema: {
      type: "object",
      properties: {
        paychecks_remaining: { type: "number", description: "Number of paychecks remaining in the tax year" },
        current_withholding_per_check: { type: "number", description: "Current federal withholding per paycheck in dollars" },
        filing_status: { type: "string", enum: ["single", "married_jointly", "married_separately", "head_of_household"], description: "Filing status (default: single)" },
        use_stored_tax_data: { type: "boolean", description: "Pull gross income and withholding totals from stored tax_items (default true). Set false to use override values." },
        override_gross_income: { type: "number", description: "Override: total gross income YTD (use when use_stored_tax_data is false)" },
        override_total_withheld: { type: "number", description: "Override: total federal withheld YTD (use when use_stored_tax_data is false)" },
        target_refund: { type: "number", description: "Target refund amount (default 0 = break even)" },
      },
      required: ["paychecks_remaining", "current_withholding_per_check"],
    },
  },
  {
    name: "create_alert",
    description:
      "Create a persistent notification that appears in the app's alert bell. Use proactively for: budget categories over 80% with days left in the month (warning), budget over 100% (critical), recurring expenses with billing_day within 3 days (info), insurance renewals within 30 days (warning). Call get_alerts first to avoid creating duplicates. Severity: info, warning, critical.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Alert type slug: budget_warning, upcoming_bill, recurring_missed, net_worth_drop, insurance_renewal, custom" },
        title: { type: "string", description: "Short alert title (max 60 chars)" },
        message: { type: "string", description: "Detailed alert message (1-2 sentences)" },
        severity: { type: "string", enum: ["info", "warning", "critical"] },
        due_date: { type: "string", description: "Associated due date YYYY-MM-DD (optional)" },
        expires_at: { type: "string", description: "ISO 8601 datetime when this alert auto-expires (optional). Default: end of current month for budget alerts, 7 days for bills." },
      },
      required: ["type", "title", "message", "severity"],
    },
  },
  {
    name: "get_alerts",
    description:
      "Get the user's active (non-expired) alerts. Call before create_alert to check for existing alerts of the same type to avoid duplicates.",
    input_schema: {
      type: "object",
      properties: {
        include_read: { type: "boolean", description: "Include already-dismissed alerts (default false)" },
      },
    },
  },
  {
    name: "dismiss_alert",
    description:
      "Mark an alert as read/dismissed. Call when the user acknowledges an alert or the issue is resolved.",
    input_schema: {
      type: "object",
      properties: {
        alert_id: { type: "string", description: "The alert ID to dismiss" },
      },
      required: ["alert_id"],
    },
  },
  {
    name: "upsert_goal",
    description:
      "Create or update a goal. Goals track what the user is working toward — financial targets, personal milestones, household projects. If goal_id is provided, the existing goal will be updated. Use this to help the user set, adjust, or mark goals as achieved.",
    input_schema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "Optional: existing goal ID to update" },
        title: { type: "string", description: "Short goal title" },
        description: { type: "string", description: "Optional longer description" },
        category: { type: "string", description: "Category: Financial, Personal, Household, Career, Health, or Other" },
        goal_type: { type: "string", enum: ["increase", "decrease"], description: "increase = grow toward target (e.g. save $5k), decrease = reduce from target toward 0 (e.g. pay off $15k debt). Default: increase" },
        target_amount: { type: "number", description: "Optional target dollar amount. For decrease goals, this is the starting amount (e.g. original debt balance)" },
        current_amount: { type: "number", description: "Current amount. For decrease goals, this is the remaining balance" },
        target_date: { type: "string", description: "Optional target date (YYYY-MM-DD)" },
        status: { type: "string", description: "Status: active, achieved, or paused" },
        priority: { type: "string", description: "Priority: high, medium, or low" },
      },
      required: ["title", "category"],
    },
  },
  {
    name: "create_dev_request",
    description:
      "Log an improvement request, bug report, or feature idea for Claude Code to implement. Use this whenever you notice a bug in the app, a missing feature the user needs, an improvement that would make things better, or a question about the codebase. These requests appear on the Goals page for the user to review and bring to a Claude Code session. Be specific: include what the issue is, why it matters, and any relevant context from the conversation.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short descriptive title" },
        description: { type: "string", description: "Clear description of the issue or request" },
        category: { type: "string", description: "bug, improvement, feature, or question" },
        priority: { type: "string", description: "high, medium, or low" },
        context: { type: "string", description: "Optional: relevant conversation context or user quote" },
      },
      required: ["title", "description", "category", "priority"],
    },
  },
  {
    name: "get_usage_insights",
    description:
      "Get behavioral insights from the user's usage history — which pages they visit most, which features they use, usage patterns over time. Use this to personalize advice, notice neglected areas, or understand how the user actually uses the app.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days of history to analyze (default 30)" },
      },
    },
  },
  {
    name: "delete_record",
    description:
      "Permanently delete a record by ID. Use for removing incorrect transactions, duplicate entries, stale accounts, paid-off debts, cancelled subscriptions, etc. Always confirm with the user before deleting financial records unless they explicitly asked to delete it.",
    input_schema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table to delete from: transactions, debts, bank_accounts, recurring_expenses, insurance_policies, investments, budgets, credit_accounts, tax_items, income_sources, business_engagements, calendar_events, grocery_items, goals, dev_requests",
        },
        id: { type: "string", description: "UUID of the record to delete" },
      },
      required: ["table", "id"],
    },
  },
  {
    name: "update_calendar_event",
    description:
      "Update an existing Mita calendar event (title, time, description). Only works on events created in Mita — not Google Calendar synced events or shared list items. Get event IDs from get_calendar_events.",
    input_schema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "ID of the event to update" },
        title: { type: "string", description: "Updated event title" },
        start_at: { type: "string", description: "Updated start datetime in ISO 8601 format" },
        end_at: { type: "string", description: "Updated end datetime in ISO 8601 format" },
        description: { type: "string", description: "Updated notes/description" },
        all_day: { type: "boolean", description: "Whether it is an all-day event" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "toggle_shopping_item",
    description:
      "Check or uncheck a shopping list item (mark as purchased/unpurchased). Optionally move to pantry when checked off. Get item IDs from get_pantry_and_grocery.",
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "ID of the grocery item" },
        checked: { type: "boolean", description: "true = purchased/checked off, false = uncheck" },
        move_to_pantry: { type: "boolean", description: "If true, also move item to pantry (sets in_pantry=true). Use when the user has bought the item and wants it tracked in their pantry." },
      },
      required: ["item_id", "checked"],
    },
  },
  {
    name: "complete_cleaning_duty",
    description:
      "Mark a cleaning duty as completed today and automatically recalculate the next due date based on its frequency. Get duty IDs from get_cleaning_duties.",
    input_schema: {
      type: "object",
      properties: {
        duty_id: { type: "string", description: "ID of the cleaning duty to mark complete" },
      },
      required: ["duty_id"],
    },
  },
  {
    name: "get_shared_finances",
    description:
      "Get shared account balances, recent shared transactions, and responsibility splits between household members.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_shared_responsibility",
    description:
      "Set the responsibility percentage for a user on a shared bank account. Both users' percentages should sum to 100.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        user_id: { type: "string" },
        percentage: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["account_id", "user_id", "percentage"],
    },
  },
  {
    name: "log_weight",
    description:
      "Log a weight entry for the current user. If an entry already exists for the given date, it will be updated (upsert). Weight is in pounds.",
    input_schema: {
      type: "object",
      properties: {
        weight: { type: "number" },
        date: { type: "string", description: "YYYY-MM-DD format" },
        notes: { type: "string" },
      },
      required: ["weight"],
    },
  },
  {
    name: "log_exercise",
    description: "Log an exercise entry for the current user.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "e.g. Run, Weights, Yoga, Walk, Cycling, Swimming, HIIT" },
        duration_minutes: { type: "number" },
        distance: { type: "number", description: "in miles" },
        calories: { type: "number" },
        date: { type: "string", description: "YYYY-MM-DD format" },
        notes: { type: "string" },
      },
      required: ["type"],
    },
  },
  {
    name: "get_health_data",
    description:
      "Get recent weight and exercise logs for one or both users.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Optional: filter by user. Omit for both users." },
        days: { type: "number", description: "Number of days back. Default 30." },
      },
      required: [],
    },
  },
  {
    name: "send_household_message",
    description:
      "Send a message in the household chat between Alan and Dani.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string" },
      },
      required: ["content"],
    },
  },
  {
    name: "manage_shared_list",
    description: "Create, update, or delete a shared list.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update", "delete"] },
        id: { type: "string", description: "Required for update/delete" },
        name: { type: "string", description: "Required for create, optional for update" },
      },
      required: ["action"],
    },
  },
  {
    name: "manage_shared_list_item",
    description:
      "Add, update, check/uncheck, or delete items on a shared list.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "update", "check", "uncheck", "delete"] },
        list_id: { type: "string", description: "Required for add" },
        id: { type: "string", description: "Required for update/check/uncheck/delete" },
        title: { type: "string", description: "Required for add, optional for update" },
        due_date: { type: "string", description: "YYYY-MM-DD format, optional" },
        assigned_to: { type: "string", description: "User ID, optional" },
      },
      required: ["action"],
    },
  },
]

// ── Validation helpers ────────────────────────────────────────────────────────

// ── Freshness tracker ─────────────────────────────────────────────────────────

// ── Category normalization ────────────────────────────────────────────────────

const CATEGORY_ALIASES: Record<string, string> = {
  "dining": "Food & Dining",
  "fast food": "Food & Dining",
  "coffee shops": "Food & Dining",
  "coffee": "Food & Dining",
  "restaurants": "Food & Dining",
  "restaurant": "Food & Dining",
  "food & drink": "Food & Dining",
  "electronics & software": "Software",
  "dentist": "Healthcare",
  "doctor": "Healthcare",
  "medical": "Healthcare",
}

function normalizeCategory(category: string | undefined | null): string | null {
  if (!category) return null
  const trimmed = category.trim()
  return CATEGORY_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

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
  snapshot_net_worth: "accounts",
  create_alert: "alerts",
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

      case "bulk_update_account_balances":
        return await bulkUpdateAccountBalances(supabase, userId, input)

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

      case "get_budget_forecast":
        return await getBudgetForecast(supabase, userId, input)

      case "check_recurring_reconciliation":
        return await checkRecurringReconciliation(supabase, userId, input)

      case "snapshot_net_worth":
        return await snapshotNetWorth(supabase, userId)

      case "get_net_worth_history":
        return await getNetWorthHistory(supabase, userId, input)

      case "simulate_budget_change":
        return await simulateBudgetChange(supabase, userId, input)

      case "calculate_withholding_adjustment":
        return await calculateWithholdingAdjustment(supabase, userId, input)

      case "create_alert":
        return await createAlert(supabase, userId, input)

      case "get_alerts":
        return await getAlerts(supabase, userId, input)

      case "dismiss_alert":
        return await dismissAlert(supabase, userId, input)

      case "upsert_goal":
        return await upsertGoal(supabase, userId, input)

      case "create_dev_request":
        return await createDevRequest(supabase, userId, input)

      case "get_usage_insights":
        return await getUsageInsights(supabase, userId, input)

      case "delete_record":
        return await deleteRecord(supabase, userId, input)

      case "update_calendar_event":
        return await updateCalendarEvent(supabase, userId, input)

      case "toggle_shopping_item":
        return await toggleShoppingItem(supabase, input)

      case "complete_cleaning_duty":
        return await completeCleaningDuty(supabase, input)

      case "get_shared_finances":
        return await getSharedFinances(supabase, userId, input)

      case "update_shared_responsibility":
        return await updateSharedResponsibility(supabase, userId, input)

      case "log_weight":
        return await logWeight(supabase, userId, input)

      case "log_exercise":
        return await logExercise(supabase, userId, input)

      case "get_health_data":
        return await getHealthData(supabase, userId, input)

      case "send_household_message":
        return await sendHouseholdMessage(supabase, userId, input)

      case "manage_shared_list":
        return await manageSharedList(supabase, userId, input)

      case "manage_shared_list_item":
        return await manageSharedListItem(supabase, userId, input)

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
      supabase.from("bank_accounts").select("id, name, balance, currency"),
      supabase
        .from("transactions")
        .select("id, date, type, amount, category, description, account_id, scope")
        .gte("date", since)
        .order("date", { ascending: false })
        .limit(150),
      supabase.from("budgets").select("id, category, period_limit, section_id"),
      supabase.from("debts").select("id, name, balance, interest_rate, min_payment, status"),
      supabase.from("income_sources").select("id, name, amount, frequency, gross_amount, deductions, active").eq("active", true),
      supabase.from("investments").select("id, name, account_type, balance, gain_loss, rate_of_return").order("name"),
      supabase.from("recurring_expenses").select("id, name, amount, category, frequency, billing_day, auto_pay, active").eq("active", true).order("position"),
      supabase.from("expense_sections").select("id, name, position").order("position"),
      supabase.from("business_engagements").select("id, client, date, amount, taxes_owed, revenue, status").order("date", { ascending: false }).limit(20),
      supabase.from("insurance_policies").select("id, name, type, provider, premium, renewal_date, notes").order("name"),
      supabase.from("tax_items").select("id, name, amount, type, tax_year, form_source, category").order("tax_year", { ascending: false }),
      (supabase as any).from("credit_accounts").select("id, name, type, balance, credit_limit, status, linked_debt_id").order("name"),
      (supabase as any).from("credit_profile").select("score, score_source, payment_history_pct, credit_card_use_pct, derogatory_marks, credit_age_years, total_accounts, hard_inquiries, last_updated").limit(1),
    ])

  return JSON.stringify({
    accounts: accountsRes.data ?? [],
    transactions: txRes.data ?? [],
    transaction_count: `${(txRes.data ?? []).length} shown (limit 150)`,
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

  const date = (input.date as string) ?? new Date().toISOString().split("T")[0]
  const amount = Number(input.amount)
  const category = normalizeCategory(input.category as string | undefined)

  // Duplicate detection (skip if force_insert is set)
  if (!input.force_insert) {
    const { data: dupes } = await supabase
      .from("transactions")
      .select("id, description, amount, date, type")
      .eq("user_id", userId)
      .eq("date", date)
      .eq("amount", amount)
      .eq("type", input.type as string)
      .limit(3)
    if (dupes && dupes.length > 0) {
      return `⚠️ Possible duplicate: a ${input.type} of $${amount} (${dupes[0].description}) already exists on ${date}. If this is intentional, pass force_insert: true to save anyway.`
    }
  }

  const { error, data } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: input.type as string,
      amount,
      description: input.description as string,
      category,
      date,
      scope,
      account_id: (input.account_id as string) ?? null,
    } as never)
    .select()
    .single()

  if (error) return `Failed to log transaction: ${error.message}`

  // Log audit event
  const { insertAuditLog } = await import("@/lib/audit")
  await insertAuditLog({
    userId,
    action: "transaction_logged",
    targetTable: "transactions",
    targetId: data.id,
    details: { type: data.type, amount, category, scope },
  })

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
    category: normalizeCategory(t.category) ?? null,
    date: t.date ?? today,
    scope: t.scope ?? "personal",
    account_id: t.account_id ?? null,
  }))

  const { error, data } = await supabase.from("transactions").insert(rows as never).select()
  if (error) return `Failed to log transactions: ${error.message}`

  // Log audit event
  const { insertAuditLog } = await import("@/lib/audit")
  await insertAuditLog({
    userId,
    action: "bulk_transactions_logged",
    targetTable: "transactions",
    details: { count: data.length, samples: data.slice(0, 3).map(d => ({ type: d.type, amount: d.amount })) },
  })

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
    status: (input.status as string) ?? "active",
    employer_contribution: input.employer_contribution != null ? Number(input.employer_contribution) : null,
    notes: (input.notes as string) ?? null,
  }
  let result: string
  let debtId: string
  if (id) {
    const { error, data } = await supabase.from("debts").update(payload as never).eq("id", id).select().single()
    if (error) return `Failed to update debt: ${error.message}`
    debtId = data.id
    const statusNote = (data as any).status && (data as any).status !== "active" ? ` [${(data as any).status}]` : ""
    const empNote = (data as any).employer_contribution ? ` (employer contributes $${(data as any).employer_contribution}/mo)` : ""
    result = `Debt updated: "${data.name}" — balance $${data.balance}${data.min_payment ? `, min payment $${data.min_payment}` : ""}${statusNote}${empNote}`
  } else {
    const { error, data } = await supabase.from("debts").insert(payload as never).select().single()
    if (error) return `Failed to add debt: ${error.message}`
    debtId = data.id
    result = `Debt added: "${data.name}" — balance $${data.balance}`
  }

  // Bidirectional sync: propagate balance to any linked credit account
  if (input.balance !== undefined) {
    const { data: linked } = await (supabase as any)
      .from("credit_accounts")
      .select("id")
      .eq("linked_debt_id", debtId)
      .eq("user_id", userId)
    if (linked && linked.length > 0) {
      await (supabase as any)
        .from("credit_accounts")
        .update({ balance: Number(input.balance) })
        .eq("linked_debt_id", debtId)
        .eq("user_id", userId)
      result += ` (synced balance to ${linked.length} linked credit account${linked.length > 1 ? "s" : ""})`
    }
  }

  return result
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

async function bulkUpdateAccountBalances(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const updates = input.updates as Array<{ id: string; balance: number }>
  if (!updates?.length) return "No updates provided."
  const now = new Date().toISOString().split("T")[0]
  const results: string[] = []
  for (const u of updates) {
    const { error, data } = await supabase
      .from("bank_accounts")
      .update({ balance: Number(u.balance), last_updated: now })
      .eq("id", u.id)
      .eq("user_id", userId)
      .select("name, balance")
      .single()
    if (error) results.push(`❌ ID ${u.id}: ${error.message}`)
    else results.push(`${data.name}: $${data.balance}`)
  }
  return `Updated ${results.filter(r => !r.startsWith("❌")).length}/${updates.length} accounts:\n${results.join("\n")}`
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
  const payload = {
    user_id: userId,
    category: input.category as string,
    period_limit: Number(input.period_limit),
  }
  if (id) {
    const { error, data } = await supabase.from("budgets").update(payload as never).eq("id", id).select().single()
    if (error) return `Failed to update budget: ${error.message}`
    return `Budget updated: ${(data as any).category} — $${(data as any).period_limit}/pay period`
  } else {
    const { error, data } = await supabase.from("budgets").insert(payload as never).select().single()
    if (error) return `Failed to add budget: ${error.message}`
    return `Budget added: ${(data as any).category} — $${(data as any).period_limit}/pay period`
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

  const payload: Record<string, unknown> = {
    user_id: userId,
    name: input.name as string,
    type: (input.type as string) ?? "credit_card",
    balance: Number(input.balance ?? 0),
    credit_limit: input.credit_limit != null ? Number(input.credit_limit) : null,
    opened_date: (input.opened_date as string) ?? null,
    status: (input.status as string) ?? "open",
    lender: (input.lender as string) ?? null,
  }

  if (input.linked_debt_id !== undefined) {
    payload.linked_debt_id = (input.linked_debt_id as string) || null
  }

  const id = input.id as string | undefined
  let result: string
  let savedData: any
  if (id) {
    const { error, data } = await (supabase as any).from("credit_accounts").update(payload).eq("id", id).select().single()
    if (error) return `Failed to update credit account: ${error.message}`
    savedData = data
    result = `Credit account updated: "${data.name}" (${data.type}) — balance $${data.balance}${data.credit_limit ? `, limit $${data.credit_limit}` : ""}`
  } else {
    const { error, data } = await (supabase as any).from("credit_accounts").insert(payload).select().single()
    if (error) return `Failed to add credit account: ${error.message}`
    savedData = data
    result = `Credit account added: "${data.name}" (${data.type}) — balance $${data.balance}${data.credit_limit ? `, limit $${data.credit_limit}` : ""}`
  }

  // Bidirectional sync: propagate balance to linked debt
  const linkedDebtId = savedData.linked_debt_id as string | null
  if (linkedDebtId && input.balance !== undefined) {
    const { error: syncErr } = await supabase.from("debts").update({ balance: Number(input.balance) } as never).eq("id", linkedDebtId).eq("user_id", userId)
    if (!syncErr) result += ` (synced balance to linked debt)`
  }

  return result
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
  // Use date string slice for all-day events to avoid UTC→local timezone shift
  const displayDate = data.all_day ? data.start_at.slice(0, 10) : new Date(data.start_at).toLocaleDateString()
  return `Event added: "${data.title}" on ${displayDate}`
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

// ── Budget forecast ───────────────────────────────────────────────────────────

async function getBudgetForecast(
  supabase: SupabaseClient<Database>,
  userId: string,
  _input: Record<string, unknown>
): Promise<string> {
  const { getCurrentPayPeriod } = await import("@/lib/pay-period")
  const period = getCurrentPayPeriod()
  const now = new Date()

  // Calculate days elapsed and total days in pay period
  const periodStartDate = new Date(period.start + "T00:00:00")
  const periodEndDate = new Date(period.end + "T00:00:00")
  const totalDays = 14
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - periodStartDate.getTime()) / (24 * 60 * 60 * 1000)))

  const [txRes, budgetsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("category, amount, type")
      .eq("user_id", userId)
      .gte("date", period.start)
      .lte("date", period.end)
      .eq("type", "expense"),
    supabase.from("budgets").select("*").eq("user_id", userId),
  ])

  const transactions = txRes.data ?? []
  const budgets = budgetsRes.data ?? []

  // Sum spending by category
  const spentByCategory: Record<string, number> = {}
  for (const tx of transactions) {
    const cat = tx.category ?? "Uncategorized"
    spentByCategory[cat] = (spentByCategory[cat] ?? 0) + Number(tx.amount)
  }

  const results: Array<Record<string, unknown>> = []
  let totalBudget = 0
  let totalProjected = 0

  for (const budget of budgets) {
    const limit = (budget as any).period_limit
    const spent = spentByCategory[budget.category] ?? 0
    const dailyRate = daysElapsed > 0 ? spent / daysElapsed : 0
    const projected = dailyRate * totalDays
    const variance = limit - projected
    const pct = limit > 0 ? (spent / limit) * 100 : 0
    const status = projected > limit ? "over" : pct > 75 ? "at_risk" : "on_track"
    totalBudget += limit
    totalProjected += projected
    results.push({
      category: budget.category,
      spent_to_date: Math.round(spent * 100) / 100,
      budget: limit,
      daily_rate: Math.round(dailyRate * 100) / 100,
      projected_period_end: Math.round(projected * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      pct_used: Math.round(pct),
      status,
    })
  }

  // Categories with spending but no budget
  for (const [cat, spent] of Object.entries(spentByCategory)) {
    if (!budgets.find((b) => b.category === cat)) {
      const dailyRate = daysElapsed > 0 ? spent / daysElapsed : 0
      results.push({
        category: cat,
        spent_to_date: Math.round(spent * 100) / 100,
        budget: null,
        daily_rate: Math.round(dailyRate * 100) / 100,
        projected_period_end: Math.round(dailyRate * totalDays * 100) / 100,
        variance: null,
        status: "no_budget",
      })
    }
  }

  results.sort((a, b) => {
    const order = { over: 0, at_risk: 1, no_budget: 2, on_track: 3 }
    return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3)
  })

  return JSON.stringify({
    pay_period: period.label,
    days_elapsed: daysElapsed,
    days_in_period: totalDays,
    categories: results,
    total_budget: Math.round(totalBudget * 100) / 100,
    total_projected: Math.round(totalProjected * 100) / 100,
    total_variance: Math.round((totalBudget - totalProjected) * 100) / 100,
  })
}

// ── Recurring reconciliation ──────────────────────────────────────────────────

async function checkRecurringReconciliation(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const now = new Date()
  const month = Number(input.month ?? now.getMonth() + 1)
  const year = Number(input.year ?? now.getFullYear())
  const today = now.getDate()

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-01`

  const [recurringRes, txRes] = await Promise.all([
    supabase.from("recurring_expenses").select("*").eq("user_id", userId).eq("active", true),
    supabase.from("transactions").select("*").eq("user_id", userId).gte("date", startDate).lt("date", endDate).eq("type", "expense"),
  ])

  const recurring = recurringRes.data ?? []
  const transactions = txRes.data ?? []

  // Generic words to exclude from token matching — too common to be meaningful signals
  const STOPWORDS = new Set([
    "payment", "transfer", "fee", "loan", "charge", "pay", "auto",
    "debit", "direct", "from", "the", "and", "for", "inc", "llc", "corp",
    "bill", "billing", "monthly", "subscription",
  ])

  const getSpecificTokens = (name: string) =>
    name.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w))

  const getAllTokens = (name: string) =>
    name.toLowerCase().split(/\s+/).filter(w => w.length >= 3)

  const matched: Array<Record<string, unknown>> = []
  const missing: Array<Record<string, unknown>> = []
  const pending: Array<Record<string, unknown>> = []

  // Track which transactions have been matched so we don't double-count
  const matchedTxIds = new Set<string>()

  for (const expense of recurring) {
    if (expense.frequency !== "monthly" && expense.frequency !== "weekly" && expense.frequency !== "biweekly") continue
    const billingDay = (expense as any).billing_day as number | null
    const specificTokens = getSpecificTokens(expense.name)
    const allTokens = getAllTokens(expense.name)

    let foundMatch: { description: string; date: string; note?: string } | null = null

    // Strategy 1: specific token + amount match (avoids generic word false positives)
    if (specificTokens.length > 0) {
      const tx = transactions.find(tx => {
        if (matchedTxIds.has(tx.id)) return false
        const desc = (tx.description ?? "").toLowerCase()
        const hasSpecificToken = specificTokens.some(t => desc.includes(t))
        const amountOk = expense.amount > 0
          ? Math.abs(Number(tx.amount) - expense.amount) / expense.amount < 0.25
          : true
        return hasSpecificToken && amountOk
      })
      if (tx) {
        matchedTxIds.add(tx.id)
        foundMatch = { description: tx.description ?? "", date: tx.date }
      }
    }

    // Strategy 2: broad token + tight amount match (fallback when no specific tokens)
    if (!foundMatch && allTokens.length > 0) {
      const tx = transactions.find(tx => {
        if (matchedTxIds.has(tx.id)) return false
        const desc = (tx.description ?? "").toLowerCase()
        const hasToken = allTokens.some(t => desc.includes(t))
        const amountOk = expense.amount > 0
          ? Math.abs(Number(tx.amount) - expense.amount) / expense.amount < 0.05
          : true
        return hasToken && amountOk
      })
      if (tx) {
        matchedTxIds.add(tx.id)
        foundMatch = { description: tx.description ?? "", date: tx.date }
      }
    }

    // Strategy 3: amount-only match within 2% BUT only for amounts > $50 (avoids small-amount false positives)
    // Also requires same category or the transaction has no other match candidate
    if (!foundMatch && expense.amount > 50) {
      const tx = transactions.find(tx => {
        if (matchedTxIds.has(tx.id)) return false
        const amountClose = Math.abs(Number(tx.amount) - expense.amount) / expense.amount < 0.02
        if (!amountClose) return false
        // Prefer same-category match to reduce false positives
        const sameCategory = tx.category && expense.category &&
          tx.category.toLowerCase() === expense.category.toLowerCase()
        return sameCategory
      })
      if (tx) {
        matchedTxIds.add(tx.id)
        foundMatch = { description: tx.description ?? "", date: tx.date, note: "matched by amount + category" }
      }
    }

    // Strategy 4 removed — blind pair-sum matching produced too many false positives
    // (e.g. Costco + Costco Gas matching to Therapy, random pairs summing to recurring amounts)

    if (foundMatch) {
      matched.push({
        name: expense.name,
        amount: expense.amount,
        matched_tx: foundMatch.description,
        matched_date: foundMatch.date,
        ...(foundMatch.note ? { note: foundMatch.note } : {}),
      })
    } else if (billingDay && billingDay <= today) {
      missing.push({ name: expense.name, amount: expense.amount, expected_day: billingDay, note: "Billing day passed — no matching transaction found" })
    } else if (!billingDay) {
      // No billing day set — can't determine if overdue or pending. Flag as unmatched with helpful note.
      missing.push({ name: expense.name, amount: expense.amount, expected_day: "not set", note: "No billing_day configured — unable to determine if overdue. Set billing_day to improve tracking." })
    } else {
      pending.push({ name: expense.name, amount: expense.amount, expected_day: billingDay })
    }
  }

  return JSON.stringify({
    month, year,
    matched: matched.length,
    missing: missing.length,
    pending: pending.length,
    matched_items: matched,
    missing_items: missing,
    pending_items: pending,
    summary: `${matched.length} matched, ${missing.length} missing (overdue), ${pending.length} not yet due`,
  })
}

// ── Net worth snapshot ────────────────────────────────────────────────────────

async function snapshotNetWorth(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const [accountsRes, investmentsRes, debtsRes] = await Promise.all([
    supabase.from("bank_accounts").select("name, balance").eq("user_id", userId),
    supabase.from("investments").select("name, balance").eq("user_id", userId),
    supabase.from("debts").select("name, balance").eq("user_id", userId),
  ])

  const accounts = accountsRes.data ?? []
  const investments = investmentsRes.data ?? []
  const debts = debtsRes.data ?? []

  const liquid = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0)
  const invested = investments.reduce((s, i) => s + Number(i.balance ?? 0), 0)
  const assets = liquid + invested
  const liabilities = debts.reduce((s, d) => s + Number(d.balance ?? 0), 0)
  const netWorth = assets - liabilities

  const breakdown = {
    liquid: Math.round(liquid * 100) / 100,
    investments: Math.round(invested * 100) / 100,
    total_debt: Math.round(liabilities * 100) / 100,
    by_account: accounts.map((a) => ({ name: a.name, balance: Number(a.balance ?? 0) })),
    by_investment: investments.map((i) => ({ name: i.name, balance: Number(i.balance ?? 0) })),
    by_debt: debts.map((d) => ({ name: d.name, balance: Number(d.balance ?? 0) })),
  }

  const today = new Date().toISOString().split("T")[0]
  const { error } = await (supabase as any)
    .from("net_worth_snapshots")
    .upsert(
      { user_id: userId, snapshot_date: today, net_worth: Math.round(netWorth * 100) / 100, assets: Math.round(assets * 100) / 100, liabilities: Math.round(liabilities * 100) / 100, breakdown },
      { onConflict: "user_id,snapshot_date" }
    )

  if (error) return `Failed to save snapshot: ${error.message}`
  return `Net worth snapshot saved: $${Math.round(netWorth * 100) / 100} (assets $${Math.round(assets * 100) / 100} — liabilities $${Math.round(liabilities * 100) / 100})`
}

async function getNetWorthHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const limit = Math.min(Number(input.limit ?? 12), 52)
  const { data, error } = await (supabase as any)
    .from("net_worth_snapshots")
    .select("snapshot_date, net_worth, assets, liabilities, breakdown")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: false })
    .limit(limit)

  if (error) return `Failed to retrieve history: ${error.message}`
  if (!data || data.length === 0) return "No net worth snapshots found. Use snapshot_net_worth to start tracking."

  const sorted = [...data].reverse()
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const change = last.net_worth - first.net_worth
  const trend = change >= 0 ? `+$${Math.round(change * 100) / 100}` : `-$${Math.round(Math.abs(change) * 100) / 100}`

  return JSON.stringify({
    snapshots: sorted,
    trend: `${trend} since ${first.snapshot_date}`,
    count: sorted.length,
  })
}

// ── Scenario simulation ───────────────────────────────────────────────────────

async function simulateBudgetChange(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  // Get current income and recurring expenses as baseline
  const [incomeRes, recurringRes, debtsRes] = await Promise.all([
    supabase.from("income_sources").select("amount, frequency").eq("user_id", userId).eq("active", true),
    supabase.from("recurring_expenses").select("name, amount").eq("user_id", userId).eq("active", true),
    supabase.from("debts").select("name, balance, interest_rate, min_payment").eq("user_id", userId),
  ])

  const incomes = incomeRes.data ?? []
  const recurring = recurringRes.data ?? []
  const debts = debtsRes.data ?? []

  // Convert all income to monthly
  const currentMonthlyIncome = incomes.reduce((sum, src) => {
    const amt = Number(src.amount)
    if (src.frequency === "biweekly") return sum + amt * 26 / 12
    if (src.frequency === "weekly") return sum + amt * 52 / 12
    if (src.frequency === "annually") return sum + amt / 12
    return sum + amt // monthly or one-time
  }, 0)

  const currentMonthlyExpenses = recurring.reduce((sum, r) => sum + Number(r.amount), 0)
  const currentCashFlow = currentMonthlyIncome - currentMonthlyExpenses
  const currentSavingsRate = currentMonthlyIncome > 0 ? (currentCashFlow / currentMonthlyIncome) * 100 : 0

  // Apply changes
  const incomeChange = Number(input.income_change ?? 0)
  const expenseChanges = (input.expense_changes as Array<{ category: string; delta: number }>) ?? []
  const extraDebtPayment = Number(input.extra_debt_payment ?? 0)
  const months = Number(input.months_to_project ?? 12)

  const newMonthlyIncome = currentMonthlyIncome + incomeChange
  const totalExpenseDelta = expenseChanges.reduce((sum, c) => sum + c.delta, 0)
  const newMonthlyExpenses = currentMonthlyExpenses + totalExpenseDelta + extraDebtPayment
  const newCashFlow = newMonthlyIncome - newMonthlyExpenses
  const newSavingsRate = newMonthlyIncome > 0 ? (newCashFlow / newMonthlyIncome) * 100 : 0

  // Debt payoff projection for target debt
  let debtPayoffInfo: Record<string, unknown> | null = null
  if (extraDebtPayment > 0 && input.target_debt_name) {
    const targetDebt = debts.find((d) => d.name.toLowerCase().includes((input.target_debt_name as string).toLowerCase()))
    if (targetDebt) {
      const balance = Number(targetDebt.balance)
      const apr = Number(targetDebt.interest_rate ?? 0) / 100 / 12
      const payment = Number(targetDebt.min_payment ?? 0) + extraDebtPayment
      const currentPayment = Number(targetDebt.min_payment ?? 0)

      const calcMonths = (bal: number, pmt: number, rate: number) => {
        if (pmt <= 0) return Infinity
        if (rate === 0) return Math.ceil(bal / pmt)
        return Math.ceil(-Math.log(1 - (bal * rate) / pmt) / Math.log(1 + rate))
      }

      const currentMonthsToPayoff = calcMonths(balance, currentPayment, apr)
      const newMonthsToPayoff = calcMonths(balance, payment, apr)

      debtPayoffInfo = {
        debt_name: targetDebt.name,
        current_payoff_months: isFinite(currentMonthsToPayoff) ? currentMonthsToPayoff : "never (payment too low)",
        new_payoff_months: isFinite(newMonthsToPayoff) ? newMonthsToPayoff : "never",
        months_saved: isFinite(currentMonthsToPayoff) && isFinite(newMonthsToPayoff) ? currentMonthsToPayoff - newMonthsToPayoff : "N/A",
      }
    }
  }

  return JSON.stringify({
    scenario_label: expenseChanges.map((c) => `${c.category} ${c.delta >= 0 ? "+" : ""}$${c.delta}`).join(", ") + (incomeChange !== 0 ? `, income ${incomeChange >= 0 ? "+" : ""}$${incomeChange}` : ""),
    current: {
      monthly_income: Math.round(currentMonthlyIncome * 100) / 100,
      monthly_expenses: Math.round(currentMonthlyExpenses * 100) / 100,
      cash_flow: Math.round(currentCashFlow * 100) / 100,
      savings_rate_pct: Math.round(currentSavingsRate * 10) / 10,
    },
    projected: {
      monthly_income: Math.round(newMonthlyIncome * 100) / 100,
      monthly_expenses: Math.round(newMonthlyExpenses * 100) / 100,
      cash_flow: Math.round(newCashFlow * 100) / 100,
      savings_rate_pct: Math.round(newSavingsRate * 10) / 10,
      cash_flow_change: Math.round((newCashFlow - currentCashFlow) * 100) / 100,
      over_months: Math.round(newCashFlow * months * 100) / 100,
    },
    expense_changes: expenseChanges,
    debt_payoff: debtPayoffInfo,
    months_projected: months,
  })
}

// ── Withholding calculator ────────────────────────────────────────────────────

async function calculateWithholdingAdjustment(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const paychecksRemaining = Number(input.paychecks_remaining)
  const currentWithholdingPerCheck = Number(input.current_withholding_per_check)
  const filingStatus = (input.filing_status as string) ?? "single"
  const targetRefund = Number(input.target_refund ?? 0)

  let grossIncome = 0
  let totalWithheld = 0

  if (input.use_stored_tax_data !== false) {
    const { data: taxItems } = await supabase.from("tax_items").select("*").eq("user_id", userId)
    for (const item of taxItems ?? []) {
      if (item.type === "income") grossIncome += Number(item.amount)
      if (item.type === "payment" && (item.category === "federal" || (item.form_source ?? "").includes("W-2"))) {
        totalWithheld += Number(item.amount)
      }
    }
  }

  if (input.override_gross_income != null) grossIncome = Number(input.override_gross_income)
  if (input.override_total_withheld != null) totalWithheld = Number(input.override_total_withheld)

  if (grossIncome === 0) return "Could not determine gross income. Please provide override_gross_income or ensure tax items are recorded with type='income'."

  // 2025 federal tax brackets (standard deduction already applied concept)
  const standardDeduction = filingStatus === "married_jointly" ? 30000 : 15000
  const taxableIncome = Math.max(0, grossIncome - standardDeduction)

  // 2025 single brackets
  const brackets2025Single = [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ]
  const brackets2025MFJ = [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 },
  ]

  const brackets = filingStatus === "married_jointly" ? brackets2025MFJ : brackets2025Single

  let estimatedTax = 0
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break
    const taxable = Math.min(taxableIncome, bracket.max) - bracket.min
    estimatedTax += taxable * bracket.rate
  }

  const gap = estimatedTax - totalWithheld + targetRefund
  const additionalPerCheck = paychecksRemaining > 0 ? gap / paychecksRemaining : 0

  const recommendation = additionalPerCheck > 0
    ? `Increase federal withholding by $${Math.ceil(additionalPerCheck)} per paycheck to ${targetRefund > 0 ? `get a $${targetRefund} refund` : "break even"}.`
    : additionalPerCheck < 0
    ? `You are over-withheld by $${Math.round(Math.abs(gap))} — expect a refund of approximately $${Math.round(Math.abs(gap) - targetRefund)} at current pace.`
    : "Your withholding is on track to break even."

  return JSON.stringify({
    gross_income_ytd: Math.round(grossIncome * 100) / 100,
    standard_deduction: standardDeduction,
    taxable_income: Math.round(taxableIncome * 100) / 100,
    estimated_tax_liability: Math.round(estimatedTax * 100) / 100,
    total_withheld_ytd: Math.round(totalWithheld * 100) / 100,
    gap: Math.round(gap * 100) / 100,
    paychecks_remaining: paychecksRemaining,
    additional_per_check: Math.ceil(additionalPerCheck * 100) / 100,
    recommendation,
    note: "Uses 2025 federal brackets + standard deduction. Does not include FICA, state, or itemized deductions.",
  })
}

// ── Alerts ────────────────────────────────────────────────────────────────────

async function createAlert(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const type = String(input.type ?? "custom")
  const title = String(input.title ?? "").trim().slice(0, 60)
  const message = String(input.message ?? "").trim()
  const severity = String(input.severity ?? "info")
  const dueDate = (input.due_date as string) ?? null
  const expiresAt = (input.expires_at as string) ?? null

  if (!title || !message) return "Title and message are required."

  // Check for recent duplicate of same type (within 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: existing } = await (supabase as any)
    .from("alerts")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("is_read", false)
    .gte("created_at", oneDayAgo)
    .limit(1)

  if (existing && existing.length > 0) {
    return `Alert of type "${type}" already exists from the last 24 hours (ID: ${existing[0].id}). Use dismiss_alert first or update the existing one.`
  }

  const { data, error } = await (supabase as any)
    .from("alerts")
    .insert({ user_id: userId, type, title, message, severity, is_read: false, due_date: dueDate, expires_at: expiresAt })
    .select()
    .single()

  if (error || !data) return `Failed to create alert: ${error?.message}`
  return `Alert created: [${severity.toUpperCase()}] "${title}" — ID: ${data.id}`
}

async function getAlerts(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const includeRead = Boolean(input.include_read ?? false)
  const now = new Date().toISOString()

  let q = (supabase as any)
    .from("alerts")
    .select("*")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(20)

  if (!includeRead) q = q.eq("is_read", false)

  const { data, error } = await q
  if (error) return `Failed to get alerts: ${error.message}`
  if (!data || data.length === 0) return "No active alerts."

  return JSON.stringify({ count: data.length, alerts: data })
}

async function dismissAlert(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const alertId = String(input.alert_id ?? "")
  if (!alertId) return "alert_id is required."

  const { error } = await (supabase as any)
    .from("alerts")
    .update({ is_read: true })
    .eq("id", alertId)
    .eq("user_id", userId)

  if (error) return `Failed to dismiss alert: ${error.message}`
  return `Alert ${alertId} dismissed.`
}

// ── Goals ─────────────────────────────────────────────────────────────────────

async function upsertGoal(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const title = String(input.title ?? "").trim()
  if (!title) return "Title is required."

  const payload = {
    user_id: userId,
    title,
    description: input.description ? String(input.description).trim() : null,
    category: String(input.category ?? "Financial"),
    goal_type: String(input.goal_type ?? "increase"),
    target_amount: input.target_amount != null ? Number(input.target_amount) : null,
    current_amount: input.current_amount != null ? Number(input.current_amount) : 0,
    target_date: input.target_date ? String(input.target_date) : null,
    status: String(input.status ?? "active"),
    priority: String(input.priority ?? "medium"),
    updated_at: new Date().toISOString(),
  }

  const goalId = input.goal_id ? String(input.goal_id) : null

  if (goalId) {
    const { data, error } = await (supabase as any)
      .from("goals").update(payload).eq("id", goalId).eq("user_id", userId).select().single()
    if (error || !data) return `Failed to update goal: ${error?.message ?? "not found"}`
    return `Goal updated: "${data.title}" — ${data.status}, ${data.category}`
  } else {
    const { data, error } = await (supabase as any)
      .from("goals").insert(payload).select().single()
    if (error || !data) return `Failed to create goal: ${error?.message}`
    return `Goal created: "${data.title}" — ID: ${data.id}, priority: ${data.priority}`
  }
}

// ── Dev requests ──────────────────────────────────────────────────────────────

async function createDevRequest(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const title = String(input.title ?? "").trim()
  const description = String(input.description ?? "").trim()
  if (!title || !description) return "Title and description are required."

  const validCategories = ["bug", "improvement", "feature", "question"]
  const validPriorities = ["high", "medium", "low"]
  const category = validCategories.includes(String(input.category)) ? String(input.category) : "improvement"
  const priority = validPriorities.includes(String(input.priority)) ? String(input.priority) : "medium"

  const { data, error } = await (supabase as any)
    .from("dev_requests")
    .insert({
      user_id: userId,
      title,
      description,
      category,
      priority,
      context: input.context ? String(input.context).slice(0, 500) : null,
      status: "open",
    })
    .select()
    .single()

  if (error || !data) return `Failed to log dev request: ${error?.message}`
  return `Dev request logged: "${data.title}" [${data.category}, ${data.priority} priority] — ID: ${data.id}. This will appear on the Goals page for the user to bring to Claude Code.`
}

// ── Usage insights ─────────────────────────────────────────────────────────────

async function getUsageInsights(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const days = Math.min(Number(input.days ?? 30), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await (supabase as any)
    .from("usage_events")
    .select("event_type, page, feature, created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return `Failed to get usage data: ${error.message}`
  if (!data || data.length === 0) return `No usage data in the last ${days} days yet. Usage tracking will accumulate as the user navigates the app.`

  // Aggregate page visits
  const pageCounts: Record<string, number> = {}
  const featureCounts: Record<string, number> = {}
  let lastVisit = ""

  for (const event of data) {
    if (event.page) pageCounts[event.page] = (pageCounts[event.page] ?? 0) + 1
    if (event.feature) featureCounts[event.feature] = (featureCounts[event.feature] ?? 0) + 1
    if (!lastVisit) lastVisit = event.created_at
  }

  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([page, count]) => `${page}: ${count} visits`)

  const topFeatures = Object.entries(featureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([feature, count]) => `${feature}: ${count} uses`)

  return JSON.stringify({
    period_days: days,
    total_events: data.length,
    last_activity: lastVisit,
    most_visited_pages: topPages,
    most_used_features: topFeatures,
  })
}

// ── Delete record ─────────────────────────────────────────────────────────────

const ALLOWED_DELETE_TABLES = [
  "transactions", "debts", "bank_accounts", "recurring_expenses",
  "insurance_policies", "investments", "budgets", "credit_accounts",
  "tax_items", "income_sources", "business_engagements", "calendar_events",
  "grocery_items", "goals", "dev_requests",
  "weight_logs", "exercise_logs", "shared_list_items", "shared_lists", "shared_responsibilities",
]

// Tables that don't have a user_id column (shared household data)
const SHARED_TABLES = ["grocery_items", "cleaning_duties", "shared_list_items", "shared_lists"]

async function deleteRecord(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const table = String(input.table ?? "").trim()
  const id = String(input.id ?? "").trim()

  if (!ALLOWED_DELETE_TABLES.includes(table)) {
    return `Error: "${table}" is not a deletable table. Allowed: ${ALLOWED_DELETE_TABLES.join(", ")}`
  }
  if (!id) return "Error: id is required."

  let query = (supabase as any).from(table).delete().eq("id", id)
  if (!SHARED_TABLES.includes(table)) query = query.eq("user_id", userId)

  const { error } = await query
  if (error) return `Failed to delete from ${table}: ${error.message}`

  // Log audit event
  const { insertAuditLog } = await import("@/lib/audit")
  await insertAuditLog({
    userId,
    action: "record_deleted",
    targetTable: table,
    targetId: id,
    details: { input },
  })

  return `Deleted record ${id} from ${table}.`
}

// ── Update calendar event ─────────────────────────────────────────────────────

async function updateCalendarEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const eventId = String(input.event_id ?? "").trim()
  if (!eventId) return "Error: event_id is required."

  const updates: Record<string, unknown> = {}
  if (input.title !== undefined) updates.title = String(input.title)
  if (input.start_at !== undefined) updates.start_at = String(input.start_at)
  if (input.end_at !== undefined) updates.end_at = String(input.end_at)
  if (input.description !== undefined) updates.description = String(input.description)
  if (input.all_day !== undefined) updates.all_day = Boolean(input.all_day)

  if (Object.keys(updates).length === 0) return "No fields provided to update."

  const { data, error } = await supabase
    .from("calendar_events")
    .update(updates as never)
    .eq("id", eventId)
    .eq("user_id", userId)
    .eq("source", "homebase")
    .select()
    .single()

  if (error || !data) return `Failed to update event: ${error?.message ?? "not found or not a Mita event (can't edit Google/shared list events)"}`
  return `Event updated: "${data.title}" on ${new Date(data.start_at).toLocaleDateString()}`
}

// ── Toggle shopping item ──────────────────────────────────────────────────────

async function toggleShoppingItem(
  supabase: SupabaseClient<Database>,
  input: Record<string, unknown>
): Promise<string> {
  const itemId = String(input.item_id ?? "").trim()
  if (!itemId) return "Error: item_id is required."

  const checked = Boolean(input.checked)
  const moveToPantry = Boolean(input.move_to_pantry)

  const updates: Record<string, unknown> = { checked }
  if (moveToPantry) updates.in_pantry = true

  const { data, error } = await supabase
    .from("grocery_items")
    .update(updates as never)
    .eq("id", itemId)
    .select()
    .single()

  if (error || !data) return `Failed to update item: ${error?.message ?? "not found"}`
  const status = checked ? "checked off" : "unchecked"
  const pantryNote = moveToPantry ? " and moved to pantry" : ""
  return `"${data.name}" ${status}${pantryNote}.`
}

// ── Complete cleaning duty ────────────────────────────────────────────────────

async function completeCleaningDuty(
  supabase: SupabaseClient<Database>,
  input: Record<string, unknown>
): Promise<string> {
  const dutyId = String(input.duty_id ?? "").trim()
  if (!dutyId) return "Error: duty_id is required."

  const { data: duty, error: fetchError } = await supabase
    .from("cleaning_duties")
    .select("id, name, frequency")
    .eq("id", dutyId)
    .single()

  if (fetchError || !duty) return `Failed to find cleaning duty: ${fetchError?.message ?? "not found"}`

  const now = new Date()
  const nextDue = new Date(now)
  const freq = (duty.frequency ?? "").toLowerCase()

  if (freq === "daily") nextDue.setDate(nextDue.getDate() + 1)
  else if (freq === "every other day") nextDue.setDate(nextDue.getDate() + 2)
  else if (freq === "weekly") nextDue.setDate(nextDue.getDate() + 7)
  else if (freq === "biweekly" || freq === "every 2 weeks") nextDue.setDate(nextDue.getDate() + 14)
  else if (freq === "monthly") nextDue.setMonth(nextDue.getMonth() + 1)
  else if (freq === "quarterly") nextDue.setMonth(nextDue.getMonth() + 3)
  else if (freq === "annually" || freq === "yearly") nextDue.setFullYear(nextDue.getFullYear() + 1)
  else nextDue.setDate(nextDue.getDate() + 7) // default weekly

  const nextDueStr = nextDue.toISOString().split("T")[0]

  const { error } = await supabase
    .from("cleaning_duties")
    .update({ last_completed: now.toISOString(), next_due: nextDueStr } as never)
    .eq("id", dutyId)

  if (error) return `Failed to mark duty complete: ${error.message}`
  return `"${duty.name}" marked complete. Next due: ${nextDueStr}.`
}

// ── Shared finances ───────────────────────────────────────────────────────────

async function getSharedFinances(
  supabase: SupabaseClient<Database>,
  userId: string,
  _input: Record<string, unknown>
): Promise<string> {
  const [accountsRes, responsibilitiesRes, profilesRes] = await Promise.all([
    (supabase as any).from("bank_accounts").select("id, name, balance, currency").eq("is_shared", true),
    (supabase as any).from("shared_responsibilities").select("account_id, user_id, percentage"),
    supabase.from("profiles").select("id, full_name"),
  ])

  const profiles = new Map((profilesRes.data ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "Unknown"]))
  const accounts = accountsRes.data ?? []
  const responsibilities = responsibilitiesRes.data ?? []

  if (accounts.length === 0) return "No shared accounts found. Mark a bank account as shared (is_shared=true) to start tracking shared finances."

  // Get recent transactions for shared accounts
  const accountIds = accounts.map((a: { id: string }) => a.id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const { data: txData } = await supabase
    .from("transactions")
    .select("date, type, amount, description, category, account_id")
    .in("account_id", accountIds)
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: false })
    .limit(30)

  const lines: string[] = ["## Shared Accounts"]
  for (const a of accounts) {
    lines.push(`\n### ${a.name}: $${Number(a.balance).toFixed(2)} ${a.currency}`)
    const splits = responsibilities.filter((r: { account_id: string }) => r.account_id === a.id)
    if (splits.length) {
      for (const s of splits) {
        const name = profiles.get(s.user_id) ?? s.user_id
        lines.push(`- ${name}: ${s.percentage}%`)
      }
    } else {
      lines.push("- No responsibility splits set")
    }
    const acctTx = (txData ?? []).filter((t) => t.account_id === a.id)
    if (acctTx.length) {
      lines.push(`\nRecent transactions:`)
      for (const t of acctTx.slice(0, 10)) {
        const sign = t.type === "income" ? "+" : "-"
        lines.push(`- ${t.date}: ${sign}$${t.amount.toFixed(2)} ${t.description}${t.category ? ` [${t.category}]` : ""}`)
      }
    }
  }
  return lines.join("\n")
}

// ── Update shared responsibility ──────────────────────────────────────────────

async function updateSharedResponsibility(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const accountId = String(input.account_id ?? "").trim()
  const targetUserId = String(input.user_id ?? "").trim()
  const percentage = Number(input.percentage ?? 0)

  if (!accountId) return "Error: account_id is required."
  if (!targetUserId) return "Error: user_id is required."
  if (percentage < 0 || percentage > 100) return "Error: percentage must be between 0 and 100."

  const { error } = await (supabase as any)
    .from("shared_responsibilities")
    .upsert(
      { account_id: accountId, user_id: targetUserId, percentage },
      { onConflict: "account_id,user_id" }
    )

  if (error) return `Failed to update responsibility: ${error.message}`

  const { insertAuditLog } = await import("@/lib/audit")
  await insertAuditLog({
    userId,
    action: "shared_responsibility_updated",
    targetTable: "shared_responsibilities",
    details: { account_id: accountId, target_user_id: targetUserId, percentage },
  })

  return `Set ${percentage}% responsibility for user ${targetUserId} on account ${accountId}.`
}

// ── Log weight ────────────────────────────────────────────────────────────────

async function logWeight(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const weight = Number(input.weight)
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) return "Error: Invalid weight value."

  const date = String(input.date ?? new Date().toISOString().split("T")[0])
  const notes = input.notes ? String(input.notes) : null

  const { data, error } = await (supabase as any)
    .from("weight_logs")
    .upsert(
      { user_id: userId, weight, date, notes },
      { onConflict: "user_id,date" }
    )
    .select()
    .single()

  if (error) return `Failed to log weight: ${error.message}`

  const { insertAuditLog } = await import("@/lib/audit")
  await insertAuditLog({
    userId,
    action: "weight_logged",
    targetTable: "weight_logs",
    targetId: data.id,
    details: { weight, date },
  })

  return `Logged ${weight} lbs for ${date}.`
}

// ── Log exercise ──────────────────────────────────────────────────────────────

async function logExercise(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const exerciseType = String(input.type ?? "").trim()
  if (!exerciseType) return "Error: exercise type is required."

  const date = String(input.date ?? new Date().toISOString().split("T")[0])
  const row: Record<string, unknown> = {
    user_id: userId,
    type: exerciseType,
    date,
  }
  if (input.duration_minutes != null) row.duration_minutes = Number(input.duration_minutes)
  if (input.distance != null) row.distance = Number(input.distance)
  if (input.calories != null) row.calories = Number(input.calories)
  if (input.notes) row.notes = String(input.notes)

  const { data, error } = await (supabase as any)
    .from("exercise_logs")
    .insert(row)
    .select()
    .single()

  if (error) return `Failed to log exercise: ${error.message}`

  const { insertAuditLog } = await import("@/lib/audit")
  await insertAuditLog({
    userId,
    action: "exercise_logged",
    targetTable: "exercise_logs",
    targetId: data.id,
    details: { type: exerciseType, duration_minutes: row.duration_minutes, date },
  })

  const parts = [`Logged ${exerciseType} for ${date}`]
  if (row.duration_minutes) parts.push(`${row.duration_minutes} min`)
  if (row.distance) parts.push(`${row.distance} mi`)
  if (row.calories) parts.push(`${row.calories} cal`)
  return parts.join(" — ") + "."
}

// ── Get health data ───────────────────────────────────────────────────────────

async function getHealthData(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const days = Math.min(Number(input.days ?? 30), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const filterUser = input.user_id ? String(input.user_id) : null

  let weightQuery = (supabase as any)
    .from("weight_logs")
    .select("user_id, weight, date, notes")
    .gte("date", since)
    .order("date", { ascending: false })
    .limit(60)

  let exerciseQuery = (supabase as any)
    .from("exercise_logs")
    .select("user_id, type, duration_minutes, distance, calories, date, notes")
    .gte("date", since)
    .order("date", { ascending: false })
    .limit(60)

  if (filterUser) {
    weightQuery = weightQuery.eq("user_id", filterUser)
    exerciseQuery = exerciseQuery.eq("user_id", filterUser)
  }

  const [weightRes, exerciseRes, profilesRes] = await Promise.all([
    weightQuery,
    exerciseQuery,
    supabase.from("profiles").select("id, full_name"),
  ])

  const profiles = new Map((profilesRes.data ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "Unknown"]))
  const weights = weightRes.data ?? []
  const exercises = exerciseRes.data ?? []

  const lines: string[] = [`## Health Data (last ${days} days)`]

  if (weights.length) {
    lines.push("\n### Weight Log")
    // Show latest per user
    const latestByUser = new Map<string, { weight: number; date: string }>()
    for (const w of weights) {
      if (!latestByUser.has(w.user_id)) latestByUser.set(w.user_id, { weight: w.weight, date: w.date })
    }
    for (const [uid, latest] of latestByUser) {
      lines.push(`**${profiles.get(uid) ?? uid}**: ${latest.weight} lbs (as of ${latest.date})`)
    }
    lines.push("\nAll entries:")
    for (const w of weights) {
      const name = profiles.get(w.user_id) ?? w.user_id
      lines.push(`- ${w.date}: ${name} — ${w.weight} lbs${w.notes ? ` (${w.notes})` : ""}`)
    }
  } else {
    lines.push("\nNo weight entries found.")
  }

  if (exercises.length) {
    lines.push("\n### Exercise Log")
    const totalByType: Record<string, number> = {}
    for (const e of exercises) {
      totalByType[e.type] = (totalByType[e.type] ?? 0) + 1
    }
    lines.push(`Summary: ${Object.entries(totalByType).map(([t, c]) => `${t} x${c}`).join(", ")}`)
    lines.push("\nRecent:")
    for (const e of exercises.slice(0, 20)) {
      const name = profiles.get(e.user_id) ?? e.user_id
      const parts = [e.type]
      if (e.duration_minutes) parts.push(`${e.duration_minutes} min`)
      if (e.distance) parts.push(`${e.distance} mi`)
      if (e.calories) parts.push(`${e.calories} cal`)
      lines.push(`- ${e.date}: ${name} — ${parts.join(", ")}${e.notes ? ` (${e.notes})` : ""}`)
    }
  } else {
    lines.push("\nNo exercise entries found.")
  }

  return lines.join("\n")
}

// ── Send household message ────────────────────────────────────────────────────

async function sendHouseholdMessage(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const content = String(input.content ?? "").trim()
  if (!content) return "Error: message content is required."
  if (content.length > 2000) return "Error: message too long (max 2000 chars)."

  const { data, error } = await (supabase as any)
    .from("household_messages")
    .insert({ sender_id: userId, content })
    .select()
    .single()

  if (error) return `Failed to send message: ${error.message}`

  const { insertAuditLog } = await import("@/lib/audit")
  await insertAuditLog({
    userId,
    action: "household_message_sent",
    targetTable: "household_messages",
    targetId: data.id,
    details: { content_preview: content.slice(0, 50) },
  })

  return `Message sent.`
}

// ── Manage shared list ────────────────────────────────────────────────────────

async function manageSharedList(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const action = String(input.action ?? "").trim()
  const { insertAuditLog } = await import("@/lib/audit")

  switch (action) {
    case "create": {
      const name = String(input.name ?? "").trim()
      if (!name) return "Error: name is required for create."

      const { data, error } = await (supabase as any)
        .from("shared_lists")
        .insert({ name, created_by: userId })
        .select()
        .single()

      if (error) return `Failed to create list: ${error.message}`
      await insertAuditLog({
        userId,
        action: "shared_list_created",
        targetTable: "shared_lists",
        targetId: data.id,
        details: { name },
      })
      return `Created shared list "${name}" [id: ${data.id}].`
    }
    case "update": {
      const id = String(input.id ?? "").trim()
      if (!id) return "Error: id is required for update."
      const updates: Record<string, unknown> = {}
      if (input.name) updates.name = String(input.name)
      if (Object.keys(updates).length === 0) return "No fields to update."

      const { data, error } = await (supabase as any)
        .from("shared_lists")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) return `Failed to update list: ${error.message}`
      await insertAuditLog({
        userId,
        action: "shared_list_updated",
        targetTable: "shared_lists",
        targetId: id,
        details: updates,
      })
      return `Updated list "${data.name}".`
    }
    case "delete": {
      const id = String(input.id ?? "").trim()
      if (!id) return "Error: id is required for delete."

      const { error } = await (supabase as any)
        .from("shared_lists")
        .delete()
        .eq("id", id)

      if (error) return `Failed to delete list: ${error.message}`
      await insertAuditLog({
        userId,
        action: "shared_list_deleted",
        targetTable: "shared_lists",
        targetId: id,
        details: {},
      })
      return `Deleted shared list ${id}.`
    }
    default:
      return `Error: invalid action "${action}". Use create, update, or delete.`
  }
}

// ── Manage shared list item ───────────────────────────────────────────────────

async function manageSharedListItem(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const action = String(input.action ?? "").trim()
  const { insertAuditLog } = await import("@/lib/audit")

  switch (action) {
    case "add": {
      const listId = String(input.list_id ?? "").trim()
      const title = String(input.title ?? "").trim()
      if (!listId) return "Error: list_id is required for add."
      if (!title) return "Error: title is required for add."

      const row: Record<string, unknown> = { list_id: listId, title, created_by: userId }
      if (input.due_date) row.due_date = String(input.due_date)
      if (input.assigned_to) row.assigned_to = String(input.assigned_to)

      const { data, error } = await (supabase as any)
        .from("shared_list_items")
        .insert(row)
        .select()
        .single()

      if (error) return `Failed to add item: ${error.message}`
      await insertAuditLog({
        userId,
        action: "shared_list_item_added",
        targetTable: "shared_list_items",
        targetId: data.id,
        details: { list_id: listId, title },
      })
      return `Added "${title}" to list [item id: ${data.id}].`
    }
    case "update": {
      const id = String(input.id ?? "").trim()
      if (!id) return "Error: id is required for update."
      const updates: Record<string, unknown> = {}
      if (input.title !== undefined) updates.title = String(input.title)
      if (input.due_date !== undefined) updates.due_date = input.due_date ? String(input.due_date) : null
      if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to ? String(input.assigned_to) : null
      if (Object.keys(updates).length === 0) return "No fields to update."

      const { data, error } = await (supabase as any)
        .from("shared_list_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) return `Failed to update item: ${error.message}`
      await insertAuditLog({
        userId,
        action: "shared_list_item_updated",
        targetTable: "shared_list_items",
        targetId: id,
        details: updates,
      })
      return `Updated item "${data.title}".`
    }
    case "check": {
      const id = String(input.id ?? "").trim()
      if (!id) return "Error: id is required for check."
      const { data, error } = await (supabase as any)
        .from("shared_list_items")
        .update({ checked: true })
        .eq("id", id)
        .select()
        .single()

      if (error) return `Failed to check item: ${error.message}`
      await insertAuditLog({
        userId,
        action: "shared_list_item_checked",
        targetTable: "shared_list_items",
        targetId: id,
        details: {},
      })
      return `Checked off "${data.title}".`
    }
    case "uncheck": {
      const id = String(input.id ?? "").trim()
      if (!id) return "Error: id is required for uncheck."
      const { data, error } = await (supabase as any)
        .from("shared_list_items")
        .update({ checked: false })
        .eq("id", id)
        .select()
        .single()

      if (error) return `Failed to uncheck item: ${error.message}`
      await insertAuditLog({
        userId,
        action: "shared_list_item_unchecked",
        targetTable: "shared_list_items",
        targetId: id,
        details: {},
      })
      return `Unchecked "${data.title}".`
    }
    case "delete": {
      const id = String(input.id ?? "").trim()
      if (!id) return "Error: id is required for delete."
      const { error } = await (supabase as any)
        .from("shared_list_items")
        .delete()
        .eq("id", id)

      if (error) return `Failed to delete item: ${error.message}`
      await insertAuditLog({
        userId,
        action: "shared_list_item_deleted",
        targetTable: "shared_list_items",
        targetId: id,
        details: {},
      })
      return `Deleted item ${id}.`
    }
    default:
      return `Error: invalid action "${action}". Use add, update, check, uncheck, or delete.`
  }
}
