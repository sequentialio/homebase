"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { INCOME_FREQUENCIES } from "./constants"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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

type IncomeSource = Tables<"income_sources">

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  gross_amount: z.number().min(0).nullable(),
  bonus_amount: z.number().min(0).nullable(),
  bonus_frequency: z.enum(["annually", "quarterly", "monthly"]),
  frequency: z.enum(["weekly", "biweekly", "monthly", "annually", "one-time"]),
  next_date: z.string().optional(),
  active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  annually: 1,
  "one-time": 0,
}

interface EmploymentTabProps {
  userId: string
  initialIncomeSources: IncomeSource[]
}

export function EmploymentTab({ userId, initialIncomeSources }: EmploymentTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [sources, setSources] = useState<IncomeSource[]>(initialIncomeSources)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<IncomeSource | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { annualNet, annualGross, annualBonus } = useMemo(() => {
    const active = sources.filter((s) => s.active)
    const net = active.reduce((sum, s) => {
      const m = FREQUENCY_MULTIPLIERS[s.frequency] ?? 0
      return sum + Number(s.amount) * m
    }, 0)
    const gross = active.reduce((sum, s) => {
      if (!s.gross_amount) return sum
      const m = FREQUENCY_MULTIPLIERS[s.frequency] ?? 0
      return sum + Number(s.gross_amount) * m
    }, 0)
    const bonus = active.reduce((sum, s) => {
      if (!s.bonus_amount) return sum
      const bm = FREQUENCY_MULTIPLIERS[s.bonus_frequency ?? "annually"] ?? 1
      return sum + Number(s.bonus_amount) * bm
    }, 0)
    return { annualNet: net, annualGross: gross || null, annualBonus: bonus || null }
  }, [sources])

  const monthlyIncome = annualNet / 12

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", amount: 0, gross_amount: null, bonus_amount: null, bonus_frequency: "annually", frequency: "monthly", next_date: "", active: true },
  })

  function openAdd() {
    form.reset({ name: "", amount: 0, gross_amount: null, bonus_amount: null, bonus_frequency: "annually", frequency: "monthly", next_date: "", active: true })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(s: IncomeSource) {
    form.reset({
      name: s.name,
      amount: Number(s.amount),
      gross_amount: s.gross_amount != null ? Number(s.gross_amount) : null,
      bonus_amount: s.bonus_amount != null ? Number(s.bonus_amount) : null,
      bonus_frequency: (s.bonus_frequency ?? "annually") as FormValues["bonus_frequency"],
      frequency: s.frequency as FormValues["frequency"],
      next_date: s.next_date ?? "",
      active: s.active,
    })
    setEditing(s)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      user_id: userId,
      name: values.name,
      amount: values.amount,
      gross_amount: values.gross_amount || null,
      bonus_amount: values.bonus_amount || null,
      bonus_frequency: values.bonus_frequency,
      frequency: values.frequency,
      next_date: values.next_date || null,
      active: values.active,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("income_sources")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update income source"); return }
      setSources((prev) => prev.map((s) => (s.id === editing.id ? data : s)))
      toast.success("Income source updated")
    } else {
      const { data, error } = await supabase.from("income_sources").insert(payload).select().single()
      if (error) { toast.error("Failed to add income source"); return }
      setSources((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success("Income source added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("income_sources").delete().eq("id", id)
    if (error) { toast.error("Failed to delete income source"); setDeleting(null); return }
    setSources((prev) => prev.filter((s) => s.id !== id))
    toast.success("Income source deleted")
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Net Monthly</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(monthlyIncome)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(annualNet)} / year</p>
          </div>
          {annualGross && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Gross Annual</p>
              <p className="text-xl font-bold">{formatCurrency(annualGross)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(annualGross / 12)} / month</p>
            </div>
          )}
          {annualBonus && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Bonus</p>
              <p className="text-xl font-bold text-amber-500">{formatCurrency(annualBonus)}</p>
              <p className="text-xs text-muted-foreground">per year</p>
            </div>
          )}
        </div>
        <Button size="sm" onClick={openAdd} className="shrink-0 self-start">
          <Plus className="size-4 mr-1" /> Add Source
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No income sources — add your first one
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((s) => (
            <div key={s.id} className={`rounded-lg border p-4 space-y-2 ${!s.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <DollarSign className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{s.name}</p>
                      {!s.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                    </div>
                    <p className="text-base font-bold mt-0.5 text-green-600 dark:text-green-400">
                      {formatCurrency(Number(s.amount))}
                      <span className="text-xs font-normal text-muted-foreground ml-1 capitalize">{s.frequency.replace("-", " ")} (net)</span>
                    </p>
                    {s.gross_amount && (
                      <p className="text-xs text-muted-foreground">
                        Gross: {formatCurrency(Number(s.gross_amount))} / {s.frequency.replace("-", " ")}
                      </p>
                    )}
                    {s.bonus_amount && (
                      <p className="text-xs text-amber-500">
                        Bonus: {formatCurrency(Number(s.bonus_amount))} / {(s.bonus_frequency ?? "annually").replace("-", " ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => openEdit(s)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              {s.next_date && (
                <p className="text-xs text-muted-foreground">Next: {formatDate(s.next_date)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Income Source" : "Add Income Source"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Salary, Freelance" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...form.register("amount", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select
                  value={form.watch("frequency")}
                  onValueChange={(v) => form.setValue("frequency", v as FormValues["frequency"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f} className="capitalize">{f.replace("-", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Gross Pay (per paycheck, optional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Before deductions"
                value={form.watch("gross_amount") ?? ""}
                onChange={(e) => form.setValue("gross_amount", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bonus Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={form.watch("bonus_amount") ?? ""}
                  onChange={(e) => form.setValue("bonus_amount", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bonus Frequency</Label>
                <Select
                  value={form.watch("bonus_frequency")}
                  onValueChange={(v) => form.setValue("bonus_frequency", v as FormValues["bonus_frequency"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annually">Annually</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Next Payment Date</Label>
              <Input type="date" {...form.register("next_date")} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="emp-active"
                checked={form.watch("active")}
                onCheckedChange={(v) => form.setValue("active", v)}
              />
              <Label htmlFor="emp-active" className="cursor-pointer">Active</Label>
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
