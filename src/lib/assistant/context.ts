import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Per-instance cache (ephemeral on Vercel — new instance = fresh cache)
const contextCache = new Map<string, { text: string; expiresAt: number }>()
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

export async function buildContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const cached = contextCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.text
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
  const sevenDaysOutDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const sevenDaysOut = sevenDaysOutDate.toISOString().split("T")[0]

  const [
    profilesRes,
    accountsRes,
    txThisMonthRes,
    recentTxRes,
    budgetsRes,
    debtsRes,
    groceryRes,
    cleaningRes,
    calendarRes,
    incomeRes,
    investmentsRes,
    insuranceRes,
    recurringRes,
    taxRes,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, id"),
    supabase.from("bank_accounts").select("id, name, balance, currency"),
    supabase
      .from("transactions")
      .select("type, amount, category, description, date")
      .gte("date", monthStart)
      .order("date", { ascending: false })
      .limit(100),
    // Last 15 individual transactions for cross-referencing
    supabase
      .from("transactions")
      .select("type, amount, category, description, date")
      .order("date", { ascending: false })
      .limit(15),
    supabase
      .from("budgets")
      .select("category, monthly_limit")
      .eq("year", year)
      .eq("month", month),
    supabase.from("debts").select("name, balance, interest_rate, min_payment"),
    supabase
      .from("grocery_items")
      .select("name, quantity, unit, low_threshold, in_pantry, category, expiry_date"),
    supabase
      .from("cleaning_duties")
      .select("name, frequency, last_completed, next_due, assigned_to, room")
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
    supabase
      .from("investments")
      .select("name, account_type, balance, gain_loss, rate_of_return")
      .order("balance", { ascending: false }),
    supabase
      .from("insurance_policies")
      .select("name, type, provider, premium, renewal_date"),
    supabase
      .from("recurring_expenses")
      .select("name, amount, category, frequency, billing_day, auto_pay, active")
      .eq("active", true),
    supabase
      .from("tax_items")
      .select("name, amount, type, tax_year, filed, due_date")
      .eq("tax_year", year),
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
    lines.push("## Bank Accounts (use account_id when logging transactions)")
    for (const a of accountsRes.data) {
      lines.push(`- ${a.name}: $${a.balance.toFixed(2)} ${a.currency} [account_id: ${a.id}]`)
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

  // Investments
  if (investmentsRes.data?.length) {
    lines.push("## Investments")
    for (const inv of investmentsRes.data) {
      const gain = inv.gain_loss != null ? ` (${inv.gain_loss >= 0 ? "+" : ""}$${inv.gain_loss.toFixed(2)})` : ""
      const ror = inv.rate_of_return != null ? ` ${inv.rate_of_return}%` : ""
      lines.push(`- ${inv.name} (${inv.account_type}): $${inv.balance.toFixed(2)}${gain}${ror}`)
    }
    const totalInv = investmentsRes.data.reduce((s, i) => s + i.balance, 0)
    lines.push(`Total investments: $${totalInv.toFixed(2)}`)
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

  // Net worth summary
  const totalLiquid = accountsRes.data?.reduce((s, a) => s + a.balance, 0) ?? 0
  const totalInvestments = investmentsRes.data?.reduce((s, i) => s + i.balance, 0) ?? 0
  const totalDebt = debtsRes.data?.reduce((s, d) => s + d.balance, 0) ?? 0
  const netWorth = totalLiquid + totalInvestments - totalDebt
  if (totalLiquid || totalInvestments || totalDebt) {
    lines.push(`## Net Worth: $${netWorth.toFixed(2)} (liquid $${totalLiquid.toFixed(2)} + investments $${totalInvestments.toFixed(2)} − debt $${totalDebt.toFixed(2)})`)
    lines.push("")
  }

  // Recent individual transactions (for cross-referencing)
  if (recentTxRes.data?.length) {
    lines.push("## Recent Transactions (last 15)")
    for (const t of recentTxRes.data) {
      const sign = t.type === "income" ? "+" : "-"
      lines.push(`- ${t.date}: ${sign}$${t.amount.toFixed(2)} ${t.description}${t.category ? ` [${t.category}]` : ""}`)
    }
    lines.push("")
  }

  // Insurance policies
  if (insuranceRes.data?.length) {
    lines.push("## Insurance")
    for (const p of insuranceRes.data) {
      const premium = p.premium ? ` — $${p.premium}/mo` : ""
      const renewal = p.renewal_date ? ` (renews ${p.renewal_date})` : ""
      lines.push(`- ${p.name} (${p.type}): ${p.provider ?? ""}${premium}${renewal}`)
    }
    lines.push("")
  }

  // Recurring expenses
  if (recurringRes.data?.length) {
    lines.push("## Recurring Expenses")
    for (const e of recurringRes.data) {
      const day = e.billing_day ? ` on the ${e.billing_day}${e.billing_day === 1 ? "st" : e.billing_day === 2 ? "nd" : e.billing_day === 3 ? "rd" : "th"}` : ""
      const auto = e.auto_pay ? " (autopay)" : ""
      lines.push(`- ${e.name}: $${e.amount} ${e.frequency}${day}${auto}`)
    }
    lines.push("")
  }

  // Tax items
  if (taxRes.data?.length) {
    lines.push(`## Taxes (${year})`)
    for (const t of taxRes.data) {
      const status = t.filed ? "✅ Filed" : t.due_date ? `Due ${t.due_date}` : "Not filed"
      lines.push(`- ${t.name} (${t.type}): $${t.amount} — ${status}`)
    }
    lines.push("")
  }

  // Grocery & pantry (detailed for cross-referencing with spending)
  if (groceryRes.data?.length) {
    const pantry = groceryRes.data.filter((g) => g.in_pantry)
    const shopping = groceryRes.data.filter((g) => !g.in_pantry)
    const lowStock = pantry.filter(
      (g) => g.low_threshold !== null && g.quantity <= (g.low_threshold ?? 0)
    )
    const expiringSoon = pantry.filter((g) => {
      if (!g.expiry_date) return false
      const exp = new Date(g.expiry_date)
      return exp <= sevenDaysOutDate
    })

    if (pantry.length) {
      lines.push("## Pantry")
      for (const g of pantry) {
        const qty = g.quantity ? ` (${g.quantity}${g.unit ? ` ${g.unit}` : ""})` : ""
        const cat = g.category ? ` [${g.category}]` : ""
        const exp = g.expiry_date ? ` — expires ${g.expiry_date}` : ""
        lines.push(`- ${g.name}${qty}${cat}${exp}`)
      }
      lines.push("")
    }
    if (shopping.length) {
      lines.push(`## Shopping List (${shopping.length} items)`)
      for (const g of shopping) {
        const qty = g.quantity ? ` x${g.quantity}` : ""
        const cat = g.category ? ` [${g.category}]` : ""
        lines.push(`- ${g.name}${qty}${cat}`)
      }
      lines.push("")
    }
    if (lowStock.length) {
      lines.push(`⚠️ Low stock: ${lowStock.map((g) => g.name).join(", ")}`)
    }
    if (expiringSoon.length) {
      lines.push(`⚠️ Expiring this week: ${expiringSoon.map((g) => `${g.name} (${g.expiry_date})`).join(", ")}`)
    }
    if (lowStock.length || expiringSoon.length) lines.push("")
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

  const result = lines.join("\n")
  contextCache.set(userId, { text: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}
