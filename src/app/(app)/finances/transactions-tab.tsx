"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { ALL_CATEGORIES, TRANSACTION_TYPES } from "./constants"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import type { Tables } from "@/types/database"

type Transaction = Tables<"transactions"> & { scope?: string }
type BankAccount = Tables<"bank_accounts">

// ── Summary tile config ────────────────────────────────────────────────────

interface TileConfig {
  label: string
  type: "income" | "expense"
  scope: "all" | "personal" | "business"
  accountId: "all" | string
  category: "all" | string
}

const DEFAULT_TILES: TileConfig[] = [
  { label: "Income", type: "income", scope: "personal", accountId: "all", category: "all" },
  { label: "Expenses", type: "expense", scope: "personal", accountId: "all", category: "all" },
]

function loadTiles(): TileConfig[] {
  if (typeof window === "undefined") return DEFAULT_TILES
  try {
    const saved = localStorage.getItem("tx_tile_config")
    if (saved) return JSON.parse(saved) as TileConfig[]
  } catch { /* ignore */ }
  return DEFAULT_TILES
}

const schema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  type: z.enum(["expense", "income", "transfer"]),
  category: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  account_id: z.string().optional(),
  scope: z.enum(["personal", "business"]),
})
type FormValues = z.infer<typeof schema>

interface TransactionsTabProps {
  userId: string
  initialTransactions: Transaction[]
  accounts: BankAccount[]
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export function TransactionsTab({ userId, initialTransactions, accounts }: TransactionsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const now = new Date()
  const [filterMonth, setFilterMonth] = useState<number | "all">(now.getMonth())
  const [filterYear, setFilterYear] = useState<number | "all">(now.getFullYear())
  const [filterScope, setFilterScope] = useState<string>("all")
  const [filterAccount, setFilterAccount] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [searchText, setSearchText] = useState<string>("")

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return false
      const [y, m] = t.date.split("-").map(Number)
      if (filterYear !== "all" && y !== filterYear) return false
      if (filterMonth !== "all" && m !== (filterMonth as number) + 1) return false
      if (filterScope !== "all" && (t.scope ?? "personal") !== filterScope) return false
      if (filterAccount !== "all" && t.account_id !== filterAccount) return false
      if (filterCategory !== "all" && t.category !== filterCategory) return false
      if (searchText.trim()) {
        const search = searchText.toLowerCase()
        const matchesDesc = (t.description ?? "").toLowerCase().includes(search)
        const matchesCategory = (t.category ?? "").toLowerCase().includes(search)
        if (!matchesDesc && !matchesCategory) return false
      }
      return true
    })
  }, [transactions, filterMonth, filterYear, filterScope, filterAccount, filterCategory, searchText])

  const [tiles, setTiles] = useState<TileConfig[]>(DEFAULT_TILES)

  useEffect(() => {
    setTiles(loadTiles())
  }, [])

  function saveTiles(next: TileConfig[]) {
    setTiles(next)
    localStorage.setItem("tx_tile_config", JSON.stringify(next))
  }

  function updateTile(index: number, patch: Partial<TileConfig>) {
    const next = tiles.map((t, i) => (i === index ? { ...t, ...patch } : t))
    saveTiles(next)
  }

  // Time-filtered base (month + year only) — tiles apply their own scope/account/category
  const timeFiltered = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return false
      const [y, m] = t.date.split("-").map(Number)
      if (filterYear !== "all" && y !== filterYear) return false
      if (filterMonth !== "all" && m !== (filterMonth as number) + 1) return false
      return true
    })
  }, [transactions, filterMonth, filterYear])

  function calcTile(cfg: TileConfig): number {
    return timeFiltered
      .filter((t) => {
        if (t.type !== cfg.type) return false
        if (cfg.scope !== "all" && (t.scope ?? "personal") !== cfg.scope) return false
        if (cfg.accountId !== "all" && t.account_id !== cfg.accountId) return false
        if (cfg.category !== "all" && t.category !== cfg.category) return false
        return true
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0)
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 0,
      type: "expense",
      category: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      account_id: "",
      scope: "personal",
    },
  })

  // Sentinel for "no selection" in Radix Select (empty string is not allowed as SelectItem value)
  const NO_VALUE = "__none__"

  function openAdd() {
    form.reset({
      amount: 0,
      type: "expense",
      category: NO_VALUE,
      description: "",
      date: new Date().toISOString().split("T")[0],
      account_id: NO_VALUE,
      scope: "personal",
    })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(t: Transaction) {
    form.reset({
      amount: Number(t.amount),
      type: t.type as FormValues["type"],
      category: t.category || NO_VALUE,
      description: t.description ?? "",
      date: t.date,
      account_id: t.account_id || NO_VALUE,
      scope: (t.scope as "personal" | "business") ?? "personal",
    })
    setEditing(t)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      user_id: userId,
      amount: values.amount,
      type: values.type,
      category: (values.category && values.category !== NO_VALUE) ? values.category : null,
      description: values.description || null,
      date: values.date,
      account_id: (values.account_id && values.account_id !== NO_VALUE) ? values.account_id : null,
      scope: values.scope,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("transactions")
        .update(payload as never)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update transaction"); return }
      setTransactions((prev) => prev.map((t) => (t.id === editing.id ? data : t)))
      toast.success("Transaction updated")
    } else {
      const { data, error } = await supabase
        .from("transactions")
        .insert(payload as never)
        .select()
        .single()
      if (error) { toast.error("Failed to add transaction"); return }
      setTransactions((prev) => [data, ...prev])
      toast.success("Transaction added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("transactions").delete().eq("id", id)
    if (error) { toast.error("Failed to delete transaction"); setDeleting(null); return }
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    toast.success("Transaction deleted")
    setDeleting(null)
  }

  // Build year options from actual data
  const years = useMemo(() => {
    const ySet = new Set(transactions.map((t) => {
      if (!t.date) return now.getFullYear()
      return Number(t.date.split("-")[0])
    }))
    ySet.add(now.getFullYear())
    return Array.from(ySet).sort((a, b) => b - a)
  }, [transactions, now])

  // Build account lookup
  const accountMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of accounts) m.set(a.id, a.name)
    return m
  }, [accounts])

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile, idx) => {
          const value = calcTile(tile)
          const isIncome = tile.type === "income"
          const Icon = isIncome ? TrendingUp : TrendingDown
          const hasFilter = tile.scope !== "all" || tile.accountId !== "all" || tile.category !== "all"
          const subtitleParts = [
            tile.scope !== "all" ? (tile.scope === "personal" ? "Personal" : "Business") : null,
            tile.accountId !== "all" ? (accountMap.get(tile.accountId) ?? "Account") : null,
            tile.category !== "all" ? tile.category : null,
          ].filter(Boolean)

          return (
            <div key={idx} className="rounded-lg border p-3 flex items-center gap-3 relative group">
              <Icon className={`size-4 shrink-0 ${isIncome ? "text-green-500" : "text-red-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{tile.label}</p>
                <p className={`font-semibold ${isIncome ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(value)}
                </p>
                {hasFilter && (
                  <p className="text-[10px] text-muted-foreground/60 truncate leading-tight mt-0.5">
                    {subtitleParts.join(" · ")}
                  </p>
                )}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!size-6 !min-h-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <Settings2 className="size-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 space-y-3" align="end">
                  <p className="text-xs font-medium">Configure tile</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Label</Label>
                    <Input
                      className="h-7 text-xs"
                      value={tile.label}
                      onChange={(e) => updateTile(idx, { label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={tile.type}
                      onValueChange={(v) => updateTile(idx, { type: v as TileConfig["type"] })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Scope</Label>
                    <Select
                      value={tile.scope}
                      onValueChange={(v) => updateTile(idx, { scope: v as TileConfig["scope"] })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All scopes</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {accounts.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Account</Label>
                      <Select
                        value={tile.accountId}
                        onValueChange={(v) => updateTile(idx, { accountId: v })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All accounts</SelectItem>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={tile.category}
                      onValueChange={(v) => updateTile(idx, { category: v })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {ALL_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <Input
            placeholder="Search description or category..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-8 text-xs sm:w-48"
          />
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4 mr-1" /> Add
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterScope} onValueChange={setFilterScope}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {ALL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {accounts.length > 0 && (
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No transactions match the selected filters
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
                <TableHead className="hidden sm:table-cell">Scope</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(t.date)}
                  </TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate">
                    {t.description || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {t.category || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {t.account_id ? accountMap.get(t.account_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className={`text-xs font-medium ${(t.scope ?? "personal") === "business" ? "text-blue-500" : "text-muted-foreground"}`}>
                      {(t.scope ?? "personal") === "business" ? "BIZ" : "PER"}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-medium text-sm whitespace-nowrap ${t.type === "income" ? "text-green-600 dark:text-green-400" : ""}`}>
                    {t.type === "expense" ? "-" : "+"}{formatCurrency(Number(t.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="!size-7 !min-h-0"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(t.id)}
                        disabled={deleting === t.id}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register("amount", { valueAsNumber: true })}
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(v) => form.setValue("type", v as FormValues["type"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...form.register("date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Scope</Label>
                <Select
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as "personal" | "business")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.watch("category") || NO_VALUE}
                onValueChange={(v) => form.setValue("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VALUE}>No category</SelectItem>
                  {ALL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="e.g. Whole Foods run" {...form.register("description")} />
            </div>

            {accounts.length > 0 && (
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Select
                  value={form.watch("account_id") || NO_VALUE}
                  onValueChange={(v) => form.setValue("account_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>None</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
