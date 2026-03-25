"use client"

import { useState, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { toast } from "sonner"
import {
  Users,
  ArrowRightLeft,
  Percent,
  DollarSign,
  TrendingDown,
  Check,
  X,
  Pencil,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { Tables } from "@/types/database"

// ── Types ────────────────────────────────────────────────────────────

type Transaction = Tables<"transactions">
type BankAccount = Tables<"bank_accounts"> & { is_shared?: boolean; type?: string }
type Profile = { id: string; full_name: string | null }

interface Responsibility {
  id: string
  account_id: string
  user_id: string
  percentage: number
  notes: string | null
  created_at: string | null
}

interface SharedContentProps {
  userId: string
  initialAccounts: BankAccount[]
  initialTransactions: Transaction[]
  initialResponsibilities: Responsibility[]
  profiles: Profile[]
  allAccounts: BankAccount[]
}

// ── Constants ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#ef4444",
  Transportation: "#f97316",
  Shopping: "#eab308",
  Entertainment: "#06b6d4",
  Utilities: "#3b82f6",
  Healthcare: "#8b5cf6",
  Subscriptions: "#ec4899",
  "Personal Care": "#14b8a6",
  Housing: "#a855f7",
  Groceries: "#22c55e",
  Education: "#0ea5e9",
  Travel: "#f59e0b",
  Other: "#6b7280",
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// ── Component ────────────────────────────────────────────────────────

export function SharedContent({
  userId,
  initialAccounts,
  initialTransactions,
  initialResponsibilities,
  profiles,
  allAccounts: initialAllAccounts,
}: SharedContentProps) {
  const supabase = useMemo(() => createClient(), [])
  const [accounts, setAccounts] = useState<BankAccount[]>(initialAccounts)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(initialResponsibilities)
  const [allAccounts, setAllAccounts] = useState<BankAccount[]>(initialAllAccounts)

  // ── Profile lookup ───────────────────────────────────────────────

  const profileMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of profiles) m.set(p.id, p.full_name?.split(" ")[0] ?? "Unknown")
    return m
  }, [profiles])

  const accountMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of allAccounts) m.set(a.id, a.name)
    return m
  }, [allAccounts])

  // ── Overview calculations ────────────────────────────────────────

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const totalSharedBalance = useMemo(
    () => accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0),
    [accounts]
  )

  const thisMonthTx = useMemo(
    () =>
      transactions.filter((t) => {
        if (!t.date) return false
        const [y, m] = t.date.split("-").map(Number)
        return y === currentYear && m === currentMonth + 1
      }),
    [transactions, currentMonth, currentYear]
  )

  const thisMonthSpending = useMemo(
    () =>
      thisMonthTx
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount ?? 0), 0),
    [thisMonthTx]
  )

  // Per-user spending this month on shared accounts
  const userSpending = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of thisMonthTx.filter((tx) => tx.type === "expense")) {
      const uid = t.user_id
      map.set(uid, (map.get(uid) ?? 0) + Number(t.amount ?? 0))
    }
    return map
  }, [thisMonthTx])

  // "Who owes whom" calculation
  const owesSummary = useMemo(() => {
    if (profiles.length < 2 || thisMonthSpending === 0) return null

    // Get each user's target % (average across shared accounts, default 50%)
    const userTargetPct = new Map<string, number>()
    for (const p of profiles) {
      const userResps = responsibilities.filter((r) => r.user_id === p.id)
      if (userResps.length > 0) {
        const avg =
          userResps.reduce((s, r) => s + Number(r.percentage), 0) / userResps.length
        userTargetPct.set(p.id, avg / 100)
      } else {
        userTargetPct.set(p.id, 0.5)
      }
    }

    // Calculate delta for each user
    const deltas: { userId: string; name: string; paid: number; owed: number; delta: number }[] = []
    for (const p of profiles) {
      const paid = userSpending.get(p.id) ?? 0
      const targetPct = userTargetPct.get(p.id) ?? 0.5
      const owed = thisMonthSpending * targetPct
      deltas.push({
        userId: p.id,
        name: p.full_name?.split(" ")[0] ?? "Unknown",
        paid,
        owed,
        delta: paid - owed, // positive = overpaid, negative = underpaid
      })
    }

    // Find who overpaid and who underpaid
    const overpaid = deltas.filter((d) => d.delta > 1) // $1 threshold
    const underpaid = deltas.filter((d) => d.delta < -1)

    if (overpaid.length === 0 || underpaid.length === 0) return null

    return {
      from: underpaid[0],
      to: overpaid[0],
      amount: Math.min(Math.abs(underpaid[0].delta), Math.abs(overpaid[0].delta)),
    }
  }, [profiles, responsibilities, userSpending, thisMonthSpending])

  // Category breakdown for pie chart
  const categoryData = useMemo(
    () =>
      thisMonthTx
        .filter((t) => t.type === "expense")
        .reduce((acc, t) => {
          const category = t.category || "Other"
          const existing = acc.find((d) => d.name === category)
          if (existing) {
            existing.value += Number(t.amount ?? 0)
          } else {
            acc.push({ name: category, value: Number(t.amount ?? 0) })
          }
          return acc
        }, [] as Array<{ name: string; value: number }>)
        .sort((a, b) => b.value - a.value),
    [thisMonthTx]
  )

  // ── Transactions tab state ───────────────────────────────────────

  const [filterMonth, setFilterMonth] = useState<number | "all">(currentMonth)
  const [filterYear, setFilterYear] = useState<number | "all">(currentYear)
  const [filterPaidBy, setFilterPaidBy] = useState<string>("all")

  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return false
      const [y, m] = t.date.split("-").map(Number)
      if (filterYear !== "all" && y !== filterYear) return false
      if (filterMonth !== "all" && m !== (filterMonth as number) + 1) return false
      if (filterPaidBy !== "all" && t.user_id !== filterPaidBy) return false
      return true
    })
  }, [transactions, filterMonth, filterYear, filterPaidBy])

  const years = useMemo(() => {
    const ySet = new Set(
      transactions.map((t) => (t.date ? Number(t.date.split("-")[0]) : currentYear))
    )
    ySet.add(currentYear)
    return Array.from(ySet).sort((a, b) => b - a)
  }, [transactions, currentYear])

  // ── Responsibilities tab ─────────────────────────────────────────

  const [editingResp, setEditingResp] = useState<string | null>(null) // account_id being edited
  const [editPct, setEditPct] = useState<Record<string, string>>({}) // user_id → pct string
  const [savingResp, setSavingResp] = useState(false)
  const [togglingShared, setTogglingShared] = useState<string | null>(null)

  function startEditResp(accountId: string) {
    const pcts: Record<string, string> = {}
    for (const p of profiles) {
      const existing = responsibilities.find(
        (r) => r.account_id === accountId && r.user_id === p.id
      )
      pcts[p.id] = String(existing ? Number(existing.percentage) : 50)
    }
    setEditPct(pcts)
    setEditingResp(accountId)
  }

  async function saveResp(accountId: string) {
    setSavingResp(true)
    try {
      for (const p of profiles) {
        const pct = Number(editPct[p.id] ?? 50)
        const { error } = await (supabase as any)
          .from("shared_responsibilities")
          .upsert(
            { account_id: accountId, user_id: p.id, percentage: pct },
            { onConflict: "account_id,user_id" }
          )
        if (error) throw error
      }

      // Refresh responsibilities
      const { data } = await (supabase as any).from("shared_responsibilities").select("*")
      setResponsibilities(data ?? [])
      setEditingResp(null)
      toast.success("Responsibilities updated")
    } catch {
      toast.error("Failed to update responsibilities")
    } finally {
      setSavingResp(false)
    }
  }

  const toggleShared = useCallback(
    async (accountId: string, isShared: boolean) => {
      setTogglingShared(accountId)
      try {
        const { error } = await supabase
          .from("bank_accounts")
          .update({ is_shared: isShared } as never)
          .eq("id", accountId)
        if (error) throw error

        // Update local state
        setAllAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? { ...a, is_shared: isShared } : a))
        )

        if (isShared) {
          const acct = allAccounts.find((a) => a.id === accountId)
          if (acct) setAccounts((prev) => [...prev, { ...acct, is_shared: true }])
          // Fetch transactions for newly shared account
          const { data: newTx } = await supabase
            .from("transactions")
            .select("*")
            .eq("account_id", accountId)
            .order("date", { ascending: false })
          if (newTx) setTransactions((prev) => [...prev, ...newTx].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")))
        } else {
          setAccounts((prev) => prev.filter((a) => a.id !== accountId))
          setTransactions((prev) => prev.filter((t) => t.account_id !== accountId))
          // Remove responsibilities for this account
          await (supabase as any)
            .from("shared_responsibilities")
            .delete()
            .eq("account_id", accountId)
          setResponsibilities((prev) => prev.filter((r) => r.account_id !== accountId))
        }

        toast.success(isShared ? "Account marked as shared" : "Account removed from shared")
      } catch {
        toast.error("Failed to update account")
      } finally {
        setTogglingShared(null)
      }
    },
    [supabase, allAccounts]
  )

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shared Finances</h1>
          <p className="text-sm text-muted-foreground">
            Joint accounts, shared spending, and responsibility tracking
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/goals">
            <Target className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">Goals</span>
          </a>
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="!h-auto py-1 gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="responsibilities">Responsibilities</TabsTrigger>
        </TabsList>

        {/* ── Overview tab ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Shared Balance</p>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(totalSharedBalance)}</p>
              <p className="text-[10px] text-muted-foreground/60">
                {accounts.length} shared account{accounts.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="size-4 text-red-500" />
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(thisMonthSpending)}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {thisMonthTx.filter((t) => t.type === "expense").length} transactions
              </p>
            </div>

            {profiles.map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="size-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {p.full_name?.split(" ")[0]}&apos;s Spend
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  {formatCurrency(userSpending.get(p.id) ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {thisMonthSpending > 0
                    ? `${(((userSpending.get(p.id) ?? 0) / thisMonthSpending) * 100).toFixed(0)}% of total`
                    : "No spending"}
                </p>
              </div>
            ))}
          </div>

          {/* Who owes whom */}
          {owesSummary && (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ArrowRightLeft className="size-4" />
                Settlement
              </h3>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="text-orange-500 border-orange-500/30 bg-orange-500/10">
                  {owesSummary.from.name} owes {owesSummary.to.name}
                </Badge>
                <span className="font-semibold text-lg">
                  {formatCurrency(owesSummary.amount)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">{owesSummary.from.name}</span>: paid{" "}
                  {formatCurrency(owesSummary.from.paid)}, responsible for{" "}
                  {formatCurrency(owesSummary.from.owed)}
                </div>
                <div>
                  <span className="font-medium text-foreground">{owesSummary.to.name}</span>: paid{" "}
                  {formatCurrency(owesSummary.to.paid)}, responsible for{" "}
                  {formatCurrency(owesSummary.to.owed)}
                </div>
              </div>
            </div>
          )}

          {/* Category pie chart */}
          {categoryData.length > 0 ? (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-4">Shared Spending by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS.Other}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              No shared spending this month
            </div>
          )}
        </TabsContent>

        {/* ── Transactions tab ─────────────────────────────────────── */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select
              value={String(filterMonth)}
              onValueChange={(v) => setFilterMonth(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(filterYear)}
              onValueChange={(v) => setFilterYear(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPaidBy} onValueChange={setFilterPaidBy}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name?.split(" ")[0] ?? "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {filteredTx.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              No shared transactions match the selected filters
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell">Account</TableHead>
                    <TableHead>Paid by</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTx.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(t.date)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">
                        {t.description || "\u2014"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {t.category || "\u2014"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {t.account_id ? accountMap.get(t.account_id) ?? "\u2014" : "\u2014"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {profileMap.get(t.user_id) ?? "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium text-sm whitespace-nowrap ${
                          t.type === "income"
                            ? "text-green-600 dark:text-green-400"
                            : ""
                        }`}
                      >
                        {t.type === "expense" ? "-" : "+"}
                        {formatCurrency(Number(t.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {filteredTx.length} transaction{filteredTx.length !== 1 ? "s" : ""}
          </p>
        </TabsContent>

        {/* ── Responsibilities tab ─────────────────────────────────── */}
        <TabsContent value="responsibilities" className="space-y-6">
          {/* Shared accounts with % */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Percent className="size-4" />
              Responsibility Split
            </h3>
            {accounts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                No shared accounts yet. Toggle accounts below to mark them as shared.
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((acct) => {
                  const isEditing = editingResp === acct.id
                  return (
                    <div key={acct.id} className="rounded-lg border p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <div>
                          <p className="font-medium text-sm">{acct.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Balance: {formatCurrency(Number(acct.balance ?? 0))}
                          </p>
                        </div>
                        {!isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!size-8 !min-h-0 sm:!size-auto sm:!min-h-[unset]"
                            onClick={() => startEditResp(acct.id)}
                          >
                            <Pencil className="size-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {profiles.map((p) => {
                          const resp = responsibilities.find(
                            (r) => r.account_id === acct.id && r.user_id === p.id
                          )
                          const pct = resp ? Number(resp.percentage) : 50

                          if (isEditing) {
                            return (
                              <div key={p.id} className="space-y-1">
                                <Label className="text-xs">
                                  {p.full_name?.split(" ")[0]}
                                </Label>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="h-8 text-xs w-20"
                                    value={editPct[p.id] ?? "50"}
                                    onChange={(e) =>
                                      setEditPct((prev) => ({
                                        ...prev,
                                        [p.id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                              <span className="text-sm">
                                {p.full_name?.split(" ")[0]}
                              </span>
                              <Badge variant="outline">{pct}%</Badge>
                            </div>
                          )
                        })}
                      </div>
                      {isEditing && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={() => saveResp(acct.id)}
                            disabled={savingResp}
                          >
                            <Check className="size-3.5 mr-1" />
                            {savingResp ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingResp(null)}
                          >
                            <X className="size-3.5 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Toggle accounts as shared */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Manage Shared Accounts</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Toggle accounts to include them in shared finances.
            </p>
            <div className="space-y-2">
              {allAccounts.map((acct) => (
                <div
                  key={acct.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{acct.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(Number(acct.balance ?? 0))}
                      {acct.type ? ` \u00B7 ${acct.type}` : ""}
                    </p>
                  </div>
                  <Switch
                    checked={!!acct.is_shared}
                    disabled={togglingShared === acct.id}
                    onCheckedChange={(checked) => toggleShared(acct.id, checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
