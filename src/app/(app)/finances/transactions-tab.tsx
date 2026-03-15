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
import { Badge } from "@/components/ui/badge"
import type { Tables } from "@/types/database"

type Transaction = Tables<"transactions">
type BankAccount = Tables<"bank_accounts">

const schema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  type: z.enum(["expense", "income", "transfer"]),
  category: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  account_id: z.string().optional(),
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

const TYPE_COLORS: Record<string, string> = {
  income: "bg-green-500/10 text-green-600 dark:text-green-400",
  expense: "bg-red-500/10 text-red-600 dark:text-red-400",
  transfer: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
}

export function TransactionsTab({ userId, initialTransactions, accounts }: TransactionsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const now = new Date()
  const [filterMonth, setFilterMonth] = useState(now.getMonth())
  const [filterYear, setFilterYear] = useState(now.getFullYear())

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return false
      const [y, m] = t.date.split("-").map(Number)
      return y === filterYear && m === filterMonth + 1
    })
  }, [transactions, filterMonth, filterYear])

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
    },
  })

  function openAdd() {
    form.reset({
      amount: 0,
      type: "expense",
      category: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      account_id: "",
    })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(t: Transaction) {
    form.reset({
      amount: Number(t.amount),
      type: t.type as FormValues["type"],
      category: t.category ?? "",
      description: t.description ?? "",
      date: t.date,
      account_id: t.account_id ?? "",
    })
    setEditing(t)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      user_id: userId,
      amount: values.amount,
      type: values.type,
      category: values.category || null,
      description: values.description || null,
      date: values.date,
      account_id: values.account_id || null,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update transaction"); return }
      setTransactions((prev) => prev.map((t) => (t.id === editing.id ? data : t)))
      toast.success("Transaction updated")
    } else {
      const { data, error } = await supabase
        .from("transactions")
        .insert(payload)
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

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

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
        <div className="flex gap-2">
          <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No transactions for {MONTHS[filterMonth]} {filterYear}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead>Type</TableHead>
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
                  <TableCell className="text-sm max-w-[140px] truncate">
                    {t.description || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {t.category || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs capitalize ${TYPE_COLORS[t.type] ?? ""}`}>
                      {t.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm whitespace-nowrap">
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

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...form.register("date")} />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.watch("category") ?? ""}
                onValueChange={(v) => form.setValue("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
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
                  value={form.watch("account_id") ?? ""}
                  onValueChange={(v) => form.setValue("account_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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
