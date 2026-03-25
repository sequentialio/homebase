"use client"

import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Bug, Lightbulb, Sparkles, HelpCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type DevRequest = {
  id: string
  title: string
  description: string
  category: "bug" | "improvement" | "feature" | "question"
  priority: "high" | "medium" | "low"
  status: "open" | "in_progress" | "done" | "wont_fix"
  context?: string | null
  created_at: string
}

interface DevRequestsTabProps {
  userId: string
  initialRequests: DevRequest[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_ICON = {
  bug: Bug,
  improvement: Lightbulb,
  feature: Sparkles,
  question: HelpCircle,
}

const CATEGORY_COLOR = {
  bug: "text-red-400",
  improvement: "text-blue-400",
  feature: "text-purple-400",
  question: "text-yellow-400",
}

const PRIORITY_BADGE = {
  high: "bg-red-500/15 text-red-400 border-red-500/20",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  low: "bg-muted text-muted-foreground border-border",
}

const STATUS_OPTIONS: { value: DevRequest["status"]; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "wont_fix", label: "Won't Fix" },
]

const STATUS_STYLE = {
  open: "bg-primary/10 text-primary border-primary/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  done: "bg-green-500/15 text-green-400 border-green-500/20",
  wont_fix: "bg-muted text-muted-foreground border-border",
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DevRequestsTab({ userId, initialRequests }: DevRequestsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [requests, setRequests] = useState<DevRequest[]>(initialRequests)
  const [filter, setFilter] = useState<"open" | "in_progress" | "done" | "wont_fix" | "all">("open")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const list = filter === "all" ? requests : requests.filter((r) => r.status === filter)
    const order = { high: 0, medium: 1, low: 2 }
    return [...list].sort((a, b) => order[a.priority] - order[b.priority])
  }, [requests, filter])

  const counts = useMemo(() => ({
    open: requests.filter((r) => r.status === "open").length,
    in_progress: requests.filter((r) => r.status === "in_progress").length,
    done: requests.filter((r) => r.status === "done").length,
    wont_fix: requests.filter((r) => r.status === "wont_fix").length,
  }), [requests])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function updateStatus(id: string, status: DevRequest["status"]) {
    setUpdating(id)
    const { error } = await (supabase as any)
      .from("dev_requests")
      .update({ status })
      .eq("id", id)
      .eq("user_id", userId)
    setUpdating(null)
    if (error) { toast.error("Failed to update status"); return }
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
  }

  async function deleteRequest(id: string) {
    setDeleting(id)
    const { error } = await (supabase as any)
      .from("dev_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
    setDeleting(null)
    if (error) { toast.error("Failed to delete request"); return }
    setRequests((prev) => prev.filter((r) => r.id !== id))
    toast.success("Request deleted")
  }

  const FILTERS: { value: typeof filter; label: string; count?: number }[] = [
    { value: "open", label: "Open", count: counts.open },
    { value: "in_progress", label: "In Progress", count: counts.in_progress },
    { value: "done", label: "Done", count: counts.done },
    { value: "wont_fix", label: "Won't Fix", count: counts.wont_fix },
    { value: "all", label: "All" },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 shrink-0 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
              filter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
            )}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={cn(
                "inline-flex items-center justify-center rounded-full w-4 h-4 text-[10px]",
                filter === f.value ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
            <Sparkles className="size-8 mb-2 opacity-30" />
            {filter === "open" ? "No open requests — the assistant hasn't flagged anything." : "Nothing here."}
          </div>
        ) : (
          filtered.map((req) => {
            const Icon = CATEGORY_ICON[req.category]
            const isExpanded = expanded.has(req.id)
            return (
              <div
                key={req.id}
                className="rounded-lg border border-border bg-card text-sm"
              >
                {/* Header row */}
                <div className="flex items-start gap-2.5 p-3">
                  <Icon className={cn("size-4 mt-0.5 shrink-0", CATEGORY_COLOR[req.category])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border",
                        PRIORITY_BADGE[req.priority]
                      )}>
                        {req.priority}
                      </span>
                      <span className="text-[10px] text-muted-foreground capitalize">{req.category}</span>
                    </div>
                    <p className="font-medium text-foreground leading-snug">{req.title}</p>
                  </div>
                  <button
                    onClick={() => toggleExpand(req.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-2.5">
                    <p className="text-muted-foreground text-xs leading-relaxed">{req.description}</p>
                    {req.context && (
                      <p className="text-xs text-muted-foreground/70 italic border-l-2 border-border pl-2">{req.context}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50">
                      Filed {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                  <div className="flex gap-1 flex-wrap flex-1">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateStatus(req.id, opt.value)}
                        disabled={req.status === opt.value || updating === req.id}
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                          req.status === opt.value
                            ? STATUS_STYLE[opt.value]
                            : "text-muted-foreground border-border hover:bg-muted disabled:opacity-40"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deleting === req.id}
                    onClick={() => deleteRequest(req.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
