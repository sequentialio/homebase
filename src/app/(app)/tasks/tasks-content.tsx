"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, RefreshCw, Circle, AlertCircle, CheckCircle2, Link2Off } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Filter = "all" | "overdue" | "today" | "this_week"

interface AsanaTask {
  gid: string
  name: string
  due_on: string | null
  completed: boolean
  permalink_url: string
  memberships?: Array<{
    project: { gid: string; name: string }
  }>
}

function formatDueDate(due_on: string | null, today: string) {
  if (!due_on) return { label: "No due date", isOverdue: false, isToday: false }
  if (due_on < today) {
    const days = Math.round(
      (new Date(today).getTime() - new Date(due_on + "T12:00:00").getTime()) / 86400000
    )
    return { label: days === 1 ? "1 day overdue" : `${days} days overdue`, isOverdue: true, isToday: false }
  }
  if (due_on === today) return { label: "Due today", isOverdue: false, isToday: true }
  const date = new Date(due_on + "T12:00:00")
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
  return { label, isOverdue: false, isToday: false }
}

export function TasksContent({ embedded = false }: { embedded?: boolean }) {
  const [tasks, setTasks] = useState<AsanaTask[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [connected, setConnected] = useState(true)

  useEffect(() => { load() }, [])

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch("/api/asana/tasks")
      const data = await res.json()
      if (res.status === 401 && ["not_connected", "auth_expired"].includes(data.code)) {
        setConnected(false)
        setTasks([])
        return
      }
      if (!res.ok) throw new Error(data.error || "Failed to fetch")
      setConnected(true)
      setTasks(data.tasks ?? [])
      if (isRefresh) toast.success("Tasks refreshed")
    } catch {
      if (isRefresh) toast.error("Failed to refresh tasks")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const today = useMemo(() => new Date().toISOString().split("T")[0], [])
  const oneWeekLater = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split("T")[0]
  }, [])

  // Derive sorted unique projects from loaded tasks
  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const task of tasks) {
      for (const m of task.memberships ?? []) {
        if (m.project.gid && m.project.name) map.set(m.project.gid, m.project.name)
      }
    }
    return Array.from(map.entries())
      .map(([gid, name]) => ({ gid, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks])

  const tasksInProject = useMemo(() =>
    projectFilter === "all"
      ? tasks
      : tasks.filter(t => t.memberships?.some(m => m.project.gid === projectFilter)),
    [tasks, projectFilter]
  )

  const todayCount = tasksInProject.filter(t => t.due_on === today).length
  const overdueCount = tasksInProject.filter(t => t.due_on && t.due_on < today).length

  const filteredTasks = useMemo(() => {
    let filtered = tasksInProject
    if (filter === "today") filtered = tasksInProject.filter(t => t.due_on === today)
    else if (filter === "this_week") filtered = tasksInProject.filter(t => t.due_on && t.due_on >= today && t.due_on <= oneWeekLater)
    else if (filter === "overdue") filtered = tasksInProject.filter(t => t.due_on && t.due_on < today)

    return [...filtered].sort((a, b) => {
      // overdue first (oldest first), then today, then future by date, then no date last
      if (!a.due_on && !b.due_on) return 0
      if (!a.due_on) return 1
      if (!b.due_on) return -1
      const aOver = a.due_on < today
      const bOver = b.due_on < today
      if (aOver && !bOver) return -1
      if (!aOver && bOver) return 1
      return a.due_on.localeCompare(b.due_on)
    })
  }, [tasksInProject, filter, today, oneWeekLater])

  if (loading) return null

  if (!connected) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center gap-4 text-center",
        embedded ? "py-8" : "p-4 md:p-6 min-h-[40vh]"
      )}>
        <Link2Off className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">Asana not connected</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your Asana account in Settings to see your tasks.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Go to Settings</Link>
        </Button>
      </div>
    )
  }

  const filterLabels: Record<Filter, string> = {
    all: "All",
    overdue: "Overdue",
    today: "Today",
    this_week: "This Week",
  }

  return (
    <div className={cn(embedded ? "space-y-4" : "p-4 md:p-6 space-y-5")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {embedded
          ? <h2 className="text-lg font-semibold">Tasks</h2>
          : <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        }
        <Button
          variant="ghost"
          size="sm"
          onClick={() => load(true)}
          disabled={refreshing}
          className="gap-1.5 text-muted-foreground"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">{tasksInProject.length} open</span>
        {todayCount > 0 && (
          <span className="text-amber-500 font-medium">{todayCount} due today</span>
        )}
        {overdueCount > 0 && (
          <span className="text-destructive font-medium">{overdueCount} overdue</span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "overdue", "today", "this_week"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
          >
            {filterLabels[f]}
            {f === "overdue" && overdueCount > 0 && (
              <span className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                filter === f ? "bg-white/20" : "bg-destructive/15 text-destructive"
              )}>
                {overdueCount}
              </span>
            )}
            {f === "today" && todayCount > 0 && (
              <span className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                filter === f ? "bg-white/20" : "bg-amber-500/15 text-amber-500"
              )}>
                {todayCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Project filter */}
      {projects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
          <button
            onClick={() => setProjectFilter("all")}
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              projectFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
            )}
          >
            All Projects
          </button>
          {projects.map(p => (
            <button
              key={p.gid}
              onClick={() => setProjectFilter(p.gid)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                projectFilter === p.gid
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CheckCircle2 className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "No open tasks"
              : filter === "overdue"
              ? "Nothing overdue"
              : filter === "today"
              ? "Nothing due today"
              : "Nothing due this week"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map(task => {
            const { label, isOverdue, isToday } = formatDueDate(task.due_on, today)
            const projects = task.memberships?.map(m => m.project.name).filter(Boolean) ?? []

            return (
              <div
                key={task.gid}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40",
                  isOverdue && "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                )}
              >
                <Circle className={cn(
                  "size-4 mt-0.5 shrink-0",
                  isOverdue ? "text-destructive" : "text-muted-foreground/50"
                )} />

                <div className="flex-1 min-w-0">
                  <a
                    href={task.permalink_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline leading-snug line-clamp-2"
                  >
                    {task.name}
                  </a>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {projects.map(p => (
                      <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                        {p}
                      </Badge>
                    ))}
                    <span className={cn(
                      "text-xs flex items-center gap-0.5",
                      isOverdue ? "text-destructive" : isToday ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      {isOverdue && <AlertCircle className="size-3" />}
                      {label}
                    </span>
                  </div>
                </div>

                <a href={task.permalink_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <Button variant="ghost" size="icon" className="!size-7 !min-h-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-3.5" />
                  </Button>
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
