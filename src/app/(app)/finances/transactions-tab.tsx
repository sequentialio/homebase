"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { ALL_CATEGORIES, TRANSACTION_TYPES } from "./constants"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react"
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

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return false
      const [y, m] = t.date.split("-").map(Number)
      if (filterYear !== "all" && y !== filterYear) return false
      if (filterMonth !== "all" && m !== (filterMonth as number) + 1) return false
      if (filterScope !== "all" && (t.scope ?? "personal") !== filterScope) return false
      if (filterAccount !== "all" && t.account_id !== filterAccount) return false
      return true
    })
  }, [transactions, filterMonth, filterYear, filterScope, filterAccount])

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        const amt = Number(t.amount) || 0
        if (t.type === "income") acc.income += amt
        else if (t.type === "expense") acc.expense += amt
        return acc
      },
      { income: 0, expense: 0 }
    )
  }, [filtered])

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
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3 flex items-center gap-3">
          <TrendingUp className="size-4 text-green-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(totals.income)}</p>
          </div>
        </div>
        <div className="rounded-lg border p-3 flex items-center gap-3">
          <TrendingDown className="size-4 text-red-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(totals.expense)}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
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
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add
        </Button>
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
