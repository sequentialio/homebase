"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { INSURANCE_TYPES } from "./constants"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

type InsurancePolicy = Tables<"insurance_policies">

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  provider: z.string().optional(),
  premium: z.string().optional(),
  renewal_date: z.string().optional(),
  notes: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

interface InsuranceTabProps {
  initialInsurancePolicies: InsurancePolicy[]
}

export function InsuranceTab({ initialInsurancePolicies }: InsuranceTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [policies, setPolicies] = useState<InsurancePolicy[]>(initialInsurancePolicies)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InsurancePolicy | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const totalMonthlyPremiums = policies.reduce((sum, p) => sum + Number(p.premium ?? 0), 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", type: "", provider: "", premium: "", renewal_date: "", notes: "" },
  })

  function openAdd() {
    form.reset({ name: "", type: "", provider: "", premium: "", renewal_date: "", notes: "" })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(p: InsurancePolicy) {
    form.reset({
      name: p.name,
      type: p.type,
      provider: p.provider ?? "",
      premium: p.premium != null ? String(p.premium) : "",
      renewal_date: p.renewal_date ?? "",
      notes: p.notes ?? "",
    })
    setEditing(p)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      type: values.type,
      provider: values.provider || null,
      premium: values.premium ? parseFloat(values.premium) : null,
      renewal_date: values.renewal_date || null,
      notes: values.notes || null,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("insurance_policies")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update policy"); return }
      setPolicies((prev) => prev.map((p) => (p.id === editing.id ? data : p)))
      toast.success("Policy updated")
    } else {
      const { data, error } = await supabase.from("insurance_policies").insert(payload).select().single()
      if (error) { toast.error("Failed to add policy"); return }
      setPolicies((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success("Policy added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("insurance_policies").delete().eq("id", id)
    if (error) { toast.error("Failed to delete policy"); setDeleting(null); return }
    setPolicies((prev) => prev.filter((p) => p.id !== id))
    toast.success("Policy deleted")
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total monthly premiums</p>
          <p className="text-2xl font-bold">{formatCurrency(totalMonthlyPremiums)}</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add Policy
        </Button>
      </div>

      {policies.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No insurance policies — add your first one
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {policies.map((p) => {
            const days = daysUntil(p.renewal_date)
            const renewingSoon = days != null && days >= 0 && days <= 30

            return (
              <div key={p.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{p.name}</p>
                        <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                        {renewingSoon && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500">
                            Renews in {days}d
                          </Badge>
                        )}
                      </div>
                      {p.provider && (
                        <p className="text-xs text-muted-foreground mt-0.5">{p.provider}</p>
                      )}
                      {p.premium != null && (
                        <p className="text-base font-bold mt-1">
                          {formatCurrency(Number(p.premium))}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => openEdit(p)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {p.renewal_date && (
                  <p className="text-xs text-muted-foreground">Renewal: {formatDate(p.renewal_date)}</p>
                )}
                {p.notes && (
                  <p className="text-xs text-muted-foreground border-t pt-2">{p.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Policy" : "Add Policy"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Policy Name</Label>
              <Input placeholder="e.g. Blue Shield Health Plan" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(v) => form.setValue("type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSURANCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Input placeholder="e.g. Blue Shield" {...form.register("provider")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly Premium ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...form.register("premium")} />
              </div>
              <div className="space-y-1.5">
                <Label>Renewal Date</Label>
                <Input type="date" {...form.register("renewal_date")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Coverage notes, policy number, etc." rows={2} {...form.register("notes")} />
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
