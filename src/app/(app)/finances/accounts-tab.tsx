"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/format-utils"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Landmark } from "lucide-react"
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
import type { Tables } from "@/types/database"

type BankAccount = Tables<"bank_accounts">

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  balance: z.number(),
  currency: z.string().min(1, "Currency is required"),
})
type FormValues = z.infer<typeof schema>

interface AccountsTabProps {
  userId: string
  initialAccounts: BankAccount[]
}

export function AccountsTab({ userId, initialAccounts }: AccountsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [accounts, setAccounts] = useState<BankAccount[]>(initialAccounts)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BankAccount | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", balance: 0, currency: "USD" },
  })

  function openAdd() {
    form.reset({ name: "", balance: 0, currency: "USD" })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(a: BankAccount) {
    form.reset({ name: a.name, balance: Number(a.balance), currency: a.currency ?? "USD" })
    setEditing(a)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      user_id: userId,
      name: values.name,
      balance: values.balance,
      currency: values.currency,
      last_updated: new Date().toISOString(),
    }

    if (editing) {
      const { data, error } = await supabase
        .from("bank_accounts")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update account"); return }
      setAccounts((prev) => prev.map((a) => (a.id === editing.id ? data : a)))
      toast.success("Account updated")
    } else {
      const { data, error } = await supabase
        .from("bank_accounts")
        .insert(payload)
        .select()
        .single()
      if (error) { toast.error("Failed to add account"); return }
      setAccounts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success("Account added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id)
    if (error) { toast.error("Failed to delete account"); setDeleting(null); return }
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    toast.success("Account deleted")
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total balance</p>
          <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No accounts yet — add your first bank account
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-lg border p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Landmark className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">{a.name}</p>
                  <p className="text-lg font-bold mt-0.5">{formatCurrency(Number(a.balance), a.currency ?? "USD")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Updated {new Date(a.last_updated).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => openEdit(a)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(a.id)}
                  disabled={deleting === a.id}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Account" : "Add Account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input placeholder="e.g. Chase Checking" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Balance</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...form.register("balance", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input placeholder="USD" {...form.register("currency")} />
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
