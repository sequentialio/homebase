"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/format-utils"
import { INCOME_FREQUENCIES } from "./constants"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Tables } from "@/types/database"

type IncomeSource = Tables<"income_sources"> & { deductions?: number | null }

const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  annually: 1,
  quarterly: 4,
  "one-time": 0,
}

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  annually: "Annually",
  quarterly: "Quarterly",
  "one-time": "One-time",
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  gross_amount: z.number().min(0).nullable(),
  deductions: z.number().min(0).nullable(),
  bonus_amount: z.number().min(0).nullable(),
  bonus_frequency: z.enum(["annually", "quarterly", "monthly"]),
  frequency: z.enum(["weekly", "biweekly", "monthly", "annually", "one-time"]),
  next_date: z.string().optional(),
  active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

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

  const { annualNet, annualGross, annualDeductions, annualBonus } = useMemo(() => {
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
    const ded = active.reduce((sum, s) => {
      if (!s.deductions) return sum
      const m = FREQUENCY_MULTIPLIERS[s.frequency] ?? 0
      return sum + Number(s.deductions) * m
    }, 0)
    const bonus = active.reduce((sum, s) => {
      if (!s.bonus_amount) return sum
      const bm = FREQUENCY_MULTIPLIERS[s.bonus_frequency ?? "annually"] ?? 1
      return sum + Number(s.bonus_amount) * bm
    }, 0)
    return { annualNet: net, annualGross: gross || null, annualDeductions: ded || null, annualBonus: bonus || null }
  }, [sources])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", amount: 0, gross_amount: null, deductions: null, bonus_amount: null, bonus_frequency: "annually", frequency: "monthly", next_date: "", active: true },
  })

  // Auto-calculate deductions when gross and net change
  const watchGross = form.watch("gross_amount")
  const watchNet = form.watch("amount")
  const previewDeductions = watchGross && watchNet ? watchGross - watchNet : null

  function openAdd() {
    form.reset({ name: "", amount: 0, gross_amount: null, deductions: null, bonus_amount: null, bonus_frequency: "annually", frequency: "monthly", next_date: "", active: true })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(s: IncomeSource) {
    form.reset({
      name: s.name,
      amount: Number(s.amount),
      gross_amount: s.gross_amount != null ? Number(s.gross_amount) : null,
      deductions: s.deductions != null ? Number(s.deductions) : null,
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
    // Auto-calculate deductions if gross is set
    const ded = values.deductions ?? (values.gross_amount ? values.gross_amount - values.amount : null)

    const payload = {
      user_id: userId,
      name: values.name,
      amount: values.amount,
      gross_amount: values.gross_amount || null,
      deductions: ded || null,
      bonus_amount: values.bonus_amount || null,
      bonus_frequency: values.bonus_frequency,
      frequency: values.frequency,
      next_date: values.next_date || null,
      active: values.active,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("income_sources")
        .update(payload as never)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update income source"); return }
      setSources((prev) => prev.map((s) => (s.id === editing.id ? data : s)))
      toast.success("Income source updated")
    } else {
      const { data, error } = await supabase.from("income_sources").insert(payload as never).select().single()
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
      {/* Summary cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {annualGross && (
            <div className="rounded-lg border p-3 min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Gross / yr</p>
              <p className="text-lg font-bold">{formatCurrency(annualGross)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(annualGross / 12)} / mo</p>
            </div>
          )}
          {annualDeductions && (
            <div className="rounded-lg border p-3 min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Deductions / yr</p>
              <p className="text-lg font-bold text-red-500">{formatCurrency(annualDeductions)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(annualDeductions / 12)} / mo</p>
            </div>
          )}
          <div className="rounded-lg border p-3 min-w-[120px]">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Net / yr</p>
            <p className="text-lg font-bold text-green-500">{formatCurrency(annualNet)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(annualNet / 12)} / mo</p>
          </div>
          {annualBonus && (
            <div className="rounded-lg border p-3 min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Bonus / yr</p>
              <p className="text-lg font-bold text-amber-500">{formatCurrency(annualBonus)}</p>
            </div>
          )}
        </div>
        <Button size="sm" onClick={openAdd} className="shrink-0 self-start">
          <Plus className="size-4 mr-1" /> Add Source
        </Button>
      </div>

      {/* Table */}
      {sources.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No income sources — add your first one
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="hidden sm:table-cell">Gross</TableHead>
                <TableHead className="hidden sm:table-cell">Deductions</TableHead>
                <TableHead>Net</TableHead>
                <TableHead className="hidden md:table-cell">Bonus</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => {
                const gross = s.gross_amount ? Number(s.gross_amount) : null
                const ded = s.deductions ? Number(s.deductions) : (gross ? gross - Number(s.amount) : null)
                return (
                  <TableRow key={s.id} className={!s.active ? "opacity-50" : undefined}>
                    <TableCell className="text-sm font-medium max-w-[180px] truncate">
                      {s.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {FREQ_LABELS[s.frequency] ?? s.frequency}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm whitespace-nowrap">
                      {gross ? formatCurrency(gross) : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-red-500 whitespace-nowrap">
                      {ded ? formatCurrency(ded) : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-green-500 whitespace-nowrap">
                      {formatCurrency(Number(s.amount))}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm whitespace-nowrap">
                      {s.bonus_amount ? (
                        <span className="text-amber-500">
                          {formatCurrency(Number(s.bonus_amount))}
                          <span className="text-muted-foreground text-xs ml-1">/ {(s.bonus_frequency ?? "yr").replace("annually", "yr").replace("quarterly", "qtr").replace("monthly", "mo")}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {s.active
                        ? <Badge variant="default" className="text-[10px]">Active</Badge>
                        : <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
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
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Income Source" : "Add Income Source"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. NSC Salary" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Gross ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Before deductions"
                  value={form.watch("gross_amount") ?? ""}
                  onChange={(e) => form.setValue("gross_amount", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Deductions ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={previewDeductions != null ? previewDeductions.toFixed(2) : "Auto or manual"}
                  value={form.watch("deductions") ?? ""}
                  onChange={(e) => form.setValue("deductions", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Net ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="Take-home" {...form.register("amount", { valueAsNumber: true })} />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
            </div>

            {/* Live preview */}
            {watchGross != null && watchGross > 0 && watchNet > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deductions (per paycheck)</span>
                  <span className="text-red-500">{formatCurrency(previewDeductions ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Effective tax + deductions rate</span>
                  <span>{((previewDeductions ?? 0) / watchGross * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}

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
