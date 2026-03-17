import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import {
  DollarSign,
  ShoppingCart,
  CalendarDays,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
  const todayStr = now.toISOString().slice(0, 10)
  const in7 = new Date(now)
  in7.setDate(in7.getDate() + 7)
  const in7Str = in7.toISOString().slice(0, 10)

  const [
    { data: accounts },
    { data: debts },
    { data: transactions },
    { data: budgets },
    { data: groceries },
    { data: duties },
    { data: events },
    { data: profile },
  ] = await Promise.all([
    supabase.from("bank_accounts").select("balance, name"),
    supabase.from("debts").select("balance, name"),
    supabase
      .from("transactions")
      .select("amount, type, category, description, date")
      .gte("date", monthStart)
      .order("date", { ascending: false }),
    supabase
      .from("budgets")
      .select("category, monthly_limit")
      .eq("month", month)
      .eq("year", year),
    supabase
      .from("grocery_items")
      .select("id, name, quantity, low_threshold, in_pantry, expiry_date, unit"),
    supabase
      .from("cleaning_duties")
      .select("id, name, next_due, assigned_to")
      .lte("next_due", in7Str)
      .order("next_due", { ascending: true }),
    supabase
      .from("calendar_events")
      .select("id, title, start_at, all_day, source")
      .gte("start_at", now.toISOString())
      .order("start_at", { ascending: true })
      .limit(5),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ])

  // ── computed stats ──────────────────────────────────────────────────────
  const totalAssets = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0)
  const totalDebt = (debts ?? []).reduce((s, d) => s + Number(d.balance), 0)
  const netWorth = totalAssets - totalDebt

  const monthExpenses = (transactions ?? [])
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalBudget = (budgets ?? []).reduce(
    (s, b) => s + Number(b.monthly_limit),
    0
  )
  const budgetPct = totalBudget > 0 ? monthExpenses / totalBudget : 0

  const shoppingCount = (groceries ?? []).filter((g) => !g.in_pantry).length

  const lowStockItems = (groceries ?? []).filter(
    (g) =>
      g.in_pantry &&
      g.low_threshold != null &&
      Number(g.quantity) <= Number(g.low_threshold)
  )
  const expiringItems = (groceries ?? []).filter((g) => {
    if (!g.expiry_date) return false
    const days =
      (new Date(g.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days <= 7 && days >= 0
  })

  const dutiesDue = (duties ?? []).filter((d) => !!d.next_due)
  const dutiesOverdue = dutiesDue.filter((d) => d.next_due! <= todayStr)

  const recentTx = (transactions ?? []).slice(0, 5)

  const greeting = (() => {
    const h = now.getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()

  const displayName = profile?.full_name
    ? profile.full_name.split(" ")[0]
    : "there"

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Net Worth */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Net Worth
            </span>
            <DollarSign className="size-4 text-muted-foreground" />
          </div>
          <p
            className={cn(
              "text-xl font-bold",
              netWorth >= 0 ? "text-green-500" : "text-red-500"
            )}
          >
            {fmt(netWorth)}
          </p>
          <p className="text-xs text-muted-foreground">
            {fmt(totalAssets)} assets · {fmt(totalDebt)} debt
          </p>
        </div>

        {/* Monthly Spending */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Month Spend
            </span>
            {budgetPct > 1 ? (
              <TrendingUp className="size-4 text-red-500" />
            ) : (
              <TrendingDown className="size-4 text-muted-foreground" />
            )}
          </div>
          <p className="text-xl font-bold">{fmt(monthExpenses)}</p>
          {totalBudget > 0 ? (
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    budgetPct > 1
                      ? "bg-red-500"
                      : budgetPct > 0.8
                      ? "bg-yellow-500"
                      : "bg-primary"
                  )}
                  style={{ width: `${Math.min(budgetPct * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round(budgetPct * 100)}% of {fmt(totalBudget)} budget
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No budget set</p>
          )}
        </div>

        {/* Shopping List */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Shopping
            </span>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold">{shoppingCount}</p>
          <p className="text-xs text-muted-foreground">
            {shoppingCount === 1 ? "item" : "items"} to pick up
            {lowStockItems.length > 0 && (
              <span className="text-yellow-500 ml-1">
                · {lowStockItems.length} low stock
              </span>
            )}
          </p>
        </div>

        {/* Cleaning */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Cleaning
            </span>
            <Sparkles className="size-4 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold">{dutiesDue.length}</p>
          <p className="text-xs text-muted-foreground">
            {dutiesDue.length === 1 ? "duty" : "duties"} due this week
            {dutiesOverdue.length > 0 && (
              <span className="text-red-500 ml-1">
                · {dutiesOverdue.length} overdue
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Alerts row ─────────────────────────────────────────────────── */}
      {(lowStockItems.length > 0 || expiringItems.length > 0 || dutiesOverdue.length > 0) && (
        <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="size-4" />
            <span className="text-sm font-medium">Needs attention</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dutiesOverdue.map((d) => (
              <Badge
                key={d.id}
                variant="outline"
                className="text-xs border-red-400/50 text-red-500"
              >
                <Clock className="size-3 mr-1" />
                {d.name} overdue
              </Badge>
            ))}
            {lowStockItems.slice(0, 3).map((g) => (
              <Badge
                key={g.id}
                variant="outline"
                className="text-xs border-yellow-400/50 text-yellow-600 dark:text-yellow-400"
              >
                <AlertTriangle className="size-3 mr-1" />
                Low: {g.name}
              </Badge>
            ))}
            {expiringItems.slice(0, 3).map((g) => (
              <Badge
                key={g.id}
                variant="outline"
                className="text-xs border-orange-400/50 text-orange-500"
              >
                <AlertTriangle className="size-3 mr-1" />
                Expiring: {g.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Two-column: transactions + calendar ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        <div className="rounded-lg border space-y-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h2 className="font-semibold text-sm">Recent Transactions</h2>
            <Link
              href="/finances"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No transactions this month
            </div>
          ) : (
            <div className="divide-y">
              {recentTx.map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div
                    className={cn(
                      "size-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                      t.type === "expense"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-green-500/10 text-green-500"
                    )}
                  >
                    {t.type === "expense" ? "−" : "+"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.description || t.category || "Transaction"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.category && (
                        <span className="capitalize">{t.category} · </span>
                      )}
                      {fmtDate(t.date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold shrink-0",
                      t.type === "expense" ? "text-red-500" : "text-green-500"
                    )}
                  >
                    {t.type === "expense" ? "−" : "+"}
                    {fmt(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="rounded-lg border space-y-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h2 className="font-semibold text-sm">Upcoming</h2>
            <Link
              href="/calendar"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Calendar <ArrowRight className="size-3" />
            </Link>
          </div>
          {(events ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing scheduled
            </div>
          ) : (
            <div className="divide-y">
              {(events ?? []).map((e) => {
                const isAsana = e.source === "asana"
                const isCleaning = e.source === "cleaning"
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <CalendarDays
                      className={cn(
                        "size-4 shrink-0",
                        isAsana
                          ? "text-blue-500"
                          : isCleaning
                          ? "text-orange-500"
                          : "text-primary"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.all_day
                          ? fmtDate(e.start_at)
                          : new Date(e.start_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">
                      {e.source}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Cleaning duties due ─────────────────────────────────────────── */}
      {dutiesDue.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h2 className="font-semibold text-sm">Cleaning Duties This Week</h2>
            <Link
              href="/household"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="divide-y">
            {dutiesDue.map((d) => {
              const overdue = d.next_due! <= todayStr
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  {overdue ? (
                    <AlertTriangle className="size-4 text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.name}</p>
                    {d.assigned_to && (
                      <p className="text-xs text-muted-foreground">
                        {d.assigned_to}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs shrink-0",
                      overdue ? "text-red-500" : "text-muted-foreground"
                    )}
                  >
                    {overdue ? "Overdue" : `Due ${fmtDate(d.next_due!)}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
