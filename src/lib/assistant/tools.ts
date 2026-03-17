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
      "Get calendar events for a date range. Returns HomeBase events and synced Asana tasks.",
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
      },
      required: ["type", "amount", "description"],
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
    name: "add_calendar_event",
    description:
      "Add a new event to the HomeBase calendar.",
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

// ── Tool executor ─────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient<Database>,
  userId: string
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

      case "add_to_shopping_list":
        return await addToShoppingList(supabase, input)

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

  const [accountsRes, txRes, budgetsRes, debtsRes, incomeRes] =
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
    ])

  return JSON.stringify({
    accounts: accountsRes.data ?? [],
    transactions: txRes.data ?? [],
    budgets: budgetsRes.data ?? [],
    debts: debtsRes.data ?? [],
    income_sources: incomeRes.data ?? [],
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
  const { error, data } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: input.type as string,
      amount: Number(input.amount),
      description: input.description as string,
      category: (input.category as string) ?? null,
      date:
        (input.date as string) ?? new Date().toISOString().split("T")[0],
    })
    .select()
    .single()

  if (error) return `Failed to log transaction: ${error.message}`
  return `Transaction logged successfully: ${data.type} $${data.amount} — ${data.description} (${data.date})`
}

async function addToShoppingList(
  supabase: SupabaseClient<Database>,
  input: Record<string, unknown>
): Promise<string> {
  type ItemInput = { name: string; quantity?: number; unit?: string; category?: string }
  const items = input.items as ItemInput[]

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
