"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/format-utils"
import { EXPENSE_CATEGORIES } from "./constants"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"
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
import type { Tables } from "@/types/database"

type Budget = Tables<"budgets">
type Transaction = Tables<"transactions">

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const schema = z.object({
  category: z.string().min(1, "Category is required"),
  monthly_limit: z.number().positive("Limit must be greater than 0"),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
})
type FormValues = z.infer<typeof schema>

interface BudgetsTabProps {
  initialBudgets: Budget[]
  transactions: Transaction[]
}

export function BudgetsTab({ initialBudgets, transactions }: BudgetsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear, setViewYear] = useState(now.getFullYear())

  const monthBudgets = budgets.filter(
    (b) => b.month === viewMonth && b.year === viewYear
  )

  const spendingByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.forEach((t) => {
      if (t.type !== "expense" || !t.category || !t.date) return
      const [y, m] = t.date.split("-").map(Number)
      if (y === viewYear && m === viewMonth) {
        map[t.category] = (map[t.category] ?? 0) + Number(t.amount)
      }
    })
    return map
  }, [transactions, viewMonth, viewYear])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "",
      monthly_limit: 0,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    },
  })

  function openAdd() {
    form.reset({ category: "", monthly_limit: 0, month: viewMonth, year: viewYear })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(b: Budget) {
    form.reset({
      category: b.category,
      monthly_limit: Number(b.monthly_limit),
      month: b.month,
      year: b.year,
    })
    setEditing(b)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      category: values.category,
      monthly_limit: values.monthly_limit,
      month: values.month,
      year: values.year,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("budgets")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update budget"); return }
      setBudgets((prev) => prev.map((b) => (b.id === editing.id ? data : b)))
      toast.success("Budget updated")
    } else {
      const { data, error } = await supabase
        .from("budgets")
        .insert(payload)
        .select()
        .single()
      if (error) { toast.error("Failed to add budget"); return }
      setBudgets((prev) => [...prev, data])
      toast.success("Budget added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("budgets").delete().eq("id", id)
    if (error) { toast.error("Failed to delete budget"); setDeleting(null); return }
    setBudgets((prev) => prev.filter((b) => b.id !== id))
    toast.success("Budget deleted")
    setDeleting(null)
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i + 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Select value={String(viewMonth)} onValueChange={(v) => setViewMonth(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
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
          <Plus className="size-4 mr-1" /> Add Budget
        </Button>
      </div>

      {monthBudgets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No budgets for {MONTHS[viewMonth - 1]} {viewYear}
        </div>
      ) : (
        <div className="space-y-3">
          {monthBudgets.map((b) => {
            const spent = spendingByCategory[b.category] ?? 0
            const limit = Number(b.monthly_limit)
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
            const over = spent > limit

            return (
              <div key={b.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{b.category}</span>
                    {over && (
                      <span className="text-xs text-destructive font-medium">Over budget</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(spent)} / {formatCurrency(limit)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="!size-7 !min-h-0"
                      onClick={() => openEdit(b)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(b.id)}
                      disabled={deleting === b.id}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(Math.max(limit - spent, 0))} remaining
                </p>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Budget" : "Add Budget"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) => form.setValue("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Limit ($)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" {...form.register("monthly_limit", { valueAsNumber: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select
                  value={String(form.watch("month"))}
                  onValueChange={(v) => form.setValue("month", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input type="number" placeholder="2026" {...form.register("year", { valueAsNumber: true })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
