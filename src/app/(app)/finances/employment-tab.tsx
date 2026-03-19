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

  const annualIncome = sources
    .filter((s) => s.active)
    .reduce((sum, s) => {
      const multiplier = FREQUENCY_MULTIPLIERS[s.frequency] ?? 0
      return sum + Number(s.amount) * multiplier
    }, 0)

  const monthlyIncome = annualIncome / 12

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", amount: 0, frequency: "monthly", next_date: "", active: true },
  })

  function openAdd() {
    form.reset({ name: "", amount: 0, frequency: "monthly", next_date: "", active: true })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(s: IncomeSource) {
    form.reset({
      name: s.name,
      amount: Number(s.amount),
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
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">Monthly income (active sources)</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(monthlyIncome)}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(annualIncome)} / year</p>
        </div>
        <Button size="sm" onClick={openAdd}>
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
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{s.frequency.replace("-", " ")}</p>
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
