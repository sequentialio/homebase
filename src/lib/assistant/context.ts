import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getCurrentPayPeriod } from "@/lib/pay-period"

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
  const payPeriod = getCurrentPayPeriod()
  const sevenDaysOutDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const sevenDaysOut = sevenDaysOutDate.toISOString().split("T")[0]
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

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
    engagementsRes,
    creditAccountsRes,
    creditProfileRes,
    freshnessRes,
    knowledgeRes,
    nwHistoryRes,
    alertsRes,
    knowledgeSystemRes,
    goalsRes,
    devRequestsRes,
    sharedListsRes,
    weightLogsRes,
    exerciseLogsRes,
    householdMessagesRes,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, id"),
    supabase.from("bank_accounts").select("id, name, balance, currency"),
    supabase
      .from("transactions")
      .select("type, amount, category, description, date")
      .gte("date", payPeriod.start)
      .lte("date", payPeriod.end)
      .order("date", { ascending: false })
      .limit(100),
    // Last 15 individual transactions for cross-referencing
    supabase
      .from("transactions")
      .select("type, amount, category, description, date")
      .order("date", { ascending: false })
      .limit(15),
    (supabase as any)
      .from("budgets")
      .select("category, period_limit"),
    supabase.from("debts").select("name, balance, interest_rate, min_payment, status, employer_contribution"),
    supabase
      .from("grocery_items")
      .select("name, quantity, unit, low_threshold, in_pantry, category, expiry_date, checked"),
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
    (supabase as any)
      .from("tax_items")
      .select("name, amount, type, tax_year, filed, due_date, form_source, category")
      .eq("tax_year", year),
    supabase
      .from("business_engagements")
      .select("client, date, amount, taxes_owed, revenue, status")
      .order("date", { ascending: false })
      .limit(20),
    (supabase as any)
      .from("credit_accounts")
      .select("name, type, balance, credit_limit, status, linked_debt_id"),
    (supabase as any)
      .from("credit_profile")
      .select("score, score_source, payment_history_pct, credit_card_use_pct, derogatory_marks, credit_age_years, credit_age_months, total_accounts, hard_inquiries, last_updated")
      .limit(1),
    (supabase as any)
      .from("data_freshness")
      .select("section, last_updated")
      .order("section"),
    (supabase as any)
      .from("knowledge_docs")
      .select("id, title, category")
      .eq("user_id", userId)
      .neq("category", "System")
      .order("category"),
    (supabase as any)
      .from("net_worth_snapshots")
      .select("snapshot_date, net_worth")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: false })
      .limit(6),
    (supabase as any)
      .from("alerts")
      .select("id, type, title, severity, due_date, created_at")
      .eq("user_id", userId)
      .eq("is_read", false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(10),
    (supabase as any)
      .from("knowledge_docs")
      .select("id, title, content, updated_at")
      .eq("user_id", userId)
      .eq("category", "System")
      .order("updated_at", { ascending: false }),
    (supabase as any)
      .from("goals")
      .select("id, title, description, category, target_amount, current_amount, target_date, status, priority")
      .eq("user_id", userId)
      .neq("status", "achieved")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("dev_requests")
      .select("id, title, description, category, priority, status, created_at")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(10),
    (supabase as any)
      .from("shared_lists")
      .select("id, name, shared_list_items(id, checked)")
      .order("position"),
    (supabase as any)
      .from("weight_logs")
      .select("*")
      .order("date", { ascending: false })
      .limit(4),
    (supabase as any)
      .from("exercise_logs")
      .select("*")
      .gte("date", sevenDaysAgo)
      .order("date", { ascending: false }),
    (supabase as any)
      .from("household_messages")
      .select("sender_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const lines: string[] = [
    `Today: ${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    "",
  ]

  // Data freshness — helps assistant know what's stale
  if (freshnessRes.data?.length) {
    lines.push("## Data Freshness (last updated)")
    const now = Date.now()
    for (const f of freshnessRes.data as Array<{ section: string; last_updated: string }>) {
      const ago = Math.floor((now - new Date(f.last_updated).getTime()) / (1000 * 60 * 60 * 24))
      const label = ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`
      const stale = ago > 14 ? " ⚠️ STALE" : ago > 7 ? " (getting old)" : ""
      lines.push(`- ${f.section}: ${label}${stale}`)
    }
    lines.push("")
  }

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
      const gross = (i as Record<string, unknown>).gross_amount ? ` | gross: $${Number((i as Record<string, unknown>).gross_amount).toFixed(2)}` : ""
      const ded = (i as Record<string, unknown>).deductions ? ` | deductions: $${Number((i as Record<string, unknown>).deductions).toFixed(2)}` : ""
      const bonus = (i as Record<string, unknown>).bonus_amount ? ` | bonus: $${Number((i as Record<string, unknown>).bonus_amount).toFixed(2)}/${(i as Record<string, unknown>).bonus_frequency ?? "annually"}` : ""
      lines.push(`- ${i.name}: net $${i.amount.toFixed(2)} (${i.frequency})${gross}${ded}${bonus}`)
    }
    lines.push("")
  }

  // Business engagements
  if (engagementsRes.data?.length) {
    lines.push("## Business Engagements")
    for (const e of engagementsRes.data) {
      const taxes = e.taxes_owed != null ? `taxes: $${Number(e.taxes_owed).toFixed(2)}` : ""
      const rev = e.revenue != null ? `revenue: $${Number(e.revenue).toFixed(2)}` : ""
      const details = [taxes, rev].filter(Boolean).join(", ")
      lines.push(`- ${e.client} (${e.date}): $${Number(e.amount).toFixed(2)} [${e.status}]${details ? ` (${details})` : ""}`)
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
      `## Current Pay Period (${payPeriod.label})`
    )
    lines.push(`Income: $${income.toFixed(2)} | Expenses: $${expenses.toFixed(2)} | Net: $${(income - expenses).toFixed(2)}`)
    const uncategorized = byCategory["Uncategorized"] ?? 0
    if (uncategorized > 0 && expenses > 0 && (uncategorized > 200 || uncategorized / expenses > 0.1)) {
      lines.push(`⚠️ $${uncategorized.toFixed(0)} (${Math.round(uncategorized / expenses * 100)}%) is Uncategorized — budget tracking is incomplete`)
    }
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

  // Budgets (biweekly pay period)
  if (budgetsRes.data?.length && txThisMonthRes.data?.length) {
    lines.push("## Budget Status (Pay Period)")
    for (const b of budgetsRes.data) {
      const limit = Number((b as any).period_limit)
      const spent = txThisMonthRes.data
        .filter((t) => t.type === "expense" && t.category === b.category)
        .reduce((s, t) => s + t.amount, 0)
      const pct = Math.round((spent / limit) * 100)
      const flag = pct >= 90 ? " ⚠️ OVER" : pct >= 75 ? " (75%+)" : ""
      lines.push(
        `- ${b.category}: $${spent.toFixed(0)} / $${limit.toFixed(0)}${flag}`
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
      const status = (d as any).status && (d as any).status !== "active" ? ` [${(d as any).status}]` : ""
      const empContrib = (d as any).employer_contribution ? ` (employer pays $${(d as any).employer_contribution}/mo)` : ""
      lines.push(`- ${d.name}: $${d.balance.toFixed(2)}${rate}${status}${empContrib}`)
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
    // Net worth trend from snapshots
    const nwHistory = nwHistoryRes?.data as Array<{ snapshot_date: string; net_worth: number }> | null
    if (nwHistory && nwHistory.length >= 2) {
      const oldest = nwHistory[nwHistory.length - 1]
      const change = netWorth - oldest.net_worth
      const trendStr = change >= 0 ? `+$${change.toFixed(2)}` : `-$${Math.abs(change).toFixed(2)}`
      lines.push(`Net worth trend: ${trendStr} since ${oldest.snapshot_date} (use get_net_worth_history for full data)`)
    } else if (!nwHistory || nwHistory.length === 0) {
      lines.push(`Net worth trend: no history yet — use snapshot_net_worth to start tracking`)
    }
    lines.push("")
  }

  // Active alerts
  const activeAlerts = alertsRes?.data as Array<{ id: string; type: string; title: string; severity: string; due_date: string | null }> | null
  if (activeAlerts && activeAlerts.length > 0) {
    lines.push("## Active Alerts (unread — use dismiss_alert when resolved)")
    for (const a of activeAlerts) {
      const due = a.due_date ? ` (due ${a.due_date})` : ""
      lines.push(`- [${a.severity.toUpperCase()}] ${a.title}${due} [id: ${a.id}]`)
    }
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

  // Tax items with computed summary
  if (taxRes.data?.length) {
    const taxItems = taxRes.data as any[]
    const income = taxItems.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
    const payments = taxItems.filter((t) => t.type === "payment").reduce((s, t) => s + Number(t.amount), 0)
    const deductions = taxItems.filter((t) => t.type === "deduction").reduce((s, t) => s + Number(t.amount), 0)
    const fedWithheld = taxItems.filter((t) => t.type === "payment" && t.category === "federal").reduce((s, t) => s + Number(t.amount), 0)

    lines.push(`## Taxes (${year}) — Gross: $${income.toFixed(2)}, Deductions: $${deductions.toFixed(2)}, Total Withheld: $${payments.toFixed(2)}, Fed Withheld: $${fedWithheld.toFixed(2)}`)
    for (const t of taxItems) {
      const status = t.filed ? "Filed" : t.due_date ? `Due ${t.due_date}` : "Not filed"
      const form = t.form_source ? ` [${t.form_source}]` : ""
      lines.push(`- ${t.name} (${t.type}): $${Number(t.amount).toFixed(2)}${form} — ${status}`)
    }
    lines.push("")
  }

  // Grocery & pantry (detailed for cross-referencing with spending)
  if (groceryRes.data?.length) {
    const pantry = groceryRes.data.filter((g) => g.in_pantry)
    const shopping = groceryRes.data.filter((g) => !g.in_pantry && !(g as any).checked)
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
    const totalShoppingItems = groceryRes.data.filter((g) => !g.in_pantry).length
    const checkedCount = totalShoppingItems - shopping.length
    if (shopping.length) {
      lines.push(`## Shopping List (${shopping.length} needed${checkedCount > 0 ? `, ${checkedCount} already checked off` : ""})`)
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

  // Credit profile
  const creditProfile = creditProfileRes.data?.[0]
  if (creditProfile) {
    lines.push(`## Credit Score: ${creditProfile.score} (${creditProfile.score_source})`)
    if (creditProfile.payment_history_pct != null) lines.push(`- Payment history: ${creditProfile.payment_history_pct}%`)
    if (creditProfile.credit_card_use_pct != null) lines.push(`- Credit card use: ${creditProfile.credit_card_use_pct}%`)
    if (creditProfile.derogatory_marks != null) lines.push(`- Derogatory marks: ${creditProfile.derogatory_marks}`)
    if (creditProfile.credit_age_years != null) lines.push(`- Credit age: ${creditProfile.credit_age_years} yrs, ${creditProfile.credit_age_months ?? 0} mos`)
    if (creditProfile.total_accounts != null) lines.push(`- Total accounts: ${creditProfile.total_accounts}`)
    if (creditProfile.hard_inquiries != null) lines.push(`- Hard inquiries: ${creditProfile.hard_inquiries}`)
    if (creditProfile.last_updated) lines.push(`- Last updated: ${creditProfile.last_updated}`)
    lines.push("")
  }

  // Credit accounts
  if (creditAccountsRes.data?.length) {
    lines.push("## Credit Accounts")
    const debtsMap = new Map((debtsRes.data ?? []).map((d: any) => [d.id, d]))
    for (const a of creditAccountsRes.data) {
      const limit = a.credit_limit ? ` / $${Number(a.credit_limit).toFixed(2)} limit` : ""
      const util = a.credit_limit ? ` (${((Number(a.balance) / Number(a.credit_limit)) * 100).toFixed(0)}% util)` : ""
      let linkNote = ""
      if ((a as any).linked_debt_id) {
        const linkedDebt = debtsMap.get((a as any).linked_debt_id) as any
        if (linkedDebt) {
          linkNote = ` [linked to debt "${linkedDebt.name}"]`
          if (Math.abs(Number(a.balance) - Number(linkedDebt.balance)) > 0.01) {
            linkNote += ` ⚠️ BALANCE MISMATCH: credit=$${Number(a.balance).toFixed(2)} vs debt=$${Number(linkedDebt.balance).toFixed(2)}`
          }
        }
      }
      lines.push(`- ${a.name} (${a.type}): $${Number(a.balance).toFixed(2)}${limit}${util} [${a.status}]${linkNote}`)
    }
    lines.push("")
  }

  // System knowledge docs — loaded in full every conversation
  const systemDocs = knowledgeSystemRes?.data as Array<{ id: string; title: string; content: string; updated_at: string }> | null
  if (systemDocs?.length) {
    const MAX_SYSTEM_DOC_CHARS = 4000
    for (const doc of systemDocs) {
      lines.push(`## [System Doc] ${doc.title} [id: ${doc.id}]`)
      lines.push(`*Last updated: ${new Date(doc.updated_at).toLocaleDateString()}*`)
      lines.push("")
      if (doc.content.length > MAX_SYSTEM_DOC_CHARS) {
        lines.push(doc.content.slice(0, MAX_SYSTEM_DOC_CHARS))
        lines.push(`\n... (truncated — ${doc.content.length} chars total. Use read_document to see full content.)`)
      } else {
        lines.push(doc.content)
      }
      lines.push("")
    }
  }

  // Knowledge base (titles only — use search_knowledge_base/read_document to access content)
  const knowledgeDocs = knowledgeRes?.data as Array<{ id: string; title: string; category: string }> | null
  if (knowledgeDocs?.length) {
    lines.push("## Knowledge Base Documents (use search_knowledge_base to search, read_document to read, save_to_knowledge_base to save new docs or update existing ones)")
    const grouped: Record<string, string[]> = {}
    for (const d of knowledgeDocs) {
      if (!grouped[d.category]) grouped[d.category] = []
      grouped[d.category].push(`${d.title} [id: ${d.id}]`)
    }
    for (const [cat, titles] of Object.entries(grouped).sort()) {
      lines.push(`**${cat}:** ${titles.join(", ")}`)
    }
    lines.push("")
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

  // Goals
  const goals = goalsRes?.data as Array<Record<string, unknown>> | null
  if (goals?.length) {
    lines.push("## Active Goals")
    for (const g of goals) {
      const pct = g.target_amount && Number(g.target_amount) > 0
        ? ` (${Math.round((Number(g.current_amount ?? 0) / Number(g.target_amount)) * 100)}% complete)`
        : ""
      const due = g.target_date ? ` — due ${g.target_date}` : ""
      const amt = g.target_amount ? ` — target: $${Number(g.target_amount).toLocaleString()}${pct}` : ""
      lines.push(`- [${g.priority}] ${g.title} [${g.category}]${amt}${due} [id: ${g.id}]`)
      if (g.description) lines.push(`  ${g.description}`)
    }
    lines.push("")
  }

  // Dev requests (assistant → Claude Code channel)
  const devRequests = devRequestsRes?.data as Array<Record<string, unknown>> | null
  if (devRequests?.length) {
    lines.push("## Open Dev Requests (for Claude Code)")
    for (const r of devRequests) {
      lines.push(`- [${r.priority}/${r.category}] ${r.title}: ${r.description} [id: ${r.id}]`)
    }
    lines.push("These are issues/improvements you've logged. Reference them when discussing app problems or improvements.")
    lines.push("")
  }

  // Shared Lists
  const sharedLists = sharedListsRes?.data as Array<{ id: string; name: string; shared_list_items: Array<{ id: string; checked: boolean }> }> | null
  if (sharedLists?.length) {
    lines.push("## Shared Lists")
    for (const list of sharedLists) {
      const items = list.shared_list_items ?? []
      const unchecked = items.filter((i) => !i.checked).length
      lines.push(`- ${list.name}: ${unchecked}/${items.length} unchecked [id: ${list.id}]`)
    }
    lines.push("")
  }

  // Health Snapshot
  const weightLogs = weightLogsRes?.data as Array<{ user_id: string; weight: number; date: string }> | null
  const exerciseLogs = exerciseLogsRes?.data as Array<{ user_id: string; type: string; date: string }> | null
  if ((weightLogs && weightLogs.length > 0) || (exerciseLogs && exerciseLogs.length > 0)) {
    lines.push("## Health Snapshot")
    if (weightLogs?.length) {
      const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]))
      const latestByUser = new Map<string, { weight: number; date: string }>()
      for (const w of weightLogs) {
        if (!latestByUser.has(w.user_id)) latestByUser.set(w.user_id, { weight: w.weight, date: w.date })
      }
      for (const [uid, latest] of latestByUser) {
        lines.push(`- ${profileMap.get(uid) ?? uid}: ${latest.weight} lbs (${latest.date})`)
      }
    }
    if (exerciseLogs?.length) {
      lines.push(`- Exercises this week: ${exerciseLogs.length}`)
    }
    lines.push("")
  }

  // Recent Chat
  const chatMessages = householdMessagesRes?.data as Array<{ sender_id: string; content: string; created_at: string }> | null
  if (chatMessages?.length) {
    lines.push("## Recent Chat")
    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]))
    for (const m of chatMessages) {
      const sender = profileMap.get(m.sender_id) ?? m.sender_id
      const time = new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      lines.push(`- ${sender} (${time}): ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`)
    }
    lines.push("")
  }

  const result = lines.join("\n")
  contextCache.set(userId, { text: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}
