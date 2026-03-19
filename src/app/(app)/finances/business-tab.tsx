"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { ENGAGEMENT_STATUSES, DEFAULT_TAX_RATE } from "./constants"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type Engagement = Tables<"business_engagements">

const engagementSchema = z.object({
  client: z.string().min(1, "Client is required"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  amount: z.number().positive("Amount must be > 0"),
  tax_rate_pct: z.number().min(0).max(100),
  status: z.enum(["active", "completed", "paid"]),
})
type FormValues = z.infer<typeof engagementSchema>

interface BusinessTabProps {
  userId: string
  initialEngagements: Engagement[]
}

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="default">Active</Badge>
    case "completed":
      return <Badge variant="secondary">Completed</Badge>
    case "paid":
      return <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600/30">Paid</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function BusinessTab({ userId, initialEngagements }: BusinessTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [engagements, setEngagements] = useState<Engagement[]>(initialEngagements)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Engagement | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const filtered = useMemo(() => {
    if (filterStatus === "all") return engagements
    return engagements.filter((e) => e.status === filterStatus)
  }, [engagements, filterStatus])

  const totalBilled = engagements.reduce((s, e) => s + Number(e.amount), 0)
  const totalTaxes = engagements.reduce((s, e) => s + Number(e.taxes_owed ?? 0), 0)
  const netRevenue = engagements.reduce((s, e) => s + Number(e.revenue ?? 0), 0)
  const activeCount = engagements.filter((e) => e.status === "active").length

  const form = useForm<FormValues>({
    resolver: zodResolver(engagementSchema),
    defaultValues: {
      client: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      amount: 0,
      tax_rate_pct: DEFAULT_TAX_RATE * 100,
      status: "active",
    },
  })

  const watchAmount = form.watch("amount")
  const watchTaxPct = form.watch("tax_rate_pct")
  const previewTaxes = (watchAmount || 0) * ((watchTaxPct || 0) / 100)
  const previewRevenue = (watchAmount || 0) - previewTaxes

  function openAdd() {
    form.reset({
      client: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      amount: 0,
      tax_rate_pct: DEFAULT_TAX_RATE * 100,
      status: "active",
    })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(e: Engagement) {
    form.reset({
      client: e.client,
      description: e.description ?? "",
      date: e.date,
      amount: Number(e.amount),
      tax_rate_pct: Number(e.tax_rate) * 100,
      status: e.status as FormValues["status"],
    })
    setEditing(e)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      user_id: userId,
      client: values.client,
      description: values.description || null,
      date: values.date,
      amount: values.amount,
      tax_rate: values.tax_rate_pct / 100,
      status: values.status,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("business_engagements")
        .update(payload as never)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update engagement"); return }
      setEngagements((prev) => prev.map((e) => (e.id === editing.id ? data : e)))
      toast.success("Engagement updated")
    } else {
      const { data, error } = await supabase
        .from("business_engagements")
        .insert(payload as never)
        .select()
        .single()
      if (error) { toast.error("Failed to add engagement"); return }
      setEngagements((prev) => [data, ...prev])
      toast.success("Engagement added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("business_engagements").delete().eq("id", id)
    if (error) { toast.error("Failed to delete engagement"); setDeleting(null); return }
    setEngagements((prev) => prev.filter((e) => e.id !== id))
    toast.success("Engagement deleted")
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border p-3 flex-1 min-w-[140px]">
          <p className="text-xs text-muted-foreground">Total Billed</p>
          <p className="font-semibold text-lg">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="rounded-lg border p-3 flex-1 min-w-[140px]">
          <p className="text-xs text-muted-foreground">Total Taxes</p>
          <p className="font-semibold text-lg text-red-600 dark:text-red-400">{formatCurrency(totalTaxes)}</p>
        </div>
        <div className="rounded-lg border p-3 flex-1 min-w-[140px]">
          <p className="text-xs text-muted-foreground">Net Revenue</p>
          <p className="font-semibold text-lg text-green-600 dark:text-green-400">{formatCurrency(netRevenue)}</p>
        </div>
        <div className="rounded-lg border p-3 flex-1 min-w-[140px]">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="font-semibold text-lg">{activeCount}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {ENGAGEMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add Engagement
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No engagements found
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Tax Rate</TableHead>
                <TableHead className="hidden sm:table-cell">Taxes</TableHead>
                <TableHead className="hidden md:table-cell">Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm font-medium max-w-[180px] truncate">
                    {e.client}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(e.date)}
                  </TableCell>
                  <TableCell className="text-sm font-medium whitespace-nowrap">
                    {formatCurrency(Number(e.amount))}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {(Number(e.tax_rate) * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-red-600 dark:text-red-400 whitespace-nowrap">
                    {formatCurrency(Number(e.taxes_owed ?? 0))}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-green-600 dark:text-green-400 whitespace-nowrap">
                    {formatCurrency(Number(e.revenue ?? 0))}
                  </TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="!size-7 !min-h-0"
                        onClick={() => openEdit(e)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(e.id)}
                        disabled={deleting === e.id}
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
            <DialogTitle>{editing ? "Edit Engagement" : "Add Engagement"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Input placeholder="e.g. Acme Corp" {...form.register("client")} />
              {form.formState.errors.client && (
                <p className="text-xs text-destructive">{form.formState.errors.client.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Brief description (optional)" {...form.register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...form.register("date")} />
                {form.formState.errors.date && (
                  <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...form.register("amount", { valueAsNumber: true })} />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tax Rate (%)</Label>
                <Input type="number" step="0.1" min="0" max="100" {...form.register("tax_rate_pct", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as FormValues["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGAGEMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Live preview */}
            {watchAmount > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="text-red-600 dark:text-red-400">{formatCurrency(previewTaxes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(previewRevenue)}</span>
                </div>
              </div>
            )}

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
