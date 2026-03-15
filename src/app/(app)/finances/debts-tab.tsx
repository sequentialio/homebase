"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Tables } from "@/types/database"

type Debt = Tables<"debts">

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  balance: z.number().min(0),
  interest_rate: z.string().optional(),
  min_payment: z.string().optional(),
  payoff_date: z.string().optional(),
  notes: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface DebtsTabProps {
  initialDebts: Debt[]
}

export function DebtsTab({ initialDebts }: DebtsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [debts, setDebts] = useState<Debt[]>(initialDebts)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const totalDebt = debts.reduce((sum, d) => sum + Number(d.balance), 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", balance: 0, interest_rate: "", min_payment: "", payoff_date: "", notes: "" },
  })

  function openAdd() {
    form.reset({ name: "", balance: 0, interest_rate: "", min_payment: "", payoff_date: "", notes: "" })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(d: Debt) {
    form.reset({
      name: d.name,
      balance: Number(d.balance),
      interest_rate: d.interest_rate != null ? String(d.interest_rate) : "",
      min_payment: d.min_payment != null ? String(d.min_payment) : "",
      payoff_date: d.payoff_date ?? "",
      notes: d.notes ?? "",
    })
    setEditing(d)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      balance: values.balance,
      interest_rate: values.interest_rate ? parseFloat(values.interest_rate) : null,
      min_payment: values.min_payment ? parseFloat(values.min_payment) : null,
      payoff_date: values.payoff_date || null,
      notes: values.notes || null,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("debts")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update debt"); return }
      setDebts((prev) => prev.map((d) => (d.id === editing.id ? data : d)))
      toast.success("Debt updated")
    } else {
      const { data, error } = await supabase.from("debts").insert(payload).select().single()
      if (error) { toast.error("Failed to add debt"); return }
      setDebts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success("Debt added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("debts").delete().eq("id", id)
    if (error) { toast.error("Failed to delete debt"); setDeleting(null); return }
    setDebts((prev) => prev.filter((d) => d.id !== id))
    toast.success("Debt deleted")
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total debt</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDebt)}</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add Debt
        </Button>
      </div>

      {debts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No debts tracked — add a loan or credit card
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {debts.map((d) => (
            <div key={d.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CreditCard className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{d.name}</p>
                    <p className="text-lg font-bold text-destructive mt-0.5">
                      {formatCurrency(Number(d.balance))}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => openEdit(d)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(d.id)}
                    disabled={deleting === d.id}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {d.interest_rate != null && (
                  <span>APR: {Number(d.interest_rate)}%</span>
                )}
                {d.min_payment != null && (
                  <span>Min: {formatCurrency(Number(d.min_payment))}/mo</span>
                )}
                {d.payoff_date && (
                  <span>Payoff: {formatDate(d.payoff_date)}</span>
                )}
              </div>
              {d.notes && (
                <p className="text-xs text-muted-foreground border-t pt-2">{d.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Debt" : "Add Debt"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Chase Sapphire, Student Loan" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Balance ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...form.register("balance", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Interest Rate (%)</Label>
                <Input type="number" step="0.01" min="0" placeholder="e.g. 19.99" {...form.register("interest_rate")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min Payment ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...form.register("min_payment")} />
              </div>
              <div className="space-y-1.5">
                <Label>Payoff Date</Label>
                <Input type="date" {...form.register("payoff_date")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Any notes..." rows={2} {...form.register("notes")} />
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
