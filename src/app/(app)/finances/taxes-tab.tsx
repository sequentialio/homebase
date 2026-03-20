"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/format-utils"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, FileText, Calculator,
  CheckCircle2, Circle, TrendingUp, TrendingDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type TaxItem = {
  id: string
  user_id: string
  name: string
  type: string
  amount: number
  tax_year: number
  filed: boolean
  due_date: string | null
  notes: string | null
  form_source: string | null
  category: string | null
  section_id: string | null
  position: number
  created_at: string | null
}

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["income", "deduction", "credit", "payment", "other"]),
  amount: z.number().min(0),
  tax_year: z.number().int().min(2000).max(2100),
  filed: z.boolean(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  form_source: z.string().optional(),
  category: z.string().optional(),
})
type FormValues = z.infer<typeof itemSchema>

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  income: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  deduction: "text-green-500 bg-green-500/10 border-green-500/30",
  credit: "text-lime-500 bg-lime-500/10 border-lime-500/30",
  payment: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  other: "text-muted-foreground bg-muted border-border",
}

const FORM_SOURCES = ["W-2", "1098-E", "1095-C", "1099-NEC", "1099-INT", "1099-DIV", "Estimate", "Standard", "Manual"] as const

const QUICK_ADD_ITEMS: { name: string; type: string; form_source: string; category: string }[] = [
  { name: "W-2 Wages", type: "income", form_source: "W-2", category: "wages" },
  { name: "Federal Income Tax Withheld", type: "payment", form_source: "W-2", category: "federal" },
  { name: "Social Security Tax Withheld", type: "payment", form_source: "W-2", category: "fica" },
  { name: "Medicare Tax Withheld", type: "payment", form_source: "W-2", category: "fica" },
  { name: "State Income Tax Withheld", type: "payment", form_source: "W-2", category: "state" },
  { name: "CASDI", type: "payment", form_source: "W-2", category: "state" },
  { name: "403(b) Contributions", type: "deduction", form_source: "W-2", category: "retirement" },
  { name: "Student Loan Interest", type: "deduction", form_source: "1098-E", category: "student_loan" },
  { name: "Federal Standard Deduction", type: "deduction", form_source: "Standard", category: "standard" },
  { name: "Health Insurance (DD)", type: "deduction", form_source: "W-2", category: "health" },
  { name: "1099-NEC Income", type: "income", form_source: "1099-NEC", category: "business" },
]

// ── Federal tax brackets 2025 (Single) ────────────────────────────────────────

const FEDERAL_BRACKETS_2025 = [
  { max: 11925, rate: 0.10 },
  { max: 48475, rate: 0.12 },
  { max: 103350, rate: 0.22 },
  { max: 197300, rate: 0.24 },
  { max: 250525, rate: 0.32 },
  { max: 626350, rate: 0.35 },
  { max: Infinity, rate: 0.37 },
]

function computeFederalTax(taxableIncome: number): number {
  let tax = 0
  let remaining = taxableIncome
  let prevMax = 0
  for (const bracket of FEDERAL_BRACKETS_2025) {
    const bracketWidth = bracket.max - prevMax
    const taxable = Math.min(remaining, bracketWidth)
    tax += taxable * bracket.rate
    remaining -= taxable
    prevMax = bracket.max
    if (remaining <= 0) break
  }
  return tax
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TaxesTabProps {
  userId: string
  initialItems: TaxItem[]
  initialSections?: unknown[] // kept for compat, not used in new design
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TaxesTab({ userId, initialItems }: TaxesTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<TaxItem[]>(initialItems)
  const [viewYear, setViewYear] = useState(() => {
    // Default to year with most items, or current year
    const years = initialItems.map((i) => i.tax_year)
    const counts = years.reduce((acc, y) => ({ ...acc, [y]: (acc[y] ?? 0) + 1 }), {} as Record<number, number>)
    const best = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]
    return best ? Number(best[0]) : new Date().getFullYear()
  })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TaxItem | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [defaultType, setDefaultType] = useState<string>("income")

  const filtered = useMemo(() => items.filter((i) => i.tax_year === viewYear), [items, viewYear])

  const incomeItems = filtered.filter((i) => i.type === "income")
  const paymentItems = filtered.filter((i) => i.type === "payment")
  const deductionItems = filtered.filter((i) => i.type === "deduction")
  const creditItems = filtered.filter((i) => i.type === "credit")
  const otherItems = filtered.filter((i) => i.type === "other")

  // ── Computed summary ────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const grossIncome = incomeItems.reduce((s, i) => s + Number(i.amount), 0)

    // Above-the-line deductions (adjustments): retirement, student loan interest
    const adjustments = deductionItems
      .filter((i) => ["retirement", "student_loan", "health"].includes(i.category ?? ""))
      .reduce((s, i) => s + Number(i.amount), 0)

    const agi = grossIncome - adjustments

    // Standard or itemized deduction
    const standardDed = deductionItems
      .filter((i) => i.category === "standard")
      .reduce((s, i) => s + Number(i.amount), 0)
    const otherDed = deductionItems
      .filter((i) => !["retirement", "student_loan", "health", "standard"].includes(i.category ?? ""))
      .reduce((s, i) => s + Number(i.amount), 0)
    const totalDeductions = standardDed + otherDed

    const taxableIncome = Math.max(0, agi - totalDeductions)
    const estimatedFedLiability = computeFederalTax(taxableIncome)

    const fedWithheld = paymentItems
      .filter((i) => i.category === "federal")
      .reduce((s, i) => s + Number(i.amount), 0)
    const stateWithheld = paymentItems
      .filter((i) => i.category === "state")
      .reduce((s, i) => s + Number(i.amount), 0)
    const ficaWithheld = paymentItems
      .filter((i) => i.category === "fica")
      .reduce((s, i) => s + Number(i.amount), 0)
    const totalWithheld = paymentItems.reduce((s, i) => s + Number(i.amount), 0)

    const fedRefund = fedWithheld - estimatedFedLiability
    const credits = creditItems.reduce((s, i) => s + Number(i.amount), 0)

    const effectiveRate = grossIncome > 0 ? (estimatedFedLiability / grossIncome) * 100 : 0

    // Forms on file
    const forms = new Set(filtered.map((i) => i.form_source).filter(Boolean))

    return {
      grossIncome, adjustments, agi, totalDeductions, taxableIncome,
      estimatedFedLiability, fedWithheld, stateWithheld, ficaWithheld,
      totalWithheld, fedRefund, credits, effectiveRate, forms,
    }
  }, [incomeItems, paymentItems, deductionItems, creditItems, filtered])

  // ── Year options ────────────────────────────────────────────────────────────

  const yearOptions = useMemo(() => {
    const years = new Set(items.map((i) => i.tax_year))
    years.add(new Date().getFullYear())
    years.add(new Date().getFullYear() - 1)
    return Array.from(years).sort((a, b) => b - a)
  }, [items])

  // ── Form ────────────────────────────────────────────────────────────────────

  const form = useForm<FormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "", type: "income", amount: 0, tax_year: viewYear,
      filed: false, due_date: "", notes: "", form_source: "", category: "",
    },
  })

  function openAdd(type: string = "income") {
    form.reset({
      name: "", type: type as FormValues["type"], amount: 0, tax_year: viewYear,
      filed: false, due_date: "", notes: "", form_source: "", category: "",
    })
    setDefaultType(type)
    setEditing(null)
    setOpen(true)
  }

  function openQuickAdd(preset: typeof QUICK_ADD_ITEMS[number]) {
    form.reset({
      name: preset.name, type: preset.type as FormValues["type"], amount: 0, tax_year: viewYear,
      filed: false, due_date: "", notes: "", form_source: preset.form_source, category: preset.category,
    })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(item: TaxItem) {
    form.reset({
      name: item.name,
      type: item.type as FormValues["type"],
      amount: Number(item.amount),
      tax_year: item.tax_year,
      filed: item.filed,
      due_date: item.due_date ?? "",
      notes: item.notes ?? "",
      form_source: item.form_source ?? "",
      category: item.category ?? "",
    })
    setEditing(item)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      user_id: userId,
      name: values.name,
      type: values.type,
      amount: values.amount,
      tax_year: values.tax_year,
      filed: values.filed,
      due_date: values.due_date || null,
      notes: values.notes || null,
      form_source: values.form_source || null,
      category: values.category || null,
      position: 0,
    }

    if (editing) {
      const { data, error } = await (supabase as any).from("tax_items").update(payload).eq("id", editing.id).select().single()
      if (error) { toast.error("Failed to update"); return }
      setItems((prev) => prev.map((i) => (i.id === editing.id ? data : i)))
      toast.success("Tax item updated")
    } else {
      const { data, error } = await (supabase as any).from("tax_items").insert(payload).select().single()
      if (error) { toast.error("Failed to add"); return }
      setItems((prev) => [...prev, data])
      toast.success("Tax item added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await (supabase as any).from("tax_items").delete().eq("id", id)
    if (error) { toast.error("Failed to delete"); setDeleting(null); return }
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast.success("Deleted")
    setDeleting(null)
  }

  async function toggleFiled(item: TaxItem) {
    const newFiled = !item.filed
    await (supabase as any).from("tax_items").update({ filed: newFiled }).eq("id", item.id)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, filed: newFiled } : i)))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const allFiled = filtered.length > 0 && filtered.every((i) => i.filed)
  const filingDeadline = new Date(viewYear + 1, 3, 15) // April 15 of next year
  const daysUntilDeadline = Math.ceil((filingDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <div className="space-y-6">
      {/* Header: Year + Filing Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {allFiled ? (
            <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 gap-1">
              <CheckCircle2 className="size-3" /> Filed
            </Badge>
          ) : daysUntilDeadline > 0 ? (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10">
              {daysUntilDeadline} days until deadline
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10">
              Past deadline
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Select value="quick" onValueChange={(v) => {
            if (v === "quick") return
            const preset = QUICK_ADD_ITEMS.find((p) => p.name === v)
            if (preset) openQuickAdd(preset)
          }}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Quick add..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quick" disabled>Quick add...</SelectItem>
              {QUICK_ADD_ITEMS.map((p) => (
                <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="size-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      {/* Tax Summary Card */}
      {filtered.length > 0 && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Tax Summary — {viewYear}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            <SummaryRow label="Gross Income" value={summary.grossIncome} />
            {summary.adjustments > 0 && <SummaryRow label="Adjustments" value={-summary.adjustments} negative />}
            <SummaryRow label="AGI" value={summary.agi} bold />
            {summary.totalDeductions > 0 && <SummaryRow label="Deductions" value={-summary.totalDeductions} negative />}
            <SummaryRow label="Taxable Income" value={summary.taxableIncome} bold />
            <SummaryRow label="Est. Federal Tax" value={summary.estimatedFedLiability} negative />
            <SummaryRow label="Federal Withheld" value={summary.fedWithheld} />
            <div className="rounded-lg border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase">Est. Refund / Owed</p>
              <p className={cn("font-bold", summary.fedRefund >= 0 ? "text-green-500" : "text-red-500")}>
                {summary.fedRefund >= 0 ? (
                  <span className="flex items-center gap-1"><TrendingUp className="size-3" /> {formatCurrency(summary.fedRefund)}</span>
                ) : (
                  <span className="flex items-center gap-1"><TrendingDown className="size-3" /> {formatCurrency(Math.abs(summary.fedRefund))}</span>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground">{summary.fedRefund >= 0 ? "Refund" : "Owed"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t">
            <span>State withheld: {formatCurrency(summary.stateWithheld)}</span>
            <span>FICA: {formatCurrency(summary.ficaWithheld)}</span>
            <span>Total withheld: {formatCurrency(summary.totalWithheld)}</span>
            <span>Effective rate: {summary.effectiveRate.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Income Section */}
      <TaxSection
        title="Income"
        icon={<Badge variant="outline" className={TYPE_COLORS.income}>Income</Badge>}
        items={incomeItems}
        onAdd={() => openAdd("income")}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleFiled={toggleFiled}
        deleting={deleting}
      />

      {/* Withholdings & Payments Section */}
      <TaxSection
        title="Withholdings & Payments"
        icon={<Badge variant="outline" className={TYPE_COLORS.payment}>Payments</Badge>}
        items={paymentItems}
        onAdd={() => openAdd("payment")}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleFiled={toggleFiled}
        deleting={deleting}
      />

      {/* Deductions & Adjustments Section */}
      <TaxSection
        title="Deductions & Adjustments"
        icon={<Badge variant="outline" className={TYPE_COLORS.deduction}>Deductions</Badge>}
        items={deductionItems}
        onAdd={() => openAdd("deduction")}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleFiled={toggleFiled}
        deleting={deleting}
      />

      {/* Credits Section */}
      {(creditItems.length > 0 || otherItems.length > 0) && (
        <>
          {creditItems.length > 0 && (
            <TaxSection
              title="Credits"
              icon={<Badge variant="outline" className={TYPE_COLORS.credit}>Credits</Badge>}
              items={creditItems}
              onAdd={() => openAdd("credit")}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggleFiled={toggleFiled}
              deleting={deleting}
            />
          )}
          {otherItems.length > 0 && (
            <TaxSection
              title="Estimates & Other"
              icon={<Badge variant="outline" className={TYPE_COLORS.other}>Other</Badge>}
              items={otherItems}
              onAdd={() => openAdd("other")}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggleFiled={toggleFiled}
              deleting={deleting}
            />
          )}
        </>
      )}

      {/* Forms on File */}
      {summary.forms.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="size-4" /> Forms on File
          </h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(summary.forms).sort().map((f) => (
              <Badge key={f} variant="outline" className="gap-1">
                <CheckCircle2 className="size-3 text-green-500" /> {f}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No tax items for {viewYear} — add your W-2 data or use the assistant
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tax Item" : "Add Tax Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. W-2 Wages" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as FormValues["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="payment">Payment / Withholding</SelectItem>
                    <SelectItem value="other">Other / Estimate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min="0" {...form.register("amount", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tax Year</Label>
                <Input type="number" min="2000" max="2100" {...form.register("tax_year", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Form Source</Label>
                <Select
                  value={form.watch("form_source") || "none"}
                  onValueChange={(v) => form.setValue("form_source", v === "none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {FORM_SOURCES.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input placeholder="e.g. federal, state, fica" {...form.register("category")} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" {...form.register("due_date")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Optional notes" {...form.register("notes")} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="tax-filed"
                checked={form.watch("filed")}
                onCheckedChange={(v) => form.setValue("filed", v)}
              />
              <Label htmlFor="tax-filed" className="cursor-pointer">Filed / Claimed</Label>
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

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryRow({ label, value, negative, bold }: { label: string; value: number; negative?: boolean; bold?: boolean }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className={cn("font-semibold", bold && "font-bold", negative && "text-red-500")}>
        {negative && value > 0 ? "-" : ""}{formatCurrency(Math.abs(value))}
      </p>
    </div>
  )
}

function TaxSection({
  title,
  icon,
  items,
  onAdd,
  onEdit,
  onDelete,
  onToggleFiled,
  deleting,
}: {
  title: string
  icon: React.ReactNode
  items: TaxItem[]
  onAdd: () => void
  onEdit: (item: TaxItem) => void
  onDelete: (id: string) => void
  onToggleFiled: (item: TaxItem) => void
  deleting: string | null
}) {
  const total = items.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {icon}
          <span className="text-xs text-muted-foreground">{formatCurrency(total)}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onAdd}>
          <Plus className="size-3" /> Add
        </Button>
      </div>
      {items.length > 0 ? (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Description</TableHead>
                <TableHead className="hidden sm:table-cell">Form</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className={item.filed ? "opacity-60" : undefined}>
                  <TableCell>
                    <button onClick={() => onToggleFiled(item)} className="text-muted-foreground hover:text-foreground">
                      {item.filed
                        ? <CheckCircle2 className="size-4 text-green-500" />
                        : <Circle className="size-4" />
                      }
                    </button>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    <div>
                      {item.name}
                      {item.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.notes}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {item.form_source || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground capitalize">
                    {item.category?.replace("_", " ") || "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                    {formatCurrency(Number(item.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => onEdit(item)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                        onClick={() => onDelete(item.id)}
                        disabled={deleting === item.id}
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
      ) : (
        <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
          No {title.toLowerCase()} items
        </div>
      )}
    </div>
  )
}
