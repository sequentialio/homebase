"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Plus,
  Target,
  CheckCircle2,
  Pause,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Minus,
  Bug,
  Lightbulb,
  Zap,
  MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ──────────────────────────────────────────────────────────────────────

type Goal = {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string
  target_amount: number | null
  current_amount: number | null
  target_date: string | null
  status: "active" | "achieved" | "paused"
  priority: "high" | "medium" | "low"
  created_at: string
  updated_at: string
}

type DevRequest = {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  category: "bug" | "improvement" | "feature" | "question"
  status: "open" | "in_progress" | "done" | "wont_fix"
  context: string | null
  created_at: string
}

const GOAL_CATEGORIES = ["Financial", "Personal", "Household", "Career", "Health", "Other"]
const STATUS_FILTERS = ["all", "active", "achieved", "paused"] as const
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function categoryColor(cat: string) {
  const map: Record<string, string> = {
    Financial: "text-green-500 border-green-500/30 bg-green-500/10",
    Personal: "text-purple-500 border-purple-500/30 bg-purple-500/10",
    Household: "text-orange-500 border-orange-500/30 bg-orange-500/10",
    Career: "text-blue-500 border-blue-500/30 bg-blue-500/10",
    Health: "text-red-500 border-red-500/30 bg-red-500/10",
    Other: "text-muted-foreground border-border bg-muted/50",
  }
  return map[cat] ?? map.Other
}

function priorityColor(p: string) {
  if (p === "high") return "text-red-500"
  if (p === "medium") return "text-yellow-500"
  return "text-muted-foreground"
}

function devCategoryIcon(cat: string) {
  if (cat === "bug") return <Bug className="size-3.5" />
  if (cat === "improvement") return <Lightbulb className="size-3.5" />
  if (cat === "feature") return <Zap className="size-3.5" />
  return <MessageSquare className="size-3.5" />
}

// ── Blank goal ─────────────────────────────────────────────────────────────────

const blankGoal = (): Partial<Goal> => ({
  title: "",
  description: "",
  category: "Financial",
  target_amount: undefined,
  current_amount: 0,
  target_date: undefined,
  status: "active",
  priority: "medium",
})

// ── GoalCard ───────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onStatusChange,
  onAmountUpdate,
}: {
  goal: Goal
  onEdit: (g: Goal) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Goal["status"]) => void
  onAmountUpdate: (id: string, delta: number) => void
}) {
  const hasAmount = goal.target_amount != null && goal.target_amount > 0
  const current = Number(goal.current_amount ?? 0)
  const target = Number(goal.target_amount ?? 1)
  const pct = hasAmount ? Math.min((current / target) * 100, 100) : 0
  const isAchieved = goal.status === "achieved"
  const isPaused = goal.status === "paused"

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3 transition-opacity",
      isAchieved && "opacity-60",
      isPaused && "opacity-70",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", categoryColor(goal.category))}>
              {goal.category}
            </Badge>
            {goal.priority === "high" && (
              <span className="text-xs text-red-500 font-medium">High priority</span>
            )}
            {isAchieved && (
              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                <CheckCircle2 className="size-3" /> Achieved
              </span>
            )}
            {isPaused && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <Pause className="size-3" /> Paused
              </span>
            )}
          </div>
          <h3 className={cn("font-semibold mt-1 leading-tight", isAchieved && "line-through text-muted-foreground")}>
            {goal.title}
          </h3>
          {goal.description && (
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{goal.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="!size-7 !min-h-0"
            onClick={() => onEdit(goal)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="!size-7 !min-h-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(goal.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {hasAmount && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {fmt(current)} <span className="text-muted-foreground">/ {fmt(target)}</span>
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                isAchieved ? "bg-green-500" : "bg-[var(--brand-lime)]"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{Math.round(pct)}% complete</span>
            {!isAchieved && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="!size-6 !min-h-0"
                  onClick={() => onAmountUpdate(goal.id, -100)}
                  title="−$100"
                >
                  <ChevronDown className="size-3" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="!size-6 !min-h-0"
                  onClick={() => onAmountUpdate(goal.id, 100)}
                  title="+$100"
                >
                  <ChevronUp className="size-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
        {goal.target_date ? (
          <span className="text-xs text-muted-foreground">Due {fmtDate(goal.target_date)}</span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          {goal.status !== "achieved" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 text-green-500 hover:text-green-400"
              onClick={() => onStatusChange(goal.id, "achieved")}
            >
              <CheckCircle2 className="size-3 mr-1" /> Mark achieved
            </Button>
          )}
          {goal.status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 text-muted-foreground"
              onClick={() => onStatusChange(goal.id, "paused")}
            >
              <Pause className="size-3 mr-1" /> Pause
            </Button>
          )}
          {goal.status === "paused" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={() => onStatusChange(goal.id, "active")}
            >
              Resume
            </Button>
          )}
          {goal.status === "achieved" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 text-muted-foreground"
              onClick={() => onStatusChange(goal.id, "active")}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── GoalDialog ─────────────────────────────────────────────────────────────────

function GoalDialog({
  open,
  goal,
  onClose,
  onSave,
}: {
  open: boolean
  goal: Partial<Goal>
  onClose: () => void
  onSave: (g: Partial<Goal>) => Promise<void>
}) {
  const [form, setForm] = useState<Partial<Goal>>(goal)
  const [saving, setSaving] = useState(false)

  // Sync when goal prop changes
  useEffect(() => { setForm(goal) }, [goal])

  const set = (k: keyof Goal, v: unknown) => setForm((p) => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.title?.trim()) return toast.error("Title is required")
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit Goal" : "Add Goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Pay off CalCoast loan"
              value={form.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              placeholder="More context about this goal..."
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category ?? "Financial"} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority ?? "medium"} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target Amount <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="number"
                placeholder="5000"
                value={form.target_amount ?? ""}
                onChange={(e) => set("target_amount", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Current Amount</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.current_amount ?? ""}
                onChange={(e) => set("current_amount", e.target.value ? Number(e.target.value) : 0)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target Date <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="date"
                value={form.target_date ?? ""}
                onChange={(e) => set("target_date", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? "active"} onValueChange={(v) => set("status", v as Goal["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="achieved">Achieved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : form.id ? "Save Changes" : "Add Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GoalsContent({
  initialGoals,
  initialDevRequests,
  userId,
}: {
  initialGoals: Goal[]
  initialDevRequests: DevRequest[]
  userId: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [devRequests] = useState<DevRequest[]>(initialDevRequests)
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("active")
  const [catFilter, setCatFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editGoal, setEditGoal] = useState<Partial<Goal>>(blankGoal())

  // Filtered + sorted goals
  const filtered = useMemo(() => {
    return goals
      .filter((g) => statusFilter === "all" || g.status === statusFilter)
      .filter((g) => catFilter === "all" || g.category === catFilter)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [goals, statusFilter, catFilter])

  const categories = useMemo(() => {
    const cats = [...new Set(goals.map((g) => g.category))]
    return cats.sort()
  }, [goals])

  // ── Stats ──────────────────────────────────────────────────────────────────

  const activeCount = goals.filter((g) => g.status === "active").length
  const achievedCount = goals.filter((g) => g.status === "achieved").length
  const totalTargetAmount = goals
    .filter((g) => g.status === "active" && g.target_amount)
    .reduce((s, g) => s + Number(g.target_amount), 0)
  const totalCurrentAmount = goals
    .filter((g) => g.status === "active" && g.target_amount)
    .reduce((s, g) => s + Number(g.current_amount ?? 0), 0)

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async function handleSave(form: Partial<Goal>) {
    const payload = {
      user_id: userId,
      title: form.title!.trim(),
      description: form.description?.trim() || null,
      category: form.category ?? "Financial",
      target_amount: form.target_amount ?? null,
      current_amount: form.current_amount ?? 0,
      target_date: form.target_date ?? null,
      status: form.status ?? "active",
      priority: form.priority ?? "medium",
      updated_at: new Date().toISOString(),
    }

    if (form.id) {
      const { data, error } = await (supabase as any)
        .from("goals").update(payload).eq("id", form.id).eq("user_id", userId).select().single()
      if (error) { toast.error("Failed to save goal"); return }
      setGoals((prev) => prev.map((g) => g.id === form.id ? data : g))
      toast.success("Goal updated")
    } else {
      const { data, error } = await (supabase as any)
        .from("goals").insert(payload).select().single()
      if (error) { toast.error("Failed to create goal"); return }
      setGoals((prev) => [data, ...prev])
      toast.success("Goal added")
    }
    setDialogOpen(false)
  }

  async function handleDelete(id: string) {
    const { error } = await (supabase as any).from("goals").delete().eq("id", id).eq("user_id", userId)
    if (error) { toast.error("Failed to delete goal"); return }
    setGoals((prev) => prev.filter((g) => g.id !== id))
    toast.success("Goal deleted")
  }

  async function handleStatusChange(id: string, status: Goal["status"]) {
    const { data, error } = await (supabase as any)
      .from("goals").update({ status, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", userId).select().single()
    if (error) { toast.error("Failed to update status"); return }
    setGoals((prev) => prev.map((g) => g.id === id ? data : g))
    if (status === "achieved") toast.success("Goal achieved!")
  }

  async function handleAmountUpdate(id: string, delta: number) {
    const goal = goals.find((g) => g.id === id)
    if (!goal) return
    const newAmount = Math.max(0, Number(goal.current_amount ?? 0) + delta)
    const { data, error } = await (supabase as any)
      .from("goals").update({ current_amount: newAmount, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", userId).select().single()
    if (error) { toast.error("Failed to update amount"); return }
    setGoals((prev) => prev.map((g) => g.id === id ? data : g))
  }

  function openAdd() {
    setEditGoal(blankGoal())
    setDialogOpen(true)
  }

  function openEdit(g: Goal) {
    setEditGoal(g)
    setDialogOpen(true)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="size-6 text-[var(--brand-lime)]" />
            Goals
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track what you&apos;re working toward</p>
        </div>
        <Button onClick={openAdd} className="bg-[var(--brand-lime)] text-black hover:bg-[var(--brand-lime)]/90 w-full sm:w-auto">
          <Plus className="size-4 mr-1" /> Add Goal
        </Button>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
            <p className="text-xl font-bold">{activeCount}</p>
          </div>
          <div className="rounded-lg border p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Achieved</p>
            <p className="text-xl font-bold text-green-500">{achievedCount}</p>
          </div>
          {totalTargetAmount > 0 && (
            <>
              <div className="rounded-lg border p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Saved</p>
                <p className="text-xl font-bold text-[var(--brand-lime)]">{fmt(totalCurrentAmount)}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Target</p>
                <p className="text-xl font-bold">{fmt(totalTargetAmount)}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium border transition-colors capitalize",
              statusFilter === f
                ? "bg-[var(--brand-lime)] text-black border-transparent"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
        {categories.length > 1 && (
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => setCatFilter("all")}
              className={cn(
                "px-3 py-1 rounded-full text-sm border transition-colors",
                catFilter === "all" ? "border-foreground/50 text-foreground" : "border-border text-muted-foreground"
              )}
            >
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm border transition-colors",
                  catFilter === c ? "border-foreground/50 text-foreground" : "border-border text-muted-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Goals grid ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No goals here</p>
          <p className="text-sm mt-1">
            {goals.length === 0
              ? "Add your first goal to start tracking progress"
              : "Try a different filter"}
          </p>
          {goals.length === 0 && (
            <Button onClick={openAdd} variant="outline" className="mt-4">
              <Plus className="size-4 mr-1" /> Add your first goal
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={openEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onAmountUpdate={handleAmountUpdate}
            />
          ))}
        </div>
      )}

      {/* ── Dev Requests (assistant → Claude Code) ──────────────────────────── */}
      {devRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Assistant Requests for Claude Code
            </h2>
            <Badge variant="outline" className="text-xs">{devRequests.length} open</Badge>
          </div>
          <div className="space-y-2">
            {devRequests.map((req) => (
              <div key={req.id} className="rounded-lg border p-3 flex items-start gap-3">
                <span className={cn("mt-0.5 shrink-0", priorityColor(req.priority))}>
                  {devCategoryIcon(req.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{req.title}</span>
                    <Badge variant="outline" className="text-xs capitalize">{req.category}</Badge>
                    <Badge
                      variant="outline"
                      className={cn("text-xs capitalize", priorityColor(req.priority))}
                    >
                      {req.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{req.description}</p>
                  {req.context && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{req.context}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(req.created_at)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            These are improvement requests logged by the assistant. Bring them to a Claude Code session to implement.
          </p>
        </div>
      )}

      {/* ── Dialog ──────────────────────────────────────────────────────────── */}
      <GoalDialog
        open={dialogOpen}
        goal={editGoal}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
