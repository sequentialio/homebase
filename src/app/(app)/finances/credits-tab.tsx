"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { CREDIT_ACCOUNT_TYPES, CREDIT_ACCOUNT_TYPE_LABELS, RATING_COLORS } from "./constants"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, CreditCard, Building2, Link2 } from "lucide-react"
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
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type CreditAccount = {
  id: string
  user_id: string
  name: string
  type: string
  balance: number
  credit_limit: number | null
  opened_date: string | null
  status: string
  lender: string | null
  notes: string | null
  linked_debt_id: string | null
  created_at: string
}

type CreditProfile = {
  id: string
  user_id: string
  score: number | null
  score_source: string | null
  payment_history_pct: number | null
  payment_history_rating: string | null
  credit_card_use_pct: number | null
  credit_card_use_rating: string | null
  derogatory_marks: number | null
  derogatory_marks_rating: string | null
  credit_age_years: number | null
  credit_age_months: number | null
  credit_age_rating: string | null
  total_accounts: number | null
  total_accounts_rating: string | null
  hard_inquiries: number | null
  hard_inquiries_rating: string | null
  last_updated: string | null
  created_at: string
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1),
  balance: z.number().min(0),
  credit_limit: z.number().min(0).nullable(),
  opened_date: z.string().optional(),
  status: z.enum(["open", "closed"]),
  lender: z.string().optional(),
})
type AccountFormValues = z.infer<typeof accountSchema>

const profileSchema = z.object({
  score: z.number().min(300).max(850),
  score_source: z.string(),
  payment_history_pct: z.number().min(0).max(100).nullable(),
  payment_history_rating: z.string().nullable(),
  credit_card_use_pct: z.number().min(0).max(100).nullable(),
  credit_card_use_rating: z.string().nullable(),
  derogatory_marks: z.number().min(0).nullable(),
  derogatory_marks_rating: z.string().nullable(),
  credit_age_years: z.number().min(0).nullable(),
  credit_age_months: z.number().min(0).max(11).nullable(),
  credit_age_rating: z.string().nullable(),
  total_accounts: z.number().min(0).nullable(),
  total_accounts_rating: z.string().nullable(),
  hard_inquiries: z.number().min(0).nullable(),
  hard_inquiries_rating: z.string().nullable(),
})
type ProfileFormValues = z.infer<typeof profileSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface CreditsTabProps {
  userId: string
  initialAccounts: CreditAccount[]
  initialProfile: CreditProfile | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RATINGS = ["Excellent", "Good", "Fair", "Needs work", "Poor"]

function scoreColor(score: number): string {
  if (score >= 740) return "text-green-500"
  if (score >= 670) return "text-lime-500"
  if (score >= 580) return "text-yellow-500"
  return "text-red-500"
}

function scoreBg(score: number): string {
  if (score >= 740) return "from-green-500/20 to-green-500/5"
  if (score >= 670) return "from-lime-500/20 to-lime-500/5"
  if (score >= 580) return "from-yellow-500/20 to-yellow-500/5"
  return "from-red-500/20 to-red-500/5"
}

function scoreLabel(score: number): string {
  if (score >= 740) return "Excellent"
  if (score >= 670) return "Good"
  if (score >= 580) return "Fair"
  return "Poor"
}

function utilizationColor(pct: number): string {
  if (pct < 30) return "text-green-500"
  if (pct < 50) return "text-yellow-500"
  if (pct < 75) return "text-orange-500"
  return "text-red-500"
}

function utilizationBg(pct: number): string {
  if (pct < 30) return "bg-green-500"
  if (pct < 50) return "bg-yellow-500"
  if (pct < 75) return "bg-orange-500"
  return "bg-red-500"
}

function ratingBadge(rating: string | null) {
  if (!rating) return null
  const colors = RATING_COLORS[rating] ?? "text-muted-foreground bg-muted border-border"
  return <Badge variant="outline" className={cn("text-[10px]", colors)}>{rating}</Badge>
}

function impactLabel(rating: string | null): string {
  if (!rating) return ""
  if (rating === "Excellent" || rating === "Good") return "High impact"
  if (rating === "Fair") return "Low impact"
  if (rating === "Needs work") return "Medium impact"
  return "High impact"
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CreditsTab({ userId, initialAccounts, initialProfile }: CreditsTabProps) {
  const supabase = useMemo(() => createClient(), [])

  const [accounts, setAccounts] = useState<CreditAccount[]>(initialAccounts)
  const [profile, setProfile] = useState<CreditProfile | null>(initialProfile)

  // Account dialog
  const [accountOpen, setAccountOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CreditAccount | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Profile dialog
  const [profileOpen, setProfileOpen] = useState(false)

  const creditCards = accounts.filter((a) => a.type === "credit_card" && a.status === "open")
  const loans = accounts.filter((a) => a.type !== "credit_card" && a.status === "open")
  const closedAccounts = accounts.filter((a) => a.status === "closed")

  const totalCreditUsed = creditCards.reduce((s, a) => s + Number(a.balance), 0)
  const totalCreditLimit = creditCards.reduce((s, a) => s + Number(a.credit_limit ?? 0), 0)
  const overallUtilization = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0
  const totalLoanBalance = loans.reduce((s, a) => s + Number(a.balance), 0)

  // ── Account form ──────────────────────────────────────────────────────────

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", type: "credit_card", balance: 0, credit_limit: null, opened_date: "", status: "open", lender: "" },
  })

  function openAddAccount() {
    accountForm.reset({ name: "", type: "credit_card", balance: 0, credit_limit: null, opened_date: "", status: "open", lender: "" })
    setEditingAccount(null)
    setAccountOpen(true)
  }

  function openEditAccount(a: CreditAccount) {
    accountForm.reset({
      name: a.name,
      type: a.type,
      balance: Number(a.balance),
      credit_limit: a.credit_limit != null ? Number(a.credit_limit) : null,
      opened_date: a.opened_date ?? "",
      status: a.status as "open" | "closed",
      lender: a.lender ?? "",
    })
    setEditingAccount(a)
    setAccountOpen(true)
  }

  async function onAccountSubmit(values: AccountFormValues) {
    const payload = {
      user_id: userId,
      name: values.name,
      type: values.type,
      balance: values.balance,
      credit_limit: values.type === "credit_card" ? (values.credit_limit ?? null) : null,
      opened_date: values.opened_date || null,
      status: values.status,
      lender: values.lender || null,
    }

    if (editingAccount) {
      const { data, error } = await (supabase as any).from("credit_accounts").update(payload as never).eq("id", editingAccount.id).select().single()
      if (error) { toast.error("Failed to update account"); return }
      setAccounts((prev) => prev.map((a) => (a.id === editingAccount.id ? (data as CreditAccount) : a)))
      toast.success("Account updated")
    } else {
      const { data, error } = await (supabase as any).from("credit_accounts").insert(payload as never).select().single()
      if (error) { toast.error("Failed to add account"); return }
      setAccounts((prev) => [...prev, data as CreditAccount].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success("Account added")
    }
    setAccountOpen(false)
  }

  async function handleDeleteAccount(id: string) {
    setDeleting(id)
    const { error } = await (supabase as any).from("credit_accounts").delete().eq("id", id)
    if (error) { toast.error("Failed to delete"); setDeleting(null); return }
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    toast.success("Account deleted")
    setDeleting(null)
  }

  // ── Profile form ──────────────────────────────────────────────────────────

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      score: profile?.score ?? 0,
      score_source: profile?.score_source ?? "TransUnion",
      payment_history_pct: profile?.payment_history_pct ?? null,
      payment_history_rating: profile?.payment_history_rating ?? null,
      credit_card_use_pct: profile?.credit_card_use_pct ?? null,
      credit_card_use_rating: profile?.credit_card_use_rating ?? null,
      derogatory_marks: profile?.derogatory_marks ?? null,
      derogatory_marks_rating: profile?.derogatory_marks_rating ?? null,
      credit_age_years: profile?.credit_age_years ?? null,
      credit_age_months: profile?.credit_age_months ?? null,
      credit_age_rating: profile?.credit_age_rating ?? null,
      total_accounts: profile?.total_accounts ?? null,
      total_accounts_rating: profile?.total_accounts_rating ?? null,
      hard_inquiries: profile?.hard_inquiries ?? null,
      hard_inquiries_rating: profile?.hard_inquiries_rating ?? null,
    },
  })

  function openEditProfile() {
    if (profile) {
      profileForm.reset({
        score: profile.score ?? 0,
        score_source: profile.score_source ?? "TransUnion",
        payment_history_pct: profile.payment_history_pct,
        payment_history_rating: profile.payment_history_rating,
        credit_card_use_pct: profile.credit_card_use_pct,
        credit_card_use_rating: profile.credit_card_use_rating,
        derogatory_marks: profile.derogatory_marks,
        derogatory_marks_rating: profile.derogatory_marks_rating,
        credit_age_years: profile.credit_age_years,
        credit_age_months: profile.credit_age_months,
        credit_age_rating: profile.credit_age_rating,
        total_accounts: profile.total_accounts,
        total_accounts_rating: profile.total_accounts_rating,
        hard_inquiries: profile.hard_inquiries,
        hard_inquiries_rating: profile.hard_inquiries_rating,
      })
    }
    setProfileOpen(true)
  }

  async function onProfileSubmit(values: ProfileFormValues) {
    const payload = {
      user_id: userId,
      ...values,
      last_updated: new Date().toISOString().split("T")[0],
    }

    if (profile) {
      const { data, error } = await (supabase as any).from("credit_profile").update(payload as never).eq("id", profile.id).select().single()
      if (error) { toast.error("Failed to update profile"); return }
      setProfile(data as CreditProfile)
      toast.success("Credit profile updated")
    } else {
      const { data, error } = await (supabase as any).from("credit_profile").insert(payload as never).select().single()
      if (error) { toast.error("Failed to create profile"); return }
      setProfile(data as CreditProfile)
      toast.success("Credit profile created")
    }
    setProfileOpen(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      {profile?.score ? (
        <div className={cn("rounded-xl border p-5 bg-gradient-to-br", scoreBg(profile.score))}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Credit Score</p>
              <p className={cn("text-5xl font-bold mt-1", scoreColor(profile.score))}>{profile.score}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn("text-xs", RATING_COLORS[scoreLabel(profile.score)])}>{scoreLabel(profile.score)}</Badge>
                <span className="text-xs text-muted-foreground">{profile.score_source}</span>
                {profile.last_updated && (
                  <span className="text-xs text-muted-foreground">Updated {formatDate(profile.last_updated)}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openEditProfile}>Update Score</Button>
              <Button size="sm" onClick={openAddAccount}>
                <Plus className="size-4 mr-1" /> Add Account
              </Button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-lg border bg-card/50 p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase">Credit Used</p>
              <p className="font-semibold">{formatCurrency(totalCreditUsed)}</p>
              <p className="text-xs text-muted-foreground">of {formatCurrency(totalCreditLimit)}</p>
            </div>
            <div className="rounded-lg border bg-card/50 p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase">Utilization</p>
              <p className={cn("font-semibold", utilizationColor(overallUtilization))}>{overallUtilization.toFixed(0)}%</p>
            </div>
            <div className="rounded-lg border bg-card/50 p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase">Loan Balance</p>
              <p className="font-semibold">{formatCurrency(totalLoanBalance)}</p>
            </div>
            <div className="rounded-lg border bg-card/50 p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase">Open Accounts</p>
              <p className="font-semibold">{creditCards.length + loans.length}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm mb-3">No credit profile yet</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={openEditProfile}>Add Credit Score</Button>
            <Button size="sm" onClick={openAddAccount}>
              <Plus className="size-4 mr-1" /> Add Account
            </Button>
          </div>
        </div>
      )}

      {/* Score Factors */}
      {profile?.score && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FactorCard label="Payment history" value={profile.payment_history_pct != null ? `${profile.payment_history_pct}%` : "—"} rating={profile.payment_history_rating} />
          <FactorCard label="Credit card use" value={profile.credit_card_use_pct != null ? `${profile.credit_card_use_pct}%` : "—"} rating={profile.credit_card_use_rating} />
          <FactorCard label="Derogatory marks" value={profile.derogatory_marks != null ? String(profile.derogatory_marks) : "—"} rating={profile.derogatory_marks_rating} />
          <FactorCard label="Credit age" value={profile.credit_age_years != null ? `${profile.credit_age_years} yrs, ${profile.credit_age_months ?? 0} mos` : "—"} rating={profile.credit_age_rating} />
          <FactorCard label="Total accounts" value={profile.total_accounts != null ? String(profile.total_accounts) : "—"} rating={profile.total_accounts_rating} />
          <FactorCard label="Hard inquiries" value={profile.hard_inquiries != null ? String(profile.hard_inquiries) : "—"} rating={profile.hard_inquiries_rating} />
        </div>
      )}

      {/* Credit Cards Table */}
      {creditCards.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="size-4" /> Credit Cards
          </h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="hidden sm:table-cell">Limit</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead className="hidden md:table-cell">Opened</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditCards.map((a) => {
                  const util = a.credit_limit ? (Number(a.balance) / Number(a.credit_limit)) * 100 : 0
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{a.name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {formatCurrency(Number(a.balance))}
                          {a.linked_debt_id && <span title="Synced with Debts tab"><Link2 className="size-3 text-muted-foreground" /></span>}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {a.credit_limit ? formatCurrency(Number(a.credit_limit)) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div className={cn("h-full rounded-full", utilizationBg(util))} style={{ width: `${Math.min(util, 100)}%` }} />
                          </div>
                          <span className={cn("text-sm font-medium", utilizationColor(util))}>{util.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {a.opened_date ? formatDate(a.opened_date) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => openEditAccount(a)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="!size-7 !min-h-0 text-destructive hover:text-destructive" onClick={() => handleDeleteAccount(a.id)} disabled={deleting === a.id}>
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
        </div>
      )}

      {/* Loans Table */}
      {loans.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="size-4" /> Loans
          </h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden md:table-cell">Opened</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-sm">{a.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{CREDIT_ACCOUNT_TYPE_LABELS[a.type] ?? a.type}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {formatCurrency(Number(a.balance))}
                        {a.linked_debt_id && <span title="Synced with Debts tab"><Link2 className="size-3 text-muted-foreground" /></span>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={a.status === "open" ? "default" : "secondary"} className="text-[10px]">
                        {a.status === "open" ? "Open" : "Closed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {a.opened_date ? formatDate(a.opened_date) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => openEditAccount(a)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="!size-7 !min-h-0 text-destructive hover:text-destructive" onClick={() => handleDeleteAccount(a.id)} disabled={deleting === a.id}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Closed Accounts */}
      {closedAccounts.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Show closed ({closedAccounts.length})
          </summary>
          <div className="mt-2 space-y-2">
            {closedAccounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2 opacity-60">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{CREDIT_ACCOUNT_TYPE_LABELS[a.type] ?? a.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">Closed</Badge>
                  <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => openEditAccount(a)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="!size-7 !min-h-0 text-destructive hover:text-destructive" onClick={() => handleDeleteAccount(a.id)} disabled={deleting === a.id}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {accounts.length === 0 && !profile && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No credit accounts yet — add your credit cards and loans above
        </div>
      )}

      {/* Account Dialog */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Add Credit Account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account Name</Label>
                <Input placeholder="e.g. CA COAST CU" {...accountForm.register("name")} />
                {accountForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{accountForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={accountForm.watch("type")} onValueChange={(v) => accountForm.setValue("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREDIT_ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{CREDIT_ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Balance ($)</Label>
                <Input type="number" step="0.01" min="0" {...accountForm.register("balance", { valueAsNumber: true })} />
              </div>
              {accountForm.watch("type") === "credit_card" && (
                <div className="space-y-1.5">
                  <Label>Credit Limit ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={accountForm.watch("credit_limit") ?? ""}
                    onChange={(e) => accountForm.setValue("credit_limit", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Opened Date</Label>
                <Input type="date" {...accountForm.register("opened_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={accountForm.watch("status")} onValueChange={(v) => accountForm.setValue("status", v as "open" | "closed")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Lender</Label>
              <Input placeholder="Institution name (optional)" {...accountForm.register("lender")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccountOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={accountForm.formState.isSubmitting}>
                {accountForm.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Credit Score</DialogTitle>
          </DialogHeader>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Credit Score</Label>
                <Input type="number" min="300" max="850" {...profileForm.register("score", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={profileForm.watch("score_source")} onValueChange={(v) => profileForm.setValue("score_source", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TransUnion">TransUnion</SelectItem>
                    <SelectItem value="Equifax">Equifax</SelectItem>
                    <SelectItem value="Experian">Experian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Score Factors</p>

            <FactorFormRow
              label="Payment History"
              valueName="payment_history_pct"
              ratingName="payment_history_rating"
              form={profileForm}
              suffix="%"
            />
            <FactorFormRow
              label="Credit Card Use"
              valueName="credit_card_use_pct"
              ratingName="credit_card_use_rating"
              form={profileForm}
              suffix="%"
            />
            <FactorFormRow
              label="Derogatory Marks"
              valueName="derogatory_marks"
              ratingName="derogatory_marks_rating"
              form={profileForm}
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Credit Age (years)</Label>
                <Input
                  type="number"
                  min="0"
                  value={profileForm.watch("credit_age_years") ?? ""}
                  onChange={(e) => profileForm.setValue("credit_age_years", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Months</Label>
                <Input
                  type="number"
                  min="0"
                  max="11"
                  value={profileForm.watch("credit_age_months") ?? ""}
                  onChange={(e) => profileForm.setValue("credit_age_months", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rating</Label>
                <Select
                  value={profileForm.watch("credit_age_rating") ?? "none"}
                  onValueChange={(v) => profileForm.setValue("credit_age_rating", v === "none" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {RATINGS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <FactorFormRow
              label="Total Accounts"
              valueName="total_accounts"
              ratingName="total_accounts_rating"
              form={profileForm}
            />
            <FactorFormRow
              label="Hard Inquiries"
              valueName="hard_inquiries"
              ratingName="hard_inquiries_rating"
              form={profileForm}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                {profileForm.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FactorCard({ label, value, rating }: { label: string; value: string; rating: string | null }) {
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {ratingBadge(rating)}
        <span className="text-[10px] text-muted-foreground">{impactLabel(rating)}</span>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FactorFormRow({ label, valueName, ratingName, form, suffix }: { label: string; valueName: string; ratingName: string; form: any; suffix?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>{label}{suffix ? ` (${suffix})` : ""}</Label>
        <Input
          type="number"
          min="0"
          value={form.watch(valueName) ?? ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue(valueName, e.target.value ? Number(e.target.value) : null)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Rating</Label>
        <Select
          value={form.watch(ratingName) ?? "none"}
          onValueChange={(v: string) => form.setValue(ratingName, v === "none" ? null : v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {RATINGS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
