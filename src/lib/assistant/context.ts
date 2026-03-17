import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export async function buildContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
  const sevenDaysOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]

  const [
    profilesRes,
    accountsRes,
    txThisMonthRes,
    budgetsRes,
    debtsRes,
    groceryRes,
    cleaningRes,
    calendarRes,
    incomeRes,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, id"),
    supabase.from("bank_accounts").select("name, balance, currency"),
    supabase
      .from("transactions")
      .select("type, amount, category, description, date")
      .gte("date", monthStart)
      .order("date", { ascending: false })
      .limit(50),
    supabase
      .from("budgets")
      .select("category, monthly_limit")
      .eq("year", year)
      .eq("month", month),
    supabase.from("debts").select("name, balance, interest_rate, min_payment"),
    supabase
      .from("grocery_items")
      .select("name, quantity, unit, low_threshold, in_pantry"),
    supabase
      .from("cleaning_duties")
      .select("name, frequency, last_completed, next_due, assigned_to")
      .order("next_due", { ascending: true }),
    supabase
      .from("calendar_events")
      .select("title, start_at, end_at, source, description")
      .gte("start_at", today.toISOString().split("T")[0])
      .lte("start_at", sevenDaysOut)
      .order("start_at", { ascending: true }),
    supabase
      .from("income_sources")
      .select("name, amount, frequency")
      .eq("active", true),
  ])

  const lines: string[] = [
    `Today: ${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    "",
  ]

  // Household members
  if (profilesRes.data?.length) {
    lines.push(
      `Household members: ${profilesRes.data.map((p) => p.full_name || "Unknown").join(", ")}`
    )
    lines.push("")
  }

  // Bank accounts
  if (accountsRes.data?.length) {
    lines.push("## Bank Accounts")
    for (const a of accountsRes.data) {
      lines.push(`- ${a.name}: $${a.balance.toFixed(2)} ${a.currency}`)
    }
    const total = accountsRes.data.reduce((s, a) => s + a.balance, 0)
    lines.push(`Total liquid: $${total.toFixed(2)}`)
    lines.push("")
  }

  // Income sources
  if (incomeRes.data?.length) {
    lines.push("## Active Income")
    for (const i of incomeRes.data) {
      lines.push(`- ${i.name}: $${i.amount.toFixed(2)} (${i.frequency})`)
    }
    lines.push("")
  }

  // This month's spending
  if (txThisMonthRes.data?.length) {
    const income = txThisMonthRes.data
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0)
    const expenses = txThisMonthRes.data
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0)
    const byCategory: Record<string, number> = {}
    for (const t of txThisMonthRes.data.filter((t) => t.type === "expense")) {
      const cat = t.category || "Uncategorized"
      byCategory[cat] = (byCategory[cat] ?? 0) + t.amount
    }
    lines.push(
      `## This Month (${today.toLocaleString("en-US", { month: "long" })})`
    )
    lines.push(`Income: $${income.toFixed(2)} | Expenses: $${expenses.toFixed(2)} | Net: $${(income - expenses).toFixed(2)}`)
    if (Object.keys(byCategory).length) {
      const topCats = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      lines.push(
        `Top spending: ${topCats.map(([c, a]) => `${c} $${a.toFixed(0)}`).join(", ")}`
      )
    }
    lines.push("")
  }

  // Budgets
  if (budgetsRes.data?.length && txThisMonthRes.data?.length) {
    lines.push("## Budget Status")
    for (const b of budgetsRes.data) {
      const spent = txThisMonthRes.data
        .filter((t) => t.type === "expense" && t.category === b.category)
        .reduce((s, t) => s + t.amount, 0)
      const pct = Math.round((spent / b.monthly_limit) * 100)
      const flag = pct >= 90 ? " ⚠️ OVER" : pct >= 75 ? " (75%+)" : ""
      lines.push(
        `- ${b.category}: $${spent.toFixed(0)} / $${b.monthly_limit.toFixed(0)}${flag}`
      )
    }
    lines.push("")
  }

  // Debts
  if (debtsRes.data?.length) {
    lines.push("## Debts")
    const total = debtsRes.data.reduce((s, d) => s + d.balance, 0)
    for (const d of debtsRes.data) {
      const rate = d.interest_rate ? ` @ ${d.interest_rate}%` : ""
      lines.push(`- ${d.name}: $${d.balance.toFixed(2)}${rate}`)
    }
    lines.push(`Total debt: $${total.toFixed(2)}`)
    lines.push("")
  }

  // Grocery & pantry
  if (groceryRes.data?.length) {
    const shopping = groceryRes.data.filter((g) => !g.in_pantry)
    const lowStock = groceryRes.data.filter(
      (g) =>
        g.in_pantry &&
        g.low_threshold !== null &&
        g.quantity <= (g.low_threshold ?? 0)
    )
    if (shopping.length) {
      lines.push(`Shopping list: ${shopping.length} items — ${shopping.slice(0, 5).map((g) => g.name).join(", ")}${shopping.length > 5 ? "..." : ""}`)
    }
    if (lowStock.length) {
      lines.push(
        `Low stock: ${lowStock.map((g) => g.name).join(", ")}`
      )
    }
    if (shopping.length || lowStock.length) lines.push("")
  }

  // Cleaning duties
  if (cleaningRes.data?.length) {
    const overdue = cleaningRes.data.filter(
      (c) => c.next_due && c.next_due < today.toISOString().split("T")[0]
    )
    const upcoming = cleaningRes.data.filter(
      (c) =>
        c.next_due &&
        c.next_due >= today.toISOString().split("T")[0] &&
        c.next_due <= sevenDaysOut
    )
    if (overdue.length) {
      lines.push(`Overdue cleaning: ${overdue.map((c) => c.name).join(", ")}`)
    }
    if (upcoming.length) {
      lines.push(
        `Cleaning due this week: ${upcoming.map((c) => `${c.name} (${c.next_due})`).join(", ")}`
      )
    }
    if (overdue.length || upcoming.length) lines.push("")
  }

  // Upcoming calendar
  if (calendarRes.data?.length) {
    lines.push("## Upcoming Events (7 days)")
    for (const e of calendarRes.data) {
      const date = new Date(e.start_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      lines.push(`- ${date}: ${e.title} [${e.source}]`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
